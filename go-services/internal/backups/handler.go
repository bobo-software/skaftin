package backups

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves backup and restore endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new backups Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - POST   /api/v2/backups
	// - GET    /api/v2/backups
	// - GET    /api/v2/backups/:id/download
	// - POST   /api/v2/backups/:id/restore
	// - GET    /api/v2/backups/schedules
	// - POST   /api/v2/backups/schedules
}
