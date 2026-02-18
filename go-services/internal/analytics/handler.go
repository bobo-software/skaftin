package analytics

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves project analytics endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new analytics Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET /api/v2/analytics/overview
	// - GET /api/v2/analytics/api-metrics
	// - GET /api/v2/analytics/db-metrics
	// - GET /api/v2/analytics/storage-metrics
}
