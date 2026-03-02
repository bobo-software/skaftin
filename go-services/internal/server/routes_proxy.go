package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/middleware"
)

func registerAPIGatewayRoutes(mux *http.ServeMux, pool *pgxpool.Pool, jwks *auth.JWKSProvider, nodeHandler http.Handler) {
	v2Mux := http.NewServeMux()
	mux.Handle("/api/v2/", auth.APIKey(pool)(v2Mux))
}

func registerProxyRoutes(mux *http.ServeMux, pool *pgxpool.Pool, jwks *auth.JWKSProvider, requestLogger *middleware.RequestLogger, nodeHandler http.Handler) {
	// Auth routes: pass through with NO auth check
	mux.Handle("/auth/", nodeHandler)

	// Platform API routes: validate JWT, then proxy to Node.js
	mux.Handle("/api/", auth.JWTAuth(jwks)(nodeHandler))

	// Client API routes: validate API key, then proxy to Node.js
	// Keep this catch-all LAST after specific /app-api/... Go routes.
	mux.Handle("/app-api/", auth.APIKey(pool)(requestLogger.Middleware(nodeHandler)))

	// Public client API routes: validate API key, then proxy to Node.js.
	// Keep this catch-all LAST after specific /app-api-2/... Go routes.
	mux.Handle("/app-api-2/", auth.APIKey(pool)(requestLogger.Middleware(nodeHandler)))

	// Socket.IO: pass through (handles its own auth)
	mux.Handle("/socket.io/", nodeHandler)
}
