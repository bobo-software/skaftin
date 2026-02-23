package mcp

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/projects"
)

// Server wraps the MCP protocol server with Skaftin tool registrations.
type Server struct {
	inner *mcp.Server
}

// New creates a new MCP server with all tools registered.
func New(pool *pgxpool.Pool) *Server {
	srv := mcp.NewServer(
		&mcp.Implementation{
			Name:    "skaftin-mcp-server",
			Version: "1.0.0",
		},
		nil,
	)

	dbService := dbproxy.NewService(pool)
	projectStore := projects.NewStore(pool)

	registerDatabaseTools(srv, pool, dbService)
	registerProjectTools(srv, pool, projectStore)
	registerStorageTools(srv, pool)
	registerAuthTools(srv, pool, dbService)
	registerCredentialsTools(srv, pool)
	registerGraphQLTools(srv, pool, dbService)
	registerCommunicationsTools(srv, pool)
	registerBulkTools(srv, pool, dbService)

	return &Server{inner: srv}
}

// Run starts the MCP server on stdio transport (stdin/stdout).
func (s *Server) Run(ctx context.Context) error {
	return s.inner.Run(ctx, &mcp.StdioTransport{})
}
