package requestlogs

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
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

// RegisterAppAPIRoutes registers client-facing request log routes.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /app-api/request-logs/{projectId}", h.CreateLog)
}

func clientProjectID(r *http.Request) (int, bool) {
	if authCtx := auth.GetAuthContext(r); authCtx != nil && authCtx.ProjectID > 0 {
		return authCtx.ProjectID, true
	}
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func truncateJSONPayload(raw json.RawMessage, maxSize int) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	if len(raw) <= maxSize {
		return raw
	}
	preview := string(raw[:maxSize])
	meta := map[string]any{
		"_truncated":     true,
		"_original_size": len(raw),
		"_preview":       preview,
	}
	out, err := json.Marshal(meta)
	if err != nil {
		return raw[:maxSize]
	}
	return out
}

func bestEffortClientIP(r *http.Request) *string {
	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return &ip
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return &host
	}
	if strings.TrimSpace(r.RemoteAddr) != "" {
		ip := strings.TrimSpace(r.RemoteAddr)
		return &ip
	}
	return nil
}

func (h *Handler) CreateLog(w http.ResponseWriter, r *http.Request) {
	pid, ok := clientProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
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

	var body struct {
		Method         string          `json:"method"`
		URL            string          `json:"url"`
		StatusCode     *int            `json:"status_code"`
		RequestPayload json.RawMessage `json:"request_payload"`
		ResponseData   json.RawMessage `json:"response_data"`
		ErrorMessage   *string         `json:"error_message"`
		DurationMs     *int            `json:"duration_ms"`
		UserID         *int            `json:"user_id"`
		IPAddress      *string         `json:"ip_address"`
		UserAgent      *string         `json:"user_agent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(body.Method) == "" || strings.TrimSpace(body.URL) == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Method and URL are required")
		return
	}

	ipAddress := body.IPAddress
	if ipAddress == nil || strings.TrimSpace(*ipAddress) == "" {
		ipAddress = bestEffortClientIP(r)
	}
	userAgent := body.UserAgent
	if userAgent == nil || strings.TrimSpace(*userAgent) == "" {
		ua := strings.TrimSpace(r.UserAgent())
		if ua != "" {
			userAgent = &ua
		}
	}

	logID, err := h.service.CreateLog(r.Context(), CreateLogInput{
		ProjectID:      pid,
		Method:         strings.ToUpper(strings.TrimSpace(body.Method)),
		URL:            body.URL,
		StatusCode:     body.StatusCode,
		RequestPayload: truncateJSONPayload(body.RequestPayload, 10000),
		ResponseData:   truncateJSONPayload(body.ResponseData, 10000),
		ErrorMessage:   body.ErrorMessage,
		DurationMs:     body.DurationMs,
		UserID:         body.UserID,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	})
	if err != nil {
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
	if v := strings.TrimSpace(q.Get("url")); v != "" {
		filters.URLSearch = &v
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


