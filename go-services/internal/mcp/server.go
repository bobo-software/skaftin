package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/projects"
)

// Server wraps the MCP protocol server with Skaftin tool registrations.
type Server struct {
	inner   *mcp.Server
	catalog *toolCatalog
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
	catalog := newToolCatalog()
	registrar := &dualRegistrar{server: srv, catalog: catalog}

	dbService := dbproxy.NewService(pool)
	projectStore := projects.NewStore(pool)

	registerDatabaseTools(registrar, pool, dbService)
	registerProjectTools(registrar, pool, projectStore)
	registerStorageTools(registrar, pool)
	registerAuthTools(registrar, pool, dbService)
	registerCredentialsTools(registrar, pool)
	registerGraphQLTools(registrar, pool, dbService)
	registerCommunicationsTools(registrar, pool)
	registerBulkTools(registrar, pool, dbService)

	return &Server{inner: srv, catalog: catalog}
}

// Run starts the MCP server on stdio transport (stdin/stdout).
func (s *Server) Run(ctx context.Context) error {
	return s.inner.Run(ctx, &mcp.StdioTransport{})
}

// ListTools returns registered tools, filtered for the client endpoint when requested.
func (s *Server) ListTools(clientEndpoint bool) []*mcp.Tool {
	if !clientEndpoint {
		return s.catalog.allTools()
	}
	return s.catalog.clientSafeTools()
}

// CallTool executes a tool by name with arbitrary JSON arguments.
func (s *Server) CallTool(ctx context.Context, name string, args map[string]any, clientEndpoint bool) (*mcp.CallToolResult, error) {
	if clientEndpoint && !s.catalog.isClientSafe(name) {
		return nil, fmt.Errorf("tool %q is not available on client endpoint", name)
	}

	handler, ok := s.catalog.handler(name)
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", name)
	}

	rawArgs, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("marshal arguments: %w", err)
	}

	return handler(ctx, &mcp.CallToolRequest{
		Params: &mcp.CallToolParamsRaw{
			Name:      name,
			Arguments: rawArgs,
		},
	})
}

type toolRegistrar interface {
	AddTool(t *mcp.Tool, h mcp.ToolHandler)
}

type dualRegistrar struct {
	server  *mcp.Server
	catalog *toolCatalog
}

func (d *dualRegistrar) AddTool(t *mcp.Tool, h mcp.ToolHandler) {
	d.server.AddTool(t, h)
	d.catalog.add(t, h)
}

type toolCatalog struct {
	order    []*mcp.Tool
	byName   map[string]*mcp.Tool
	handlers map[string]mcp.ToolHandler
}

func newToolCatalog() *toolCatalog {
	return &toolCatalog{
		order:    make([]*mcp.Tool, 0, 64),
		byName:   make(map[string]*mcp.Tool),
		handlers: make(map[string]mcp.ToolHandler),
	}
}

func (c *toolCatalog) add(t *mcp.Tool, h mcp.ToolHandler) {
	c.order = append(c.order, t)
	c.byName[t.Name] = t
	c.handlers[t.Name] = h
}

func (c *toolCatalog) allTools() []*mcp.Tool {
	return c.order
}

func (c *toolCatalog) clientSafeTools() []*mcp.Tool {
	filtered := make([]*mcp.Tool, 0, len(c.order))
	for _, tool := range c.order {
		if clientSafeToolNames[tool.Name] {
			filtered = append(filtered, tool)
		}
	}
	return filtered
}

func (c *toolCatalog) isClientSafe(name string) bool {
	return clientSafeToolNames[name]
}

func (c *toolCatalog) handler(name string) (mcp.ToolHandler, bool) {
	h, ok := c.handlers[name]
	return h, ok
}

var clientSafeToolNames = map[string]bool{
	"select_data":             true,
	"insert_data":             true,
	"update_data":             true,
	"delete_data":             true,
	"bulk_insert_data":        true,
	"get_table_schema":        true,
	"list_tables":             true,
	"create_table":            true,
	"drop_table":              true,
	"create_foreign_key":      true,
	"create_schema":           true,
	"list_extensions":         true,
	"list_migrations":         true,
	"apply_migration":         true,
	"execute_sql":             true,
	"list_cron_jobs":          true,
	"create_cron_job":         true,
	"update_cron_job":         true,
	"delete_cron_job":         true,
	"toggle_cron_job":         true,
	"get_cron_job_history":    true,
	"search_bucket":           true,
	"upload_file":             true,
	"download_file":           true,
	"list_buckets":            true,
	"list_project_buckets":    true,
	"create_bucket":           true,
	"create_project_bucket":   true,
	"delete_bucket":           true,
	"set_bucket_public_policy": true,
	"list_files":              true,
	"get_project_info":        true,
	"list_app_users":          true,
	"get_app_user":            true,
	"create_app_user":         true,
	"update_app_user":         true,
	"delete_app_user":         true,
	"assign_user_role":        true,
	"list_app_roles":          true,
	"get_app_role":            true,
	"create_app_role":         true,
	"update_app_role":         true,
	"delete_app_role":         true,
	"bulk_create_app_users":   true,
	"execute_batch_operations": true,
	"migrate_table_to_users":  true,
	"create_migration_job":    true,
	"update_migration_job":    true,
	"get_migration_job":       true,
	"validate_migration_data": true,
	"find_or_create_user":     true,
	"client_send_sms":         true,
	"client_send_whatsapp":    true,
	"client_initiate_payment": true,
	"client_get_transaction_status": true,
	"client_cancel_subscription":    true,
}
