package dbproxy

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves project database operation endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new dbproxy Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/db/tables
	// - POST   /api/v2/db/tables
	// - PUT    /api/v2/db/tables/:table
	// - DELETE /api/v2/db/tables/:table
	// - POST   /api/v2/db/query
	// - POST   /api/v2/db/import
	// - GET    /api/v2/db/export
	// - GET    /api/v2/db/cron
}
