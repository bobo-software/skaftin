package server

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/platformauth"
)

func registerAPIGatewayRoutes(mux *http.ServeMux, pool *pgxpool.Pool, jwks *auth.JWKSProvider, nodeHandler http.Handler) {
	v2Mux := http.NewServeMux()
	mux.Handle("/api/v2/", auth.APIKey(pool)(v2Mux))
}

func registerProxyRoutes(
	mux *http.ServeMux,
	cfg *config.Config,
	pool *pgxpool.Pool,
	jwks *auth.JWKSProvider,
	requestLogger *middleware.RequestLogger,
	nodeHandler http.Handler,
	platformAuthHandler *platformauth.Handler,
) {
	// Auth routes: owned by Go platform auth handlers.
	mux.Handle("/auth/", platformAuthHandler)

	// Platform API routes: validate JWT, then proxy to Node.js
	mux.Handle("/api/", auth.JWTAuth(jwks)(nodeHandler))

	// Client API routes: route fallback behavior is feature-gated so Go-only
	// cutovers can disable pass-through while still allowing quick rollback.
	if cfg.AppAPIProxyFallbackEnabled {
		mux.Handle("/app-api/", auth.APIKey(pool)(requestLogger.Middleware(appAPIFallbackProxyHandler(nodeHandler, "/app-api/"))))
	} else {
		mux.Handle("/app-api/", auth.APIKey(pool)(requestLogger.Middleware(appAPINotFoundHandler("/app-api/"))))
	}

	// Public client API v2 is Go-only: unknown paths return a standardized Go 404.
	mux.Handle("/app-api-2/", auth.APIKey(pool)(requestLogger.Middleware(appAPINotFoundHandler("/app-api-2/"))))

}

func appAPIFallbackProxyHandler(nodeHandler http.Handler, routePrefix string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var projectID any = "unknown"
		if authCtx := auth.GetAuthContext(r); authCtx != nil {
			projectID = authCtx.ProjectID
		}

		slog.Warn("app-api fallback proxy hit",
			"routePrefix", routePrefix,
			"method", r.Method,
			"path", r.URL.Path,
			"projectId", projectID,
			"userAgent", r.UserAgent(),
			"remoteAddr", r.RemoteAddr,
		)

		nodeHandler.ServeHTTP(w, r)
	})
}

func appAPINotFoundHandler(routePrefix string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httputil.WriteError(
			w,
			http.StatusNotFound,
			"Route not available in Go gateway: "+r.Method+" "+r.URL.Path+" (prefix "+routePrefix+")",
		)
	})
}
