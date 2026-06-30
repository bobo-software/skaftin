package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/platformauth"
)

func registerAPIGatewayRoutes(mux *http.ServeMux, pool *pgxpool.Pool) {
	v2Mux := http.NewServeMux()
	mux.Handle("/api/v2/", auth.APIKey(pool)(v2Mux))
}

func registerProxyRoutes(
	mux *http.ServeMux,
	pool *pgxpool.Pool,
	requestLogger *middleware.RequestLogger,
	platformAuthHandler *platformauth.Handler,
) {
	// Auth routes: owned by Go platform auth handlers.
	mux.Handle("/auth/", platformAuthHandler)

	// Platform API fallback: unknown paths return explicit Go 404.
	mux.Handle("/api/", appAPINotFoundHandler("/api/"))

	// Client API fallback: unknown paths return explicit Go 404.
	mux.Handle("/app-api/", auth.APIKey(pool)(requestLogger.Middleware(appAPINotFoundHandler("/app-api/"))))
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
