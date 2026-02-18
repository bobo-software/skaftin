package credentials

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves API key and access token management endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new credentials Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/credentials
	// - POST   /api/v2/credentials
	// - PUT    /api/v2/credentials/:id
	// - DELETE /api/v2/credentials/:id
	// - POST   /api/v2/credentials/mcp
	// - DELETE /api/v2/credentials/mcp/:id
}
