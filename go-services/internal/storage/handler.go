package storage

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves project object storage (MinIO) endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new storage Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// TODO: migrate from Node.js
	// - GET  /api/v2/storage/buckets
	// - POST /api/v2/storage/upload
	// - GET  /api/v2/storage/download/:key
	// - DELETE /api/v2/storage/delete/:key
	// - GET  /api/v2/storage/search
}
