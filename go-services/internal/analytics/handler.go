package analytics

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves project analytics endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new analytics Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers all analytics routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/analytics/{projectId}/overview", h.GetOverview)
	mux.HandleFunc("GET /api/analytics/{projectId}/api", h.GetAPIMetrics)
	mux.HandleFunc("GET /api/analytics/{projectId}/database", h.GetDatabaseMetrics)
	mux.HandleFunc("GET /api/analytics/{projectId}/storage", h.GetStorageMetrics)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func queryDays(r *http.Request) int {
	if v, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && v > 0 {
		return v
	}
	return 7
}

func queryGroupBy(r *http.Request) string {
	return r.URL.Query().Get("groupBy")
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// GetOverview handles GET /api/analytics/{projectId}/overview
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	days := queryDays(r)

	result, err := h.service.GetOverview(r.Context(), pid, days)
	if err != nil {
		slog.Error("failed to get overview metrics", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get overview metrics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Overview metrics retrieved successfully", result)
}

// GetAPIMetrics handles GET /api/analytics/{projectId}/api
func (h *Handler) GetAPIMetrics(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	days := queryDays(r)
	groupBy := queryGroupBy(r)

	result, err := h.service.GetAPIMetrics(r.Context(), pid, days, groupBy)
	if err != nil {
		slog.Error("failed to get API metrics", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get API metrics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "API metrics retrieved successfully", result)
}

// GetDatabaseMetrics handles GET /api/analytics/{projectId}/database
func (h *Handler) GetDatabaseMetrics(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	days := queryDays(r)
	groupBy := queryGroupBy(r)

	result, err := h.service.GetDatabaseMetrics(r.Context(), pid, days, groupBy)
	if err != nil {
		slog.Error("failed to get database metrics", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get database metrics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Database metrics retrieved successfully", result)
}

// GetStorageMetrics handles GET /api/analytics/{projectId}/storage
func (h *Handler) GetStorageMetrics(w http.ResponseWriter, r *http.Request) {
	if auth.RequireUser(w, r) == nil {
		return
	}
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}

	days := queryDays(r)
	groupBy := queryGroupBy(r)

	result, err := h.service.GetStorageMetrics(r.Context(), pid, days, groupBy)
	if err != nil {
		slog.Error("failed to get storage metrics", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get storage metrics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Storage metrics retrieved successfully", result)
}
