package backups

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
)

// Scheduler manages automatic backup cron jobs.
type Scheduler struct {
	cron    *cron.Cron
	service *Service
	mu      sync.Mutex
	entries map[int]cron.EntryID // scheduleID -> cron entry ID
}

// NewScheduler creates a Scheduler and starts the cron runner.
func NewScheduler(service *Service) *Scheduler {
	c := cron.New(cron.WithLocation(time.UTC))
	c.Start()
	return &Scheduler{
		cron:    c,
		service: service,
		entries: make(map[int]cron.EntryID),
	}
}

// LoadAll loads all enabled schedules from the database and registers cron jobs.
func (s *Scheduler) LoadAll(ctx context.Context) error {
	schedules, err := s.service.store.GetEnabledSchedules(ctx)
	if err != nil {
		return fmt.Errorf("load enabled schedules: %w", err)
	}

	slog.Info("loading backup schedules", "count", len(schedules))
	for _, sched := range schedules {
		s.Schedule(ctx, sched.ID)
	}
	return nil
}

// Schedule adds or replaces a cron entry for the given schedule ID.
func (s *Scheduler) Schedule(ctx context.Context, scheduleID int) {
	sched, err := s.service.store.GetScheduleByID(ctx, scheduleID)
	if err != nil {
		slog.Error("failed to load schedule for cron", "scheduleId", scheduleID, "error", err)
		return
	}
	if !sched.Enabled {
		slog.Info("schedule is disabled, skipping", "scheduleId", scheduleID)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if eid, ok := s.entries[scheduleID]; ok {
		s.cron.Remove(eid)
		delete(s.entries, scheduleID)
	}

	eid, err := s.cron.AddFunc(sched.Schedule, func() {
		s.runBackup(scheduleID)
	})
	if err != nil {
		slog.Error("failed to schedule cron job", "scheduleId", scheduleID, "schedule", sched.Schedule, "error", err)
		return
	}

	s.entries[scheduleID] = eid
	slog.Info("scheduled backup", "scheduleId", scheduleID, "cron", sched.Schedule)

	s.service.store.UpdateScheduleNextRun(ctx, scheduleID, nil)
}

// Unschedule removes the cron entry for the given schedule ID.
func (s *Scheduler) Unschedule(scheduleID int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if eid, ok := s.entries[scheduleID]; ok {
		s.cron.Remove(eid)
		delete(s.entries, scheduleID)
		slog.Info("unscheduled backup", "scheduleId", scheduleID)
	}
}

// Stop halts the cron runner. Call during graceful shutdown.
func (s *Scheduler) Stop() {
	s.cron.Stop()
	slog.Info("backup scheduler stopped")
}

// runBackup is the cron callback that executes a scheduled backup.
func (s *Scheduler) runBackup(scheduleID int) {
	ctx := context.Background()
	slog.Info("cron triggered for backup schedule", "scheduleId", scheduleID)

	sched, err := s.service.store.GetScheduleByID(ctx, scheduleID)
	if err != nil {
		slog.Error("schedule not found during execution", "scheduleId", scheduleID, "error", err)
		return
	}
	if !sched.Enabled {
		slog.Info("schedule disabled, skipping execution", "scheduleId", scheduleID)
		return
	}

	ts := time.Now().UTC().Format("2006-01-02T15-04-05")
	var backupName string
	if sched.BackupNamePrefix != nil && *sched.BackupNamePrefix != "" {
		backupName = fmt.Sprintf("%s-%s", *sched.BackupNamePrefix, ts)
	} else {
		backupName = fmt.Sprintf("auto-backup-%s", ts)
	}

	var desc string
	if sched.Description != nil {
		desc = *sched.Description
	}

	var backupErr error
	if sched.BackupType == "full" {
		_, backupErr = s.service.CreateFullBackup(ctx, sched.ProjectID, backupName, desc)
	} else {
		_, backupErr = s.service.CreateBackup(ctx, sched.ProjectID, backupName, desc, "database")
	}

	if backupErr != nil {
		slog.Error("scheduled backup failed", "scheduleId", scheduleID, "error", backupErr)
		return
	}

	s.service.store.UpdateScheduleLastRun(ctx, scheduleID)
	slog.Info("scheduled backup completed", "scheduleId", scheduleID, "backupType", sched.BackupType)

	s.applyRetention(ctx, sched)
}

func (s *Scheduler) applyRetention(ctx context.Context, sched *BackupSchedule) {
	if sched.RetentionDays != nil && *sched.RetentionDays > 0 {
		s.service.CleanupOldBackups(ctx, sched.ProjectID, "keep_days", *sched.RetentionDays)
		return
	}
	if sched.RetentionPolicy != "keep_all" && sched.RetentionValue != nil && *sched.RetentionValue > 0 {
		s.service.CleanupOldBackups(ctx, sched.ProjectID, sched.RetentionPolicy, *sched.RetentionValue)
	}
}

// validateCron checks whether a cron expression is parseable.
func validateCron(expr string) bool {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expr)
	return err == nil
}
