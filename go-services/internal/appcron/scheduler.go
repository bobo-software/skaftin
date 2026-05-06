package appcron

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

var schemaNameRe = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

const defaultTick = 30 * time.Second

type Scheduler struct {
	pool     *pgxpool.Pool
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

type projectRow struct {
	ID     int
	Name   string
	Schema string
}

type cronJobRow struct {
	ID        int
	Schedule  string
	Command   string
	UpdatedAt time.Time
	LastRunAt *time.Time
}

func NewScheduler(pool *pgxpool.Pool) *Scheduler {
	return &Scheduler{
		pool:     pool,
		interval: defaultTick,
		stopCh:   make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	s.wg.Add(1)
	go s.loop()
	slog.Info("app cron scheduler started", "interval", s.interval.String())
}

func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
	slog.Info("app cron scheduler stopped")
}

func (s *Scheduler) loop() {
	defer s.wg.Done()

	s.runTick()
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.runTick()
		}
	}
}

func (s *Scheduler) runTick() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	projects, err := s.listProjects(ctx)
	if err != nil {
		slog.Error("app cron tick failed to list projects", "error", err)
		return
	}

	now := time.Now().UTC()
	for _, p := range projects {
		if !schemaNameRe.MatchString(p.Schema) {
			slog.Warn("skipping app cron project with invalid schema", "projectId", p.ID, "schema", p.Schema)
			continue
		}
		if err := s.runProjectJobs(ctx, p, now); err != nil {
			slog.Error("app cron project tick failed", "projectId", p.ID, "schema", p.Schema, "error", err)
		}
	}
}

func (s *Scheduler) listProjects(ctx context.Context) ([]projectRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, schema_name
		FROM skaftin_system_projects
		WHERE schema_name IS NOT NULL
		  AND schema_name <> ''
		  AND deletion_scheduled_at IS NULL
		  AND deleted_at IS NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]projectRow, 0)
	for rows.Next() {
		var p projectRow
		if err := rows.Scan(&p.ID, &p.Name, &p.Schema); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Scheduler) runProjectJobs(ctx context.Context, p projectRow, now time.Time) error {
	hasTable, err := s.projectCronTablesExist(ctx, p.Schema)
	if err != nil {
		return err
	}
	if !hasTable {
		return nil
	}

	jobs, err := s.listActiveJobs(ctx, p.Schema)
	if err != nil {
		return err
	}

	for _, job := range jobs {
		due, dueErr := jobDue(job, now)
		if dueErr != nil {
			slog.Warn("invalid cron expression in app cron job",
				"projectId", p.ID, "schema", p.Schema, "jobId", job.ID, "schedule", job.Schedule, "error", dueErr)
			continue
		}
		if !due {
			continue
		}
		s.executeJob(p, job)
	}
	return nil
}

func (s *Scheduler) projectCronTablesExist(ctx context.Context, schema string) (bool, error) {
	var jobsTable string
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(to_regclass($1)::text, '')`, fmt.Sprintf("%s.skaftin_app_cron_jobs", schema)).Scan(&jobsTable); err != nil {
		return false, err
	}
	var runsTable string
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(to_regclass($1)::text, '')`, fmt.Sprintf("%s.skaftin_app_cron_job_runs", schema)).Scan(&runsTable); err != nil {
		return false, err
	}
	return jobsTable != "" && runsTable != "", nil
}

func (s *Scheduler) listActiveJobs(ctx context.Context, schema string) ([]cronJobRow, error) {
	query := fmt.Sprintf(`
		SELECT
			j.id,
			j.schedule,
			j.command,
			j.updated_at,
			(
				SELECT MAX(r.start_time)
				FROM %s.skaftin_app_cron_job_runs r
				WHERE r.job_id = j.id
			) AS last_run_at
		FROM %s.skaftin_app_cron_jobs j
		WHERE j.active = true
	`, schema, schema)
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]cronJobRow, 0)
	for rows.Next() {
		var r cronJobRow
		if err := rows.Scan(&r.ID, &r.Schedule, &r.Command, &r.UpdatedAt, &r.LastRunAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func jobDue(job cronJobRow, now time.Time) (bool, error) {
	parser := cron.NewParser(cron.SecondOptional | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(strings.TrimSpace(job.Schedule))
	if err != nil {
		return false, err
	}

	anchor := job.UpdatedAt.UTC()
	if job.LastRunAt != nil && job.LastRunAt.UTC().After(anchor) {
		anchor = job.LastRunAt.UTC()
	}
	next := sched.Next(anchor)
	return !next.After(now), nil
}

func (s *Scheduler) executeJob(p projectRow, job cronJobRow) {
	start := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	_, execErr := s.pool.Exec(ctx, job.Command)
	end := time.Now().UTC()

	status := "succeeded"
	msg := ""
	if execErr != nil {
		status = "failed"
		msg = execErr.Error()
	}

	insertQuery := fmt.Sprintf(`
		INSERT INTO %s.skaftin_app_cron_job_runs (job_id, status, return_message, command, start_time, end_time)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, p.Schema)
	if _, err := s.pool.Exec(context.Background(), insertQuery, job.ID, status, msg, job.Command, start, end); err != nil {
		slog.Error("app cron failed to persist run",
			"projectId", p.ID, "schema", p.Schema, "jobId", job.ID, "status", status, "error", err)
		return
	}

	if execErr != nil {
		slog.Error("app cron execution failed",
			"projectId", p.ID, "schema", p.Schema, "jobId", job.ID, "schedule", job.Schedule, "error", execErr)
		return
	}
	slog.Info("app cron execution completed",
		"projectId", p.ID, "schema", p.Schema, "jobId", job.ID, "schedule", job.Schedule)
}
