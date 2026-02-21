package server

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/analytics"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/credentials"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/gateway"
	"github.com/skaftin/go-services/internal/health"
	"github.com/skaftin/go-services/internal/orgs"
	"github.com/skaftin/go-services/internal/payments"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/requestlogs"
	"github.com/skaftin/go-services/internal/storage"
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
	dbHandler := dbproxy.NewHandler(pool)
	projectsHandler, err := projects.NewHandler(pool, cfg)
	if err != nil {
		return err
	}
	orgsHandler := orgs.NewHandler(pool)
	requestLogsHandler := requestlogs.NewHandler(pool)
	analyticsHandler := analytics.NewHandler(pool)
	storageHandler, err := storage.NewHandler(pool, cfg)
	if err != nil {
		return err
	}
	credentialsHandler := credentials.NewHandler(pool)
	communicationsHandler := communications.NewHandler(pool)
	paymentsHandler := payments.NewHandler(pool)

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
	// GO-HANDLED DOMAIN ROUTES (JWT auth, registered before catch-all)
	// ==================================================================

	// Database routes also require project access verification middleware.
	dbMux := http.NewServeMux()
	dbHandler.RegisterRoutes(dbMux)
	mux.Handle("/api/database/", auth.JWTAuth(jwks)(auth.VerifyProjectAccess(pool)(dbMux)))

	mountJWT(mux, "/api/projects/", jwks, projectsHandler.RegisterRoutes)
	mountJWT(mux, "/api/organizations/", jwks, orgsHandler.RegisterRoutes)
	mountJWT(mux, "/api/request-logs/", jwks, requestLogsHandler.RegisterRoutes)
	mountJWT(mux, "/api/storage/", jwks, storageHandler.RegisterRoutes)
	mountJWT(mux, "/api/analytics/", jwks, analyticsHandler.RegisterRoutes)
	mountJWT(mux, "/api/credentials/", jwks, credentialsHandler.RegisterRoutes)

	communicationsPublicMux := http.NewServeMux()
	communicationsHandler.RegisterPublicRoutes(communicationsPublicMux)
	mux.Handle("/api/communications/{projectId}/sms/webhook", communicationsPublicMux)

	communicationsProjectMux := http.NewServeMux()
	communicationsHandler.RegisterProjectRoutes(communicationsProjectMux)
	mux.Handle("/api/communications/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/communications/")(communicationsProjectMux)))

	// Payments webhook routes are public and handled by Go.
	paymentsWebhookMux := http.NewServeMux()
	paymentsHandler.RegisterWebhookRoutes(paymentsWebhookMux)
	mux.Handle("/api/payments/webhook/", paymentsWebhookMux)

	paymentsSessionMux := http.NewServeMux()
	paymentsHandler.RegisterSessionRoutes(paymentsSessionMux)
	mux.Handle("/api/payments/handle_fnb_payment", auth.JWTAuth(jwks)(paymentsSessionMux))

	paymentsProjectMux := http.NewServeMux()
	paymentsHandler.RegisterProjectRoutes(paymentsProjectMux)
	mux.Handle("/api/payments/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/payments/")(paymentsProjectMux)))

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

// mountJWT creates a sub-mux, registers routes on it, and mounts it under
// the given pattern with JWT authentication middleware.
func mountJWT(mux *http.ServeMux, pattern string, jwks *auth.JWKSProvider, register func(*http.ServeMux)) {
	sub := http.NewServeMux()
	register(sub)
	mux.Handle(pattern, auth.JWTAuth(jwks)(sub))
}
