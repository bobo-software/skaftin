package payments

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves payment provider endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new payments Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET    /api/v2/payments/providers
	// - POST   /api/v2/payments/providers
	// - POST   /api/v2/payments/initiate
	// - POST   /api/v2/payments/webhooks/:provider
}
