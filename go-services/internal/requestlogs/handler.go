package requestlogs

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves request log endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new request logs Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers all request log routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/request-logs/{projectId}/settings", h.GetSettings)
	mux.HandleFunc("PUT /api/request-logs/{projectId}/settings", h.UpdateSettings)
	mux.HandleFunc("POST /api/request-logs/{projectId}/stats", h.GetStats)
	mux.HandleFunc("GET /api/request-logs/{projectId}/{logId}", h.GetLog)
	mux.HandleFunc("GET /api/request-logs/{projectId}", h.ListLogs)
	mux.HandleFunc("DELETE /api/request-logs/{projectId}", h.Cleanup)
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	settings, err := h.service.GetSettings(r.Context(), pid)
	if err != nil {
		slog.Error("failed to get request log settings", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to retrieve settings")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request logging settings", settings)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		RequestLoggingEnabled *bool   `json:"request_logging_enabled"`
		RequestLogRetention   *string `json:"request_log_retention"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	settings, err := h.service.UpdateSettings(r.Context(), pid, body.RequestLoggingEnabled, body.RequestLogRetention)
	if err != nil {
		switch err.Error() {
		case "invalid retention":
			httputil.WriteError(w, http.StatusBadRequest, "Invalid retention value. Must be: daily, weekly, monthly, or disabled")
		case "not found":
			httputil.WriteError(w, http.StatusNotFound, "Project settings not found")
		default:
			slog.Error("failed to update request log settings", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update settings")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request logging settings updated", settings)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		Hours int `json:"hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body.Hours = 24
	}

	stats, err := h.service.GetStats(r.Context(), pid, body.Hours)
	if err != nil {
		slog.Error("failed to get request log stats", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to retrieve stats")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request log stats retrieved", stats)
}

func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	q := r.URL.Query()
	filters := LogFilters{
		Limit:    httputil.IntQuery(q.Get("limit"), 50),
		Offset:   httputil.IntQuery(q.Get("offset"), 0),
		HasError: q.Get("has_error") == "true",
	}

	if v := q.Get("status_code"); v != "" {
		if sc, err := strconv.Atoi(v); err == nil {
			filters.StatusCode = &sc
		}
	}
	if v := q.Get("method"); v != "" {
		filters.Method = &v
	}
	if v := q.Get("start_date"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.StartDate = &t
		}
	}
	if v := q.Get("end_date"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.EndDate = &t
		}
	}

	result, err := h.service.ListLogs(r.Context(), pid, filters)
	if err != nil {
		slog.Error("failed to list request logs", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to retrieve request logs")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request logs retrieved", result)
}

func (h *Handler) GetLog(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	logID, err := strconv.Atoi(r.PathValue("logId"))
	if err != nil || logID <= 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid log ID")
		return
	}

	logEntry, err := h.service.GetLog(r.Context(), pid, logID)
	if err != nil {
		slog.Error("failed to get request log", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to retrieve request log")
		return
	}
	if logEntry == nil {
		httputil.WriteError(w, http.StatusNotFound, "Log not found")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request log retrieved", logEntry)
}

func (h *Handler) Cleanup(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	olderThanDays := httputil.IntQuery(r.URL.Query().Get("older_than_days"), 7)

	deleted, cutoff, err := h.service.Cleanup(r.Context(), pid, olderThanDays)
	if err != nil {
		slog.Error("failed to cleanup request logs", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to cleanup request logs")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Request logs cleaned up", map[string]any{
		"deleted_count": deleted,
		"cutoff_date":   cutoff.UTC().Format(time.RFC3339),
	})
}

