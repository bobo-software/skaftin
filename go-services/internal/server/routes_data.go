package server

import (
	"net/http"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/analytics"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/credentials"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/files"
	gqlhandler "github.com/skaftin/go-services/internal/graphql"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/migrations"
	"github.com/skaftin/go-services/internal/orgs"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/requestlogs"
	"github.com/skaftin/go-services/internal/storage"
	"github.com/skaftin/go-services/internal/users"
)

func registerDataRoutes(
	mux *http.ServeMux,
	cfg *config.Config,
	pool *pgxpool.Pool,
	jwks *auth.JWKSProvider,
	requestLogger *middleware.RequestLogger,
	dbHandler *dbproxy.Handler,
	projectsHandler *projects.Handler,
	orgsHandler *orgs.Handler,
	requestLogsHandler *requestlogs.Handler,
	storageHandler *storage.Handler,
	analyticsHandler *analytics.Handler,
	credentialsHandler *credentials.Handler,
	usersHandler *users.Handler,
) error {
	// Database routes also require project access verification middleware.
	dbMux := http.NewServeMux()
	dbHandler.RegisterRoutes(dbMux)
	mux.Handle("/api/database/", auth.JWTAuth(jwks)(auth.VerifyProjectAccess(pool)(dbMux)))

	// Client-facing database routes (project from API-key auth context).
	appDBMux := http.NewServeMux()
	dbHandler.RegisterAppAPIRoutes(appDBMux)
	mux.Handle("/app-api/database/", auth.APIKey(pool)(requestLogger.Middleware(appDBMux)))

	mountJWT(mux, "/api/projects/", jwks, projectsHandler.RegisterRoutes)
	mountJWT(mux, "/api/organizations/", jwks, orgsHandler.RegisterRoutes)
	mountJWT(mux, "/api/request-logs/", jwks, requestLogsHandler.RegisterRoutes)
	mountJWT(mux, "/api/storage/", jwks, storageHandler.RegisterRoutes)

	// Client-facing storage routes (project from API-key auth context).
	appStorageMux := http.NewServeMux()
	storageHandler.RegisterAppAPIRoutes(appStorageMux)
	mux.Handle("/app-api/storage/", auth.APIKey(pool)(requestLogger.Middleware(appStorageMux)))

	mountJWT(mux, "/api/analytics/", jwks, analyticsHandler.RegisterRoutes)
	mountJWT(mux, "/api/credentials/", jwks, credentialsHandler.RegisterRoutes)
	mountJWT(mux, "/api/users/", jwks, usersHandler.RegisterRoutes)

	graphqlHandler, err := gqlhandler.NewHandler(pool)
	if err != nil {
		return err
	}
	mountJWT(mux, "/api/graphql", jwks, graphqlHandler.RegisterRoutes)

	filesHandler := files.NewHandler(storageHandler.S3(), cfg.MinioBucket)
	mountJWT(mux, "/api/files/", jwks, filesHandler.RegisterRoutes)

	migrationsDir := filepath.Join(cfg.NodeWorkDir, "migrations")
	migrationsHandler := migrations.NewHandler(pool, migrationsDir)
	mountJWT(mux, "/api/migrations/", jwks, migrationsHandler.RegisterRoutes)
	return nil
}
