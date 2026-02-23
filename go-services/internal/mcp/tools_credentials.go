package mcp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerCredentialsTools(srv *sdkmcp.Server, pool *pgxpool.Pool) {
	reg := &credentialsTools{pool: pool}

	srv.AddTool(makeTool("list_skaftin_system_api_credentials", "List all API credentials for a project", map[string]prop{
		"projectId":        {Type: "string", Desc: "Project ID"},
		"type":             {Type: "string", Desc: "Filter by type: api_key, access_token, mcp_key"},
		"include_inactive": {Type: "boolean", Desc: "Include inactive credentials (default: false)"},
	}, []string{"projectId"}), reg.listCredentials)

	srv.AddTool(makeTool("get_api_credential", "Get details of a specific API credential", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"credentialId": {Type: "string", Desc: "Credential ID"},
	}, []string{"projectId", "credentialId"}), reg.getCredential)

	srv.AddTool(makeTool("create_api_credential", "Create a new API credential", map[string]prop{
		"projectId":       {Type: "string", Desc: "Project ID"},
		"name":            {Type: "string", Desc: "Credential name/description"},
		"type":            {Type: "string", Desc: "Credential type: api_key or access_token"},
		"permissions":     {Type: "array", Desc: "Permission strings"},
		"expires_in_days": {Type: "number", Desc: "Expiration in days (null = never)"},
	}, []string{"projectId", "name", "type"}), reg.createCredential)

	srv.AddTool(makeTool("update_api_credential", "Update an API credential", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"credentialId": {Type: "string", Desc: "Credential ID"},
		"name":         {Type: "string", Desc: "Updated name"},
		"permissions":  {Type: "array", Desc: "Updated permissions"},
		"is_active":    {Type: "boolean", Desc: "Active status"},
	}, []string{"projectId", "credentialId"}), reg.updateCredential)

	srv.AddTool(makeTool("delete_api_credential", "Delete an API credential", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"credentialId": {Type: "string", Desc: "Credential ID"},
	}, []string{"projectId", "credentialId"}), reg.deleteCredential)

	srv.AddTool(makeTool("get_mcp_key", "Get the MCP key for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.getMcpKey)

	srv.AddTool(makeTool("regenerate_mcp_key", "Create or regenerate the MCP key for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.regenerateMcpKey)

	srv.AddTool(makeTool("get_credential_permissions", "Get list of available permissions for API credentials", map[string]prop{}, nil), reg.getPermissions)
}

type credentialsTools struct {
	pool *pgxpool.Pool
}

func (c *credentialsTools) listCredentials(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	query := `SELECT id, project_id, name, credential_type, SUBSTRING(token, 1, 10) || '...' as token_preview, permissions, is_active, expires_at, last_used_at, created_at FROM skaftin_system_api_credentials WHERE project_id = $1`
	qArgs := []any{pid}
	idx := 2

	if t := getString(args, "type"); t != "" {
		query += fmt.Sprintf(` AND credential_type = $%d`, idx)
		qArgs = append(qArgs, t)
		idx++
	}
	if !getBool(args, "include_inactive", false) {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := c.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list credentials: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (c *credentialsTools) getCredential(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	credId := getString(args, "credentialId")

	rows, err := c.pool.Query(ctx, `SELECT * FROM skaftin_system_api_credentials WHERE id = $1 AND project_id = $2`, credId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get credential: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Credential not found")
	}
	return textResult(result[0])
}

func (c *credentialsTools) createCredential(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	name := getString(args, "name")
	credType := getString(args, "type")
	if name == "" || credType == "" {
		return errorResult("name and type are required")
	}

	prefix := "sk_"
	if credType == "access_token" {
		prefix = "sat_"
	}
	token := prefix + generateRandomToken(32)

	rows, err := c.pool.Query(ctx, `INSERT INTO skaftin_system_api_credentials (project_id, name, credential_type, token, permissions, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
		pid, name, credType, token, getStringSlice(args, "permissions"))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to create credential: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	return textResult(map[string]any{"success": true, "message": "Credential created. Save the token now - it cannot be retrieved later.", "credential": result})
}

func (c *credentialsTools) updateCredential(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	credId := getString(args, "credentialId")

	var setClauses []string
	var qArgs []any
	idx := 1

	if v := getString(args, "name"); v != "" {
		setClauses = append(setClauses, fmt.Sprintf(`name = $%d`, idx))
		qArgs = append(qArgs, v)
		idx++
	}
	if _, ok := args["is_active"]; ok {
		setClauses = append(setClauses, fmt.Sprintf(`is_active = $%d`, idx))
		qArgs = append(qArgs, getBool(args, "is_active", true))
		idx++
	}
	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}

	qArgs = append(qArgs, credId, pid)
	query := fmt.Sprintf(`UPDATE skaftin_system_api_credentials SET %s WHERE id = $%d AND project_id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx, idx+1)
	rows, err := c.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to update credential: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "credential": collectRows(rows)})
}

func (c *credentialsTools) deleteCredential(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	credId := getString(args, "credentialId")

	tag, err := c.pool.Exec(ctx, `DELETE FROM skaftin_system_api_credentials WHERE id = $1 AND project_id = $2`, credId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to delete credential: %v", err))
	}
	if tag.RowsAffected() == 0 {
		return errorResult("Credential not found")
	}
	return textResult(map[string]any{"success": true, "message": "Credential deleted"})
}

func (c *credentialsTools) getMcpKey(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	rows, err := c.pool.Query(ctx, `SELECT * FROM skaftin_system_api_credentials WHERE project_id = $1 AND credential_type = 'mcp_key'`, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get MCP key: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return textResult(map[string]any{"message": "No MCP key found. Use regenerate_mcp_key to create one."})
	}
	return textResult(result[0])
}

func (c *credentialsTools) regenerateMcpKey(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	token := "mcp_" + generateRandomToken(32)

	rows, err := c.pool.Query(ctx, `
		INSERT INTO skaftin_system_api_credentials (project_id, name, credential_type, token, permissions, is_active)
		VALUES ($1, 'MCP Key', 'mcp_key', $2, ARRAY['mcp:full_access'], true)
		ON CONFLICT (project_id, credential_type) WHERE credential_type = 'mcp_key'
		DO UPDATE SET token = $2, last_used_at = NULL
		RETURNING *`, pid, token)
	if err != nil {
		tag, err2 := c.pool.Exec(ctx, `UPDATE skaftin_system_api_credentials SET token = $1, last_used_at = NULL WHERE project_id = $2 AND credential_type = 'mcp_key'`, token, pid)
		if err2 != nil {
			return errorResult(fmt.Sprintf("Failed to regenerate MCP key: %v (original: %v)", err2, err))
		}
		return textResult(map[string]any{"success": true, "message": "MCP key regenerated. Save it now!", "token": token, "rowsAffected": tag.RowsAffected()})
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "message": "MCP key created/regenerated. Save it now!", "token": token})
}

func (c *credentialsTools) getPermissions(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{
		"database":       []string{"database:read", "database:write", "database:delete", "database:schema"},
		"storage":        []string{"storage:read", "storage:write", "storage:delete"},
		"auth":           []string{"auth:read", "auth:write"},
		"graphql":        []string{"graphql:query", "graphql:mutate"},
		"communications": []string{"communications:read", "communications:write"},
		"mcp":            []string{"mcp:full_access"},
	})
}

func generateRandomToken(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return hex.EncodeToString(b)[:length]
}
