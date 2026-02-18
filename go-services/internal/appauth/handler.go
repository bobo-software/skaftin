package appauth

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves app-user authentication endpoints (client-facing).
type Handler struct {
	service *Service
}

// NewHandler creates a new appauth Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - POST /api/v2/appauth/register
	// - POST /api/v2/appauth/login
	// - POST /api/v2/appauth/otp/send
	// - POST /api/v2/appauth/otp/verify
	// - POST /api/v2/appauth/logout
	// - DELETE /api/v2/appauth/account
}
