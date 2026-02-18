package communications

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves email and SMS communication endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new communications Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - POST /api/v2/communications/email/send
	// - POST /api/v2/communications/sms/send
	// - GET  /api/v2/communications/providers
	// - POST /api/v2/communications/providers
	// - GET  /api/v2/communications/templates
	// - POST /api/v2/communications/templates
}
