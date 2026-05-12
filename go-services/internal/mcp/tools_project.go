package mcp

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/projects"
)

func registerProjectTools(srv toolRegistrar, pool *pgxpool.Pool, store *projects.Store) {
	reg := &projectTools{pool: pool, store: store}

	srv.AddTool(makeTool("list_projects", "List all projects accessible to the current user", map[string]prop{}, nil), reg.listProjects)

	srv.AddTool(makeTool("get_project_info", "Get detailed information about a specific project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.getProjectInfo)

	srv.AddTool(makeTool("update_project_settings", "Update project name or description", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"name":        {Type: "string", Desc: "New project name (optional)"},
		"description": {Type: "string", Desc: "New project description (optional)"},
	}, []string{"projectId"}), reg.updateProjectSettings)
}

type projectTools struct {
	pool  *pgxpool.Pool
	store *projects.Store
}

// --- list_projects ---

func (p *projectTools) listProjects(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	// List all projects in the system (MCP context = admin/platform level).
	rows, err := p.pool.Query(ctx, `
		SELECT id, name, description, organization_id, schema_name, created_at
		FROM skaftin_system_projects
		ORDER BY created_at
	`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list projects: %v", err))
	}
	defer rows.Close()

	return textResult(collectRows(rows))
}

// --- get_project_info ---

func (p *projectTools) getProjectInfo(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := projectIDFromArgs(ctx, args)
	if err != nil {
		return errorResult(err.Error())
	}

	project, err := p.store.GetProjectByID(ctx, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Project not found: %v", err))
	}

	tableCount, _ := p.store.GetTableCount(ctx, project.SchemaName, true)
	bucketNames, _ := p.store.ListBucketNames(ctx, pid)

	return textResult(map[string]any{
		"id":                       project.ID,
		"name":                     project.Name,
		"description":              project.Description,
		"organization_id":          project.OrganizationID,
		"schema_name":              project.SchemaName,
		"field_encryption_key_set": project.FieldEncryptionSet,
		"created_at":               project.CreatedAt,
		"updated_at":               project.UpdatedAt,
		"stats": map[string]any{
			"table_count":  tableCount,
			"bucket_names": bucketNames,
		},
	})
}

// --- update_project_settings ---

func (p *projectTools) updateProjectSettings(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := projectIDFromArgs(ctx, args)
	if err != nil {
		return errorResult(err.Error())
	}

	var name, description *string
	if v := getString(args, "name"); v != "" {
		name = &v
	}
	if v := getString(args, "description"); v != "" {
		description = &v
	}

	if name == nil && description == nil {
		return errorResult("At least one of name or description must be provided")
	}

	project, err := p.store.UpdateProject(ctx, pid, name, description, nil, false)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to update project: %v", err))
	}

	return textResult(map[string]any{
		"success": true,
		"message": "Project updated successfully",
		"project": map[string]any{
			"id":          project.ID,
			"name":        project.Name,
			"description": project.Description,
		},
	})
}
