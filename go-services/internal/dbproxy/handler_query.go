package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

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

// --- Cron Jobs ---

func (h *Handler) ensurePgCron(w http.ResponseWriter, r *http.Request, pc *ProjectConn) bool {
	var exists bool
	pc.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')`).Scan(&exists)
	if exists {
		return true
	}
	if err := pc.Exec(r.Context(), "CREATE EXTENSION IF NOT EXISTS pg_cron"); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "pg_cron extension is not installed and could not be automatically enabled.")
		return false
	}
	return true
}

func (h *Handler) ListCronJobs(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	if !h.ensurePgCron(w, r, pc) {
		return
	}

	rows, err := pc.Query(r.Context(), `
		SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
		FROM cron.job ORDER BY jobid DESC
	`)
	if err != nil {
		slog.Error("list cron jobs failed", "error", err)
		if strings.Contains(err.Error(), "cron.job") {
			httputil.WriteError(w, http.StatusBadRequest, "pg_cron extension is not installed.")
			return
		}
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

	jobId := r.PathValue("jobId")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	rows, err := pc.Query(r.Context(), `
		SELECT runid, jobid, job_pid, database, username, command, status, return_message, start_time, end_time
		FROM cron.job_run_details WHERE jobid = $1 ORDER BY start_time DESC LIMIT $2
	`, jobId, limit)
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

	if !h.ensurePgCron(w, r, pc) {
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
	if len(parts) != 5 {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid cron schedule format. Expected: \"minute hour day month weekday\"")
		return
	}
	normalizedSchedule := strings.Join(parts, " ")

	var currentSchema string
	pc.QueryRow(r.Context(), "SELECT current_schema()").Scan(&currentSchema)
	fullCommand := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, body.Command)

	var jobID int
	err := pc.QueryRow(r.Context(), `SELECT cron.schedule($1, $2, $3)`, body.JobName, normalizedSchedule, fullCommand).Scan(&jobID)
	if err != nil {
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
	h.emitDatabaseEvent(pid, "create_cron_job", "cron.job", map[string]any{
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

	jobId := r.PathValue("jobId")
	var body struct {
		Schedule *string `json:"schedule"`
		Command  *string `json:"command"`
		JobName  *string `json:"jobName"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	ctx := r.Context()

	if body.Schedule != nil {
		pc.Exec(ctx, `UPDATE cron.job SET schedule = $1 WHERE jobid = $2`, *body.Schedule, jobId)
	}
	if body.Command != nil {
		var currentSchema string
		pc.QueryRow(ctx, "SELECT current_schema()").Scan(&currentSchema)
		fullCmd := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, *body.Command)
		pc.Exec(ctx, `UPDATE cron.job SET command = $1 WHERE jobid = $2`, fullCmd, jobId)
	}
	if body.JobName != nil {
		pc.Exec(ctx, `UPDATE cron.job SET jobname = $1 WHERE jobid = $2`, *body.JobName, jobId)
	}

	httputil.WriteSuccess(w, http.StatusOK, "Cron job updated successfully", map[string]any{
		"jobId": jobId,
	})
	h.emitDatabaseEvent(pid, "update_cron_job", "cron.job", map[string]any{
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

	jobId := r.PathValue("jobId")
	var body struct {
		Active *bool `json:"active"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Active == nil {
		httputil.WriteError(w, http.StatusBadRequest, "Active status is required")
		return
	}

	pc.Exec(r.Context(), `UPDATE cron.job SET active = $1 WHERE jobid = $2`, *body.Active, jobId)

	msg := "deactivated"
	if *body.Active {
		msg = "activated"
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Cron job %s successfully", msg), map[string]any{
		"jobId":  jobId,
		"active": *body.Active,
	})
	h.emitDatabaseEvent(pid, "toggle_cron_job", "cron.job", map[string]any{
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

	jobIdStr := r.PathValue("jobId")
	jobId, err := strconv.Atoi(jobIdStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid job ID format")
		return
	}

	// Check job exists
	var jobExists bool
	pc.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobid = $1)`, jobId).Scan(&jobExists)
	if !jobExists {
		httputil.WriteError(w, http.StatusNotFound, fmt.Sprintf("Cron job with ID %d not found", jobId))
		return
	}

	var unscheduled bool
	pc.QueryRow(r.Context(), `SELECT cron.unschedule($1)`, jobId).Scan(&unscheduled)
	if !unscheduled {
		httputil.WriteError(w, http.StatusNotFound, fmt.Sprintf("Failed to unschedule cron job %d", jobId))
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Cron job deleted successfully", map[string]any{"jobId": jobId})
	h.emitDatabaseEvent(pid, "delete_cron_job", "cron.job", map[string]any{
		"jobId": jobId,
	}, nil)
}
