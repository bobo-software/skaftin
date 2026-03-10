package server

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/admin"
	"github.com/skaftin/go-services/internal/analytics"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/authmanagement"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/credentials"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/health"
	mcpserver "github.com/skaftin/go-services/internal/mcp"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/orgs"
	"github.com/skaftin/go-services/internal/payments"
	"github.com/skaftin/go-services/internal/platformauth"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/realtime"
	"github.com/skaftin/go-services/internal/requestlogs"
	"github.com/skaftin/go-services/internal/storage"
	"github.com/skaftin/go-services/internal/supertokens"
	"github.com/skaftin/go-services/internal/users"
)

// RegisterRoutes wires all domain handlers and proxy routes onto the mux.
// The returned function should be called during graceful shutdown to stop
// background services (e.g. the backup scheduler).
func RegisterRoutes(mux *http.ServeMux, cfg *config.Config, pool *pgxpool.Pool, requestLogger *middleware.RequestLogger) (func(), error) {
	// ---- JWKS provider for JWT validation ----
	jwks := auth.NewJWKSProvider(cfg.SuperTokensCoreURL)
	slog.Info("JWKS provider initialized", "supertokensCoreURL", cfg.SuperTokensCoreURL)

	// ---- Domain handlers ----
	healthHandler := health.NewHandler(pool)
	stClient := supertokens.NewClient(cfg.SuperTokensCoreURL, cfg.SuperTokensAPIKey)
	realtimeHub := realtime.NewHub()
	wsAllowedOrigins := buildWebSocketAllowedOrigins(cfg)
	realtimeHandler := realtime.NewHandler(realtimeHub, wsAllowedOrigins)
	realtimeClientHandler := realtime.NewAPIKeyHandler(realtimeHub, wsAllowedOrigins)
	dbHandler := dbproxy.NewHandler(pool, stClient, realtimeHub)
	projectsHandler, err := projects.NewHandler(pool, cfg)
	if err != nil {
		return nil, err
	}
	orgsHandler := orgs.NewHandler(pool)
	requestLogsHandler := requestlogs.NewHandler(pool)
	analyticsHandler := analytics.NewHandler(pool)
	storageHandler, err := storage.NewHandler(pool, cfg)
	if err != nil {
		return nil, err
	}
	credentialsHandler := credentials.NewHandler(pool)
	communicationsHandler := communications.NewHandler(pool)
	paymentsHandler := payments.NewHandler(pool)
	mcpSvc := mcpserver.New(pool)
	mcpHandler := mcpserver.NewHTTPHandler(mcpSvc, false)
	clientMCPHandler := mcpserver.NewHTTPHandler(mcpSvc, true)
	usersHandler := users.NewHandler(pool, stClient)
	adminHandler := admin.NewHandler(pool, stClient)
	platformAuthHandler := platformauth.NewHandler(pool, stClient)

	// ==================================================================
	// PUBLIC ROUTES (no auth required)
	// ==================================================================
	healthHandler.RegisterRoutes(mux)
	mux.Handle("/ws", realtimeHandler)
	mux.Handle("/app-api/ws", auth.APIKeyWebSocket(pool)(realtimeClientHandler))

	// ==================================================================
	// GO-HANDLED ROUTES (API key / access token auth)
	// ==================================================================
	registerAPIGatewayRoutes(mux, pool)

	// ==================================================================
	// GO-HANDLED DOMAIN ROUTES (JWT auth, registered before catch-all)
	// ==================================================================
	if err := registerDataRoutes(mux, cfg, pool, jwks, requestLogger, dbHandler, projectsHandler, orgsHandler, requestLogsHandler, storageHandler, analyticsHandler, credentialsHandler, usersHandler); err != nil {
		return nil, err
	}

	authMgmtHandler := authmanagement.NewHandler(pool, stClient, communicationsHandler.Service())
	registerAuthAndAdminRoutes(mux, pool, jwks, requestLogger, authMgmtHandler, adminHandler)
	registerMCPRoutes(mux, pool, jwks, requestLogger, mcpHandler, clientMCPHandler)

	opsCleanup, err := registerOperationalRoutes(mux, pool, cfg, jwks, requestLogger, stClient, communicationsHandler, paymentsHandler, storageHandler.S3())
	if err != nil {
		return nil, err
	}

	registerProxyRoutes(mux, pool, requestLogger, platformAuthHandler)
	return opsCleanup, nil
}

func buildWebSocketAllowedOrigins(cfg *config.Config) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, 4)
	add := func(origin string) {
		if origin == "" {
			return
		}
		if _, exists := seen[origin]; exists {
			return
		}
		seen[origin] = struct{}{}
		out = append(out, origin)
	}

	add(cfg.FrontendURL)
	for _, origin := range cfg.ClientAllowedOrigins {
		add(origin)
	}

	// Useful local-dev defaults when CLIENT_ALLOWED_ORIGINS is not set.
	add("http://localhost:3005")
	add("http://localhost:5173")
	add("http://localhost:5178")
	return out
}

// mountJWT creates a sub-mux, registers routes on it, and mounts it under
// the given pattern with JWT authentication middleware.
func mountJWT(mux *http.ServeMux, pattern string, jwks *auth.JWKSProvider, register func(*http.ServeMux)) {
	sub := http.NewServeMux()
	register(sub)
	mux.Handle(pattern, auth.JWTAuth(jwks)(sub))
}
