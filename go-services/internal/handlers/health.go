package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	pool *pgxpool.Pool
}

func NewHealthHandler(pool *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{pool: pool}
}

// Health returns the service health status including database connectivity.
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
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
