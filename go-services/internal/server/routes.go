package server

import (
	"context"
	"log/slog"
	"net/http"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/analytics"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/authmanagement"
	"github.com/skaftin/go-services/internal/backups"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/credentials"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/files"
	"github.com/skaftin/go-services/internal/gateway"
	gqlhandler "github.com/skaftin/go-services/internal/graphql"
	"github.com/skaftin/go-services/internal/health"
	"github.com/skaftin/go-services/internal/invitations"
	"github.com/skaftin/go-services/internal/migrations"
	"github.com/skaftin/go-services/internal/orgs"
	"github.com/skaftin/go-services/internal/payments"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/requestlogs"
	"github.com/skaftin/go-services/internal/storage"
	"github.com/skaftin/go-services/internal/supertokens"
	"github.com/skaftin/go-services/internal/users"
)

// RegisterRoutes wires all domain handlers and proxy routes onto the mux.
// The returned function should be called during graceful shutdown to stop
// background services (e.g. the backup scheduler).
func RegisterRoutes(mux *http.ServeMux, cfg *config.Config, pool *pgxpool.Pool) (func(), error) {
	// ---- JWKS provider for JWT validation ----
	jwks := auth.NewJWKSProvider(cfg.SuperTokensCoreURL)
	slog.Info("JWKS provider initialized", "supertokensCoreURL", cfg.SuperTokensCoreURL)

	// ---- Node.js reverse proxy ----
	nodeProxy, err := gateway.NewReverseProxy(cfg.NodeBackendURL)
	if err != nil {
		return nil, err
	}
	nodeHandler := gateway.WebSocketAwareHandler(nodeProxy, cfg.NodeBackendURL)
	slog.Info("reverse proxy initialized", "nodeBackendURL", cfg.NodeBackendURL)

	// ---- Domain handlers ----
	healthHandler := health.NewHandler(pool)
	dbHandler := dbproxy.NewHandler(pool)
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
	invitationsHandler := invitations.NewHandler(pool, communicationsHandler.Service(), cfg.FrontendURL)
	paymentsHandler := payments.NewHandler(pool)
	stClient := supertokens.NewClient(cfg.SuperTokensCoreURL, cfg.SuperTokensAPIKey)
	usersHandler := users.NewHandler(pool, stClient)

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
	mountJWT(mux, "/api/users/", jwks, usersHandler.RegisterRoutes)

	graphqlHandler, err := gqlhandler.NewHandler(pool)
	if err != nil {
		return nil, err
	}
	mountJWT(mux, "/api/graphql", jwks, graphqlHandler.RegisterRoutes)

	filesHandler := files.NewHandler(storageHandler.S3(), cfg.MinioBucket)
	mountJWT(mux, "/api/files/", jwks, filesHandler.RegisterRoutes)

	migrationsDir := filepath.Join(cfg.NodeWorkDir, "migrations")
	migrationsHandler := migrations.NewHandler(pool, migrationsDir)
	mountJWT(mux, "/api/migrations/", jwks, migrationsHandler.RegisterRoutes)

	// Invitations: mixed auth (public, JWT-only, JWT+project)
	invitationsPublicMux := http.NewServeMux()
	invitationsHandler.RegisterPublicRoutes(invitationsPublicMux)
	mux.Handle("/api/invitations/code/", invitationsPublicMux)

	invitationsAuthMux := http.NewServeMux()
	invitationsHandler.RegisterAuthRoutes(invitationsAuthMux)
	mux.Handle("/api/invitations/accept/", auth.JWTAuth(jwks)(invitationsAuthMux))

	invitationsProjectMux := http.NewServeMux()
	invitationsHandler.RegisterProjectRoutes(invitationsProjectMux)
	mux.Handle("/api/invitations/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/invitations/")(invitationsProjectMux)))

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

	// Auth management: app auth (public) + management (JWT + project access)
	authMgmtHandler := authmanagement.NewHandler(pool, stClient, communicationsHandler.Service())

	authPublicMux := http.NewServeMux()
	authMgmtHandler.RegisterPublicRoutes(authPublicMux)
	mux.Handle("/api/auth/{projectId}/auth/", authPublicMux)

	authProtectedMux := http.NewServeMux()
	authMgmtHandler.RegisterProtectedRoutes(authProtectedMux)
	mux.Handle("/api/auth/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/auth/")(authProtectedMux)))

	// Backups: project-scoped routes (JWT + project access) + restore route (JWT only)
	projectsStore := projects.NewStore(pool)
	backupsHandler := backups.NewHandler(pool, storageHandler.S3(), cfg.MinioBucket, projectsStore)

	backupsMux := http.NewServeMux()
	backupsHandler.RegisterRoutes(backupsMux)
	mux.Handle("/api/backups/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/backups/")(backupsMux)))

	backupsRestoreMux := http.NewServeMux()
	backupsHandler.RegisterRestoreRoute(backupsRestoreMux)
	mux.Handle("/api/backups/restore", auth.JWTAuth(jwks)(backupsRestoreMux))

	scheduler := backups.NewScheduler(backupsHandler.Service())
	backupsHandler.SetScheduler(scheduler)
	if err := scheduler.LoadAll(context.Background()); err != nil {
		slog.Error("failed to load backup schedules", "error", err)
	}

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

	cleanup := func() {
		scheduler.Stop()
	}
	return cleanup, nil
}

// mountJWT creates a sub-mux, registers routes on it, and mounts it under
// the given pattern with JWT authentication middleware.
func mountJWT(mux *http.ServeMux, pattern string, jwks *auth.JWKSProvider, register func(*http.ServeMux)) {
	sub := http.NewServeMux()
	register(sub)
	mux.Handle(pattern, auth.JWTAuth(jwks)(sub))
}
