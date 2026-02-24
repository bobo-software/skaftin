package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	mcpserver "github.com/skaftin/go-services/internal/mcp"
)

func registerMCPRoutes(
	mux *http.ServeMux,
	pool *pgxpool.Pool,
	jwks *auth.JWKSProvider,
	adminHandler *mcpserver.HTTPHandler,
	clientHandler *mcpserver.HTTPHandler,
) {
	adminMux := http.NewServeMux()
	adminHandler.RegisterRoutes(adminMux, "/api/mcp")
	mux.Handle("/api/mcp/", auth.JWTAuth(jwks)(adminMux))

	clientMux := http.NewServeMux()
	clientHandler.RegisterRoutes(clientMux, "/app-api/mcp")
	mux.Handle("/app-api/mcp/", auth.APIKey(pool)(clientMux))
}
