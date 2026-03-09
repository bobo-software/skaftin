package maintenance

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/supertokens"
)

var schemaNameRe = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

const (
	accountDeletionCronExpr   = "0 2 * * *"
	requestLogCleanupCronExpr = "0 3 * * *"
	projectPurgeCronExpr      = "15 * * * *"
)

type Scheduler struct {
	pool *pgxpool.Pool
	st   *supertokens.Client
	ps   *projects.Store
	s3   *projects.S3Client
	cron *cron.Cron
}

type accountDeletionStats struct {
	Processed int
	Errors    int
}

type requestLogCleanupStats struct {
	Processed int
	Deleted   int64
	Errors    int
}

type projectPurgeStats struct {
	Processed int
	Errors    int
}

func NewScheduler(pool *pgxpool.Pool, st *supertokens.Client, minioCfg config.MinIOConfig) *Scheduler {
	c := cron.New(cron.WithLocation(time.UTC))
	s3Client, err := projects.NewS3Client(minioCfg)
	if err != nil {
		slog.Warn("maintenance scheduler could not initialize project storage client", "error", err)
	}
	return &Scheduler{
		pool: pool,
		st:   st,
		ps:   projects.NewStore(pool),
		s3:   s3Client,
		cron: c,
	}
}

func (s *Scheduler) Start() error {
	if _, err := s.cron.AddFunc(accountDeletionCronExpr, func() {
		stats, runErr := s.processPendingAccountDeletions(context.Background())
		if runErr != nil {
			slog.Error("maintenance account deletion failed", "error", runErr)
			return
		}
		slog.Info("maintenance account deletion complete", "processed", stats.Processed, "errors", stats.Errors)
	}); err != nil {
		return err
	}

	if _, err := s.cron.AddFunc(requestLogCleanupCronExpr, func() {
		stats, runErr := s.cleanupRequestLogs(context.Background())
		if runErr != nil {
			slog.Error("maintenance request log cleanup failed", "error", runErr)
			return
		}
		slog.Info("maintenance request log cleanup complete", "projects", stats.Processed, "deleted", stats.Deleted, "errors", stats.Errors)
	}); err != nil {
		return err
	}

	if _, err := s.cron.AddFunc(projectPurgeCronExpr, func() {
		stats, runErr := s.processPendingProjectDeletions(context.Background())
		if runErr != nil {
			slog.Error("maintenance project purge failed", "error", runErr)
			return
		}
		slog.Info("maintenance project purge complete", "processed", stats.Processed, "errors", stats.Errors)
	}); err != nil {
		return err
	}

	slog.Info("maintenance scheduler cron configured",
		"accountDeletion", accountDeletionCronExpr,
		"requestLogCleanup", requestLogCleanupCronExpr,
		"projectPurge", projectPurgeCronExpr,
	)
	s.cron.Start()
	return nil
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}

func (s *Scheduler) processPendingAccountDeletions(ctx context.Context) (accountDeletionStats, error) {
	stats := accountDeletionStats{}

	rows, err := s.pool.Query(ctx, `
		SELECT id, name, schema_name
		FROM skaftin_system_projects
		WHERE schema_name IS NOT NULL AND schema_name <> ''
	`)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	type project struct {
		ID         int
		Name       string
		SchemaName string
	}
	projects := make([]project, 0)
	for rows.Next() {
		var p project
		if scanErr := rows.Scan(&p.ID, &p.Name, &p.SchemaName); scanErr != nil {
			return stats, scanErr
		}
		projects = append(projects, p)
	}
	if rows.Err() != nil {
		return stats, rows.Err()
	}

	for _, p := range projects {
		if !schemaNameRe.MatchString(p.SchemaName) {
			slog.Warn("skipping invalid schema name", "schema", p.SchemaName, "projectId", p.ID)
			continue
		}

		query := fmt.Sprintf(`
			SELECT id, supertokens_user_id
			FROM %s.skaftin_system_users
			WHERE deletion_scheduled_at IS NOT NULL
			  AND deletion_scheduled_at <= NOW()
			  AND deleted_at IS NULL
			  AND is_active = true
		`, p.SchemaName)

		userRows, qErr := s.pool.Query(ctx, query)
		if qErr != nil {
			stats.Errors++
			slog.Error("failed to query users pending deletion", "projectId", p.ID, "schema", p.SchemaName, "error", qErr)
			continue
		}

		type user struct {
			ID              int
			SupertokensUser *string
		}
		users := make([]user, 0)
		for userRows.Next() {
			var u user
			if scanErr := userRows.Scan(&u.ID, &u.SupertokensUser); scanErr != nil {
				userRows.Close()
				stats.Errors++
				slog.Error("failed to scan pending deletion user", "projectId", p.ID, "schema", p.SchemaName, "error", scanErr)
				continue
			}
			users = append(users, u)
		}
		userRows.Close()

		for _, u := range users {
			updateQuery := fmt.Sprintf(`
				UPDATE %s.skaftin_system_users
				SET is_active = false,
					deleted_at = NOW(),
					updated_at = NOW()
				WHERE id = $1
			`, p.SchemaName)

			if _, updErr := s.pool.Exec(ctx, updateQuery, u.ID); updErr != nil {
				stats.Errors++
				slog.Error("failed to soft-delete user", "projectId", p.ID, "schema", p.SchemaName, "userId", u.ID, "error", updErr)
				continue
			}

			if u.SupertokensUser != nil && *u.SupertokensUser != "" {
				if _, revokeErr := s.st.RevokeAllSessionsForUser(ctx, *u.SupertokensUser); revokeErr != nil {
					slog.Warn("failed to revoke sessions for deleted user", "userId", u.ID, "stUserId", *u.SupertokensUser, "error", revokeErr)
				}
			}
			stats.Processed++
		}
	}

	return stats, nil
}

func retentionDays(retention string, loggingEnabled bool) *int {
	if !loggingEnabled || retention == "disabled" {
		zero := 0
		return &zero
	}
	switch retention {
	case "daily":
		d := 1
		return &d
	case "weekly":
		d := 7
		return &d
	case "monthly":
		d := 30
		return &d
	default:
		d := 7
		return &d
	}
}

func (s *Scheduler) cleanupRequestLogs(ctx context.Context) (requestLogCleanupStats, error) {
	stats := requestLogCleanupStats{}

	rows, err := s.pool.Query(ctx, `
		SELECT
			p.id,
			COALESCE(s.settings_json->>'request_log_retention', 'weekly') AS retention,
			COALESCE((s.settings_json->>'request_logging_enabled')::boolean, false) AS logging_enabled
		FROM skaftin_system_projects p
		LEFT JOIN skaftin_system_auth_settings s ON s.project_id = p.id
	`)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	type project struct {
		ID             int
		Retention      string
		LoggingEnabled bool
	}
	projects := make([]project, 0)
	for rows.Next() {
		var p project
		if scanErr := rows.Scan(&p.ID, &p.Retention, &p.LoggingEnabled); scanErr != nil {
			return stats, scanErr
		}
		projects = append(projects, p)
	}
	if rows.Err() != nil {
		return stats, rows.Err()
	}

	for _, p := range projects {
		rd := retentionDays(p.Retention, p.LoggingEnabled)
		if rd == nil {
			continue
		}

		var tagCount int64
		if *rd == 0 {
			tag, delErr := s.pool.Exec(ctx, `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1`, p.ID)
			if delErr != nil {
				stats.Errors++
				slog.Error("failed to cleanup disabled-request-logs project", "projectId", p.ID, "error", delErr)
				continue
			}
			tagCount = tag.RowsAffected()
		} else {
			cutoff := time.Now().Add(-time.Duration(*rd) * 24 * time.Hour)
			tag, delErr := s.pool.Exec(ctx, `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at < $2`, p.ID, cutoff)
			if delErr != nil {
				stats.Errors++
				slog.Error("failed to cleanup request logs by retention", "projectId", p.ID, "retentionDays", *rd, "error", delErr)
				continue
			}
			tagCount = tag.RowsAffected()
		}

		stats.Processed++
		stats.Deleted += tagCount
	}

	return stats, nil
}

func (s *Scheduler) processPendingProjectDeletions(ctx context.Context) (projectPurgeStats, error) {
	stats := projectPurgeStats{}

	projectsDue, err := s.ps.ListProjectsDueForPermanentDeletion(ctx)
	if err != nil {
		return stats, err
	}

	for _, p := range projectsDue {
		if p.SchemaName != "" && !schemaNameRe.MatchString(p.SchemaName) {
			stats.Errors++
			slog.Warn("skipping purge for invalid schema name", "projectId", p.ID, "schema", p.SchemaName)
			continue
		}

		bucketRows, qErr := s.pool.Query(ctx, `SELECT bucket_name FROM skaftin_system_project_buckets WHERE project_id = $1`, p.ID)
		if qErr != nil {
			stats.Errors++
			slog.Error("failed to fetch project buckets before purge", "projectId", p.ID, "error", qErr)
			continue
		}

		buckets := make([]string, 0)
		for bucketRows.Next() {
			var bucketName string
			if scanErr := bucketRows.Scan(&bucketName); scanErr != nil {
				stats.Errors++
				slog.Error("failed to scan project bucket before purge", "projectId", p.ID, "error", scanErr)
				continue
			}
			buckets = append(buckets, bucketName)
		}
		bucketRows.Close()

		if s.s3 != nil {
			for _, bucketName := range buckets {
				if _, rmErr := s.s3.RemoveAllObjects(ctx, bucketName); rmErr != nil {
					stats.Errors++
					slog.Warn("failed to clear bucket objects during purge", "projectId", p.ID, "bucket", bucketName, "error", rmErr)
				}
				if rmBucketErr := s.s3.RemoveBucket(ctx, bucketName); rmBucketErr != nil {
					stats.Errors++
					slog.Warn("failed to remove bucket during purge", "projectId", p.ID, "bucket", bucketName, "error", rmBucketErr)
				}
			}
		}

		if p.SchemaName != "" {
			if _, dropErr := s.pool.Exec(ctx, fmt.Sprintf(`DROP SCHEMA IF EXISTS %s CASCADE`, p.SchemaName)); dropErr != nil {
				stats.Errors++
				slog.Warn("failed to drop project schema during purge", "projectId", p.ID, "schema", p.SchemaName, "error", dropErr)
			}
		}

		if delErr := s.ps.PermanentlyDeleteProject(ctx, p.ID); delErr != nil {
			stats.Errors++
			slog.Error("failed to permanently delete project", "projectId", p.ID, "error", delErr)
			continue
		}
		stats.Processed++
	}

	return stats, nil
}
