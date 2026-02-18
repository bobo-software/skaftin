package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves health check endpoints.
type Handler struct {
	pool *pgxpool.Pool
}

// NewHandler creates a new health Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

// RegisterRoutes registers this domain's routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v2/health", h.Health)
}

// Health returns the service health status including database connectivity.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	dbStatus := "ok"
	if err := h.pool.Ping(ctx); err != nil {
		dbStatus = "error: " + err.Error()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"service":  "skaftin-go-service",
			"status":   "ok",
			"database": dbStatus,
			"time":     time.Now().UTC().Format(time.RFC3339),
		},
	})
}
