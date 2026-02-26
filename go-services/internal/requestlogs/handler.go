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

// RegisterAppAPIRoutes registers app-api compatibility routes.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /app-api/request-logs/{projectId}", h.CreateLog)
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

func (h *Handler) CreateLog(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		Method         string `json:"method"`
		URL            string `json:"url"`
		StatusCode     *int   `json:"status_code"`
		RequestPayload any    `json:"request_payload"`
		ResponseData   any    `json:"response_data"`
		ErrorMessage   string `json:"error_message"`
		DurationMS     *int   `json:"duration_ms"`
		UserID         *int   `json:"user_id"`
		IPAddress      string `json:"ip_address"`
		UserAgent      string `json:"user_agent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Method == "" || body.URL == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Method and URL are required")
		return
	}

	var requestPayload json.RawMessage
	var responseData json.RawMessage
	if body.RequestPayload != nil {
		marshaled, err := json.Marshal(body.RequestPayload)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "Invalid request_payload")
			return
		}
		requestPayload = marshaled
	}
	if body.ResponseData != nil {
		marshaled, err := json.Marshal(body.ResponseData)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "Invalid response_data")
			return
		}
		responseData = marshaled
	}

	var errorMessage *string
	if body.ErrorMessage != "" {
		errorMessage = &body.ErrorMessage
	}
	var ipAddress *string
	if body.IPAddress != "" {
		ipAddress = &body.IPAddress
	} else if r.RemoteAddr != "" {
		ra := r.RemoteAddr
		ipAddress = &ra
	}
	var userAgent *string
	if body.UserAgent != "" {
		userAgent = &body.UserAgent
	} else if ua := r.UserAgent(); ua != "" {
		userAgent = &ua
	}

	input := CreateLogInput{
		ProjectID:      pid,
		Method:         body.Method,
		URL:            body.URL,
		StatusCode:     body.StatusCode,
		RequestPayload: requestPayload,
		ResponseData:   responseData,
		ErrorMessage:   errorMessage,
		DurationMs:     body.DurationMS,
		UserID:         body.UserID,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}

	enabled, err := h.service.IsLoggingEnabled(r.Context(), pid)
	if err != nil {
		httputil.WriteSuccess(w, http.StatusOK, "Logging failed but continuing", map[string]any{
			"logged": false,
			"error":  err.Error(),
		})
		return
	}
	if !enabled {
		httputil.WriteSuccess(w, http.StatusOK, "Logging disabled for this project", map[string]any{
			"logged": false,
		})
		return
	}

	logID, err := h.service.CreateLog(r.Context(), input)
	if err != nil {
		// Keep request logging non-blocking for client apps.
		httputil.WriteSuccess(w, http.StatusOK, "Logging failed but continuing", map[string]any{
			"logged": false,
			"error":  err.Error(),
		})
		return
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Request logged successfully", map[string]any{
		"logged": true,
		"log_id": logID,
	})
}

