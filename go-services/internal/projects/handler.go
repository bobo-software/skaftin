package projects

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves project management endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new projects Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/projects
	// - POST   /api/v2/projects
	// - GET    /api/v2/projects/:id
	// - PUT    /api/v2/projects/:id
	// - DELETE /api/v2/projects/:id
	// - GET    /api/v2/projects/:id/dashboard
}
