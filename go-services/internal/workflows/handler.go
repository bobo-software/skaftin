package workflows

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves workflow engine endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new workflows Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/workflows
	// - POST   /api/v2/workflows
	// - GET    /api/v2/workflows/:id
	// - PUT    /api/v2/workflows/:id
	// - DELETE /api/v2/workflows/:id
	// - POST   /api/v2/workflows/:id/execute
	// - POST   /api/v2/workflows/:id/schedule
}
