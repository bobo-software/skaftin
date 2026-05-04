package dbproxy

import (
	"context"
	"fmt"
)

// EnsureAppCronTables creates per-project cron job definition and client-run log
// tables in the current schema (project search_path). Safe to call on every request.
func EnsureAppCronTables(ctx context.Context, pc *ProjectConn) error {
	const createJobs = `
CREATE TABLE IF NOT EXISTS skaftin_app_cron_jobs (
	id SERIAL PRIMARY KEY,
	jobname TEXT NOT NULL,
	schedule TEXT NOT NULL,
	command TEXT NOT NULL,
	active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT skaftin_app_cron_jobs_jobname_key UNIQUE (jobname)
)`
	const createRuns = `
CREATE TABLE IF NOT EXISTS skaftin_app_cron_job_runs (
	id BIGSERIAL PRIMARY KEY,
	job_id INTEGER NOT NULL REFERENCES skaftin_app_cron_jobs(id) ON DELETE CASCADE,
	status TEXT NOT NULL,
	return_message TEXT,
	command TEXT,
	start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
	end_time TIMESTAMPTZ NOT NULL DEFAULT now()
)`
	const idx = `CREATE INDEX IF NOT EXISTS skaftin_app_cron_job_runs_job_started
		ON skaftin_app_cron_job_runs (job_id, start_time DESC)`

	if err := pc.Exec(ctx, createJobs); err != nil {
		return fmt.Errorf("create skaftin_app_cron_jobs: %w", err)
	}
	if err := pc.Exec(ctx, createRuns); err != nil {
		return fmt.Errorf("create skaftin_app_cron_job_runs: %w", err)
	}
	if err := pc.Exec(ctx, idx); err != nil {
		return fmt.Errorf("index skaftin_app_cron_job_runs: %w", err)
	}
	return nil
}
