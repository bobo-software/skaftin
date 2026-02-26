package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/admin"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/authmanagement"
	"github.com/skaftin/go-services/internal/middleware"
)

func registerAuthAndAdminRoutes(
	mux *http.ServeMux,
	pool *pgxpool.Pool,
	jwks *auth.JWKSProvider,
	requestLogger *middleware.RequestLogger,
	authMgmtHandler *authmanagement.Handler,
	adminHandler *admin.Handler,
) {
	// Auth management: app auth (public) + management (JWT + project access)
	legacyAuthMux := http.NewServeMux()
	authMgmtHandler.RegisterLegacyCompatibilityRoutes(legacyAuthMux)
	mux.Handle("/api/auth/login", legacyAuthMux)
	mux.Handle("/api/auth/register", legacyAuthMux)
	mux.Handle("/api/auth/verify", legacyAuthMux)
	mux.Handle("/api/auth/refresh", legacyAuthMux)
	mux.Handle("/api/auth/logout", legacyAuthMux)

	authPublicMux := http.NewServeMux()
	authMgmtHandler.RegisterPublicRoutes(authPublicMux)
	mux.Handle("/api/auth/{projectId}/auth/", authPublicMux)

	authProtectedMux := http.NewServeMux()
	authMgmtHandler.RegisterProtectedRoutes(authProtectedMux)
	mux.Handle("/api/auth/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/auth/")(authProtectedMux)))

	// App API auth routes: keep legacy URL shapes and serve from Go.
	appAPICompatMux := http.NewServeMux()
	authMgmtHandler.RegisterAppAPIRoutes(appAPICompatMux)
	mux.Handle("/app-api/auth/", auth.APIKey(pool)(requestLogger.Middleware(appAPICompatMux)))

	// Admin: public email check + protected admin operations.
	adminPublicMux := http.NewServeMux()
	adminHandler.RegisterPublicRoutes(adminPublicMux)
	mux.Handle("/api/admin/users/check-email", adminPublicMux)

	adminProtectedMux := http.NewServeMux()
	adminHandler.RegisterProtectedRoutes(adminProtectedMux)
	mux.Handle("/api/admin/", auth.JWTAuth(jwks)(adminProtectedMux))
}
