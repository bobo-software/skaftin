package dbproxy

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 5: Query Execution + Cron ---

func (h *Handler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Query      string `json:"query"`
		Parameters []any  `json:"parameters"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Query == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Query is required")
		return
	}

	normalized := normalizeQuery(body.Query)
	start := time.Now()

	rows, err := pc.Query(r.Context(), normalized, body.Parameters...)
	if err != nil {
		slog.Error("execute query failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to execute query")
		return
	}
	defer rows.Close()

	descs := rows.FieldDescriptions()
	colNames := make([]string, len(descs))
	for i, d := range descs {
		colNames[i] = d.Name
	}

	result := collectRows(rows)
	execTime := time.Since(start).Milliseconds()

	httputil.WriteSuccess(w, http.StatusOK, "Query executed successfully", map[string]any{
		"rows":          result,
		"rowCount":      len(result),
		"columns":       colNames,
		"executionTime": execTime,
	})
}

// --- Cron Jobs (app-owned tables; pg_cron is not used) ---

func (h *Handler) ListCronJobs(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	rows, err := pc.Query(ctx, `
		SELECT j.id AS jobid, j.schedule, j.command, j.jobname, j.active,
			current_database() AS database, current_user AS username
		FROM skaftin_app_cron_jobs j
		ORDER BY j.id DESC
	`)
	if err != nil {
		slog.Error("list cron jobs failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch cron jobs")
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	httputil.WriteSuccess(w, http.StatusOK, "Cron jobs fetched successfully", result)
}

func (h *Handler) GetCronJobHistory(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	jobIdStr := r.PathValue("jobId")
	jobID, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	rows, err := pc.Query(ctx, `
		SELECT r.id AS runid, r.job_id AS jobid, NULL::integer AS job_pid,
			current_database() AS database, current_user AS username,
			r.command, r.status, r.return_message, r.start_time, r.end_time
		FROM skaftin_app_cron_job_runs r
		WHERE r.job_id = $1
		ORDER BY r.start_time DESC
		LIMIT $2
	`, jobID, limit)
	if err != nil {
		slog.Error("get cron job history failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch cron job history")
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	httputil.WriteSuccess(w, http.StatusOK, "Cron job history fetched successfully", result)
}

func (h *Handler) CreateCronJob(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	var body struct {
		JobName  string `json:"jobName"`
		Schedule string `json:"schedule"`
		Command  string `json:"command"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.JobName == "" || body.Schedule == "" || body.Command == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Job name, schedule, and command are required")
		return
	}

	parts := strings.Fields(body.Schedule)
	if len(parts) != 5 && len(parts) != 6 {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid cron schedule format. Expected 5 fields (minute hour day month weekday) or 6 fields (second minute hour day month weekday)")
		return
	}
	normalizedSchedule := strings.Join(parts, " ")

	var currentSchema string
	pc.QueryRow(ctx, "SELECT current_schema()").Scan(&currentSchema)
	fullCommand := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, body.Command)

	var jobID int
	err := pc.QueryRow(ctx, `
		INSERT INTO skaftin_app_cron_jobs (jobname, schedule, command)
		VALUES ($1, $2, $3)
		RETURNING id
	`, body.JobName, normalizedSchedule, fullCommand).Scan(&jobID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httputil.WriteError(w, http.StatusConflict, "A cron job with this name already exists")
			return
		}
		slog.Error("create cron job failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create cron job")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Cron job created successfully", map[string]any{
		"jobid":    jobID,
		"jobName":  body.JobName,
		"schedule": normalizedSchedule,
		"command":  fullCommand,
	})
	h.emitDatabaseEvent(pid, "create_cron_job", "skaftin_app_cron_jobs", map[string]any{
		"jobId":    jobID,
		"jobName":  body.JobName,
		"schedule": normalizedSchedule,
		"command":  fullCommand,
	}, nil)
}

func (h *Handler) UpdateCronJob(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	jobIdStr := r.PathValue("jobId")
	jobId, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}

	var body struct {
		Schedule *string `json:"schedule"`
		Command  *string `json:"command"`
		JobName  *string `json:"jobName"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.Schedule != nil {
		parts := strings.Fields(*body.Schedule)
		if len(parts) != 5 && len(parts) != 6 {
			httputil.WriteError(w, http.StatusBadRequest, "Invalid cron schedule format. Expected 5 or 6 cron fields")
			return
		}
		norm := strings.Join(parts, " ")
		if err := pc.Exec(ctx, `UPDATE skaftin_app_cron_jobs SET schedule = $1, updated_at = now() WHERE id = $2`, norm, jobId); err != nil {
			slog.Error("update cron schedule", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update cron job")
			return
		}
	}
	if body.Command != nil {
		var currentSchema string
		pc.QueryRow(ctx, "SELECT current_schema()").Scan(&currentSchema)
		fullCmd := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, *body.Command)
		if err := pc.Exec(ctx, `UPDATE skaftin_app_cron_jobs SET command = $1, updated_at = now() WHERE id = $2`, fullCmd, jobId); err != nil {
			slog.Error("update cron command", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update cron job")
			return
		}
	}
	if body.JobName != nil {
		if err := pc.Exec(ctx, `UPDATE skaftin_app_cron_jobs SET jobname = $1, updated_at = now() WHERE id = $2`, *body.JobName, jobId); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				httputil.WriteError(w, http.StatusConflict, "A cron job with this name already exists")
				return
			}
			slog.Error("update cron jobname", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update cron job")
			return
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, "Cron job updated successfully", map[string]any{
		"jobId": jobIdStr,
	})
	h.emitDatabaseEvent(pid, "update_cron_job", "skaftin_app_cron_jobs", map[string]any{
		"jobId":    jobId,
		"jobName":  body.JobName,
		"schedule": body.Schedule,
		"command":  body.Command,
	}, nil)
}

func (h *Handler) ToggleCronJob(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	jobIdStr := r.PathValue("jobId")
	jobId, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}

	var body struct {
		Active *bool `json:"active"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Active == nil {
		httputil.WriteError(w, http.StatusBadRequest, "Active status is required")
		return
	}

	err = pc.QueryRow(ctx, `
		UPDATE skaftin_app_cron_jobs SET active = $1, updated_at = now() WHERE id = $2 RETURNING id
	`, *body.Active, jobId).Scan(&jobId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.WriteError(w, http.StatusNotFound, fmt.Sprintf("Cron job with ID %d not found", jobId))
			return
		}
		slog.Error("toggle cron job", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update cron job")
		return
	}

	msg := "deactivated"
	if *body.Active {
		msg = "activated"
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Cron job %s successfully", msg), map[string]any{
		"jobId":  jobId,
		"active": *body.Active,
	})
	h.emitDatabaseEvent(pid, "toggle_cron_job", "skaftin_app_cron_jobs", map[string]any{
		"jobId":  jobId,
		"active": *body.Active,
	}, nil)
}

func (h *Handler) DeleteCronJob(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	jobIdStr := r.PathValue("jobId")
	jobId, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}

	err = pc.QueryRow(ctx, `DELETE FROM skaftin_app_cron_jobs WHERE id = $1 RETURNING id`, jobId).Scan(&jobId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.WriteError(w, http.StatusNotFound, fmt.Sprintf("Cron job with ID %d not found", jobId))
			return
		}
		slog.Error("delete cron job", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete cron job")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Cron job deleted successfully", map[string]any{"jobId": jobId})
	h.emitDatabaseEvent(pid, "delete_cron_job", "skaftin_app_cron_jobs", map[string]any{
		"jobId": jobId,
	}, nil)
}

// RecordCronClientRun appends a run row when the dashboard client executes a job in the browser.
func (h *Handler) RecordCronClientRun(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	ctx := r.Context()
	if err := EnsureAppCronTables(ctx, pc); err != nil {
		slog.Error("ensure app cron tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to initialize cron storage")
		return
	}

	jobIdStr := r.PathValue("jobId")
	jobId, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}

	var body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Command string `json:"command"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	status := "failed"
	if body.Success {
		status = "succeeded"
	}

	var exists bool
	if err := pc.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skaftin_app_cron_jobs WHERE id = $1)`, jobId).Scan(&exists); err != nil {
		slog.Error("cron client run lookup", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to record cron run")
		return
	}
	if !exists {
		httputil.WriteError(w, http.StatusNotFound, fmt.Sprintf("Cron job with ID %d not found", jobId))
		return
	}

	now := time.Now().UTC()
	if err := pc.Exec(ctx, `
		INSERT INTO skaftin_app_cron_job_runs (job_id, status, return_message, command, start_time, end_time)
		VALUES ($1, $2, $3, $4, $5, $5)
	`, jobId, status, body.Message, body.Command, now); err != nil {
		slog.Error("record cron client run", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to record cron run")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Cron run recorded", map[string]any{"jobId": jobId})
	h.emitDatabaseEvent(pid, "cron_client_run", "skaftin_app_cron_job_runs", map[string]any{
		"jobId": jobId, "status": status,
	}, nil)
}
