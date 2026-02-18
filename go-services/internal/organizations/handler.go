package organizations

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves multi-tenant organization endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new organizations Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/organizations
	// - POST   /api/v2/organizations
	// - PUT    /api/v2/organizations/:id
	// - DELETE /api/v2/organizations/:id
	// - POST   /api/v2/organizations/:id/members
	// - DELETE /api/v2/organizations/:id/members/:memberId
}
