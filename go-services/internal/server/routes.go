package server

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/gateway"
	"github.com/skaftin/go-services/internal/health"
)

// RegisterRoutes wires all domain handlers and proxy routes onto the mux.
func RegisterRoutes(mux *http.ServeMux, cfg *config.Config, pool *pgxpool.Pool) error {
	// ---- JWKS provider for JWT validation ----
	jwks := auth.NewJWKSProvider(cfg.SuperTokensCoreURL)
	slog.Info("JWKS provider initialized", "supertokensCoreURL", cfg.SuperTokensCoreURL)

	// ---- Node.js reverse proxy ----
	nodeProxy, err := gateway.NewReverseProxy(cfg.NodeBackendURL)
	if err != nil {
		return err
	}
	nodeHandler := gateway.WebSocketAwareHandler(nodeProxy, cfg.NodeBackendURL)
	slog.Info("reverse proxy initialized", "nodeBackendURL", cfg.NodeBackendURL)

	// ---- Domain handlers ----
	healthHandler := health.NewHandler(pool)

	// ==================================================================
	// PUBLIC ROUTES (no auth required)
	// ==================================================================
	healthHandler.RegisterRoutes(mux)

	// ==================================================================
	// GO-HANDLED ROUTES (API key / access token auth)
	// ==================================================================
	v2Mux := http.NewServeMux()
	mux.Handle("/api/v2/", auth.APIKey(pool)(v2Mux))

	// ==================================================================
	// PROXIED ROUTES (forwarded to Node.js)
	// ==================================================================

	// Auth routes: pass through with NO auth check
	mux.Handle("/auth/", nodeHandler)

	// Platform API routes: validate JWT, then proxy to Node.js
	mux.Handle("/api/", auth.JWTAuth(jwks)(nodeHandler))

	// Client API routes: validate API key, then proxy to Node.js
	mux.Handle("/app-api/", auth.APIKey(pool)(nodeHandler))

	// Socket.IO: pass through (handles its own auth)
	mux.Handle("/socket.io/", nodeHandler)

	return nil
}
