package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
)

func registerAuthTools(srv *sdkmcp.Server, pool *pgxpool.Pool, dbSvc *dbproxy.Service) {
	reg := &authTools{pool: pool, svc: dbSvc}

	srv.AddTool(makeTool("list_app_users", "List application users for a project with optional filters", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"search":    {Type: "string", Desc: "Search by name or email"},
		"role_id":   {Type: "string", Desc: "Filter by role ID"},
		"is_active": {Type: "boolean", Desc: "Filter by active status"},
		"page":      {Type: "number", Desc: "Page number (default: 1)"},
		"limit":     {Type: "number", Desc: "Users per page (default: 50)"},
	}, []string{"projectId"}), reg.listAppUsers)

	srv.AddTool(makeTool("get_app_user", "Get a specific application user by ID", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"userId":    {Type: "string", Desc: "User ID"},
	}, []string{"projectId", "userId"}), reg.getAppUser)

	srv.AddTool(makeTool("create_app_user", "Create a new application user", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"name":      {Type: "string", Desc: "User full name"},
		"last_name": {Type: "string", Desc: "User last name"},
		"email":     {Type: "string", Desc: "User email address"},
		"password":  {Type: "string", Desc: "User password"},
		"phone":     {Type: "string", Desc: "User phone number"},
		"metadata":  {Type: "object", Desc: "Custom metadata"},
		"role_ids":  {Type: "array", Desc: "Role IDs to assign"},
	}, []string{"projectId", "name", "email", "password"}), reg.createAppUser)

	srv.AddTool(makeTool("update_app_user", "Update an existing application user", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"userId":    {Type: "string", Desc: "User ID"},
		"name":      {Type: "string", Desc: "Updated name"},
		"last_name": {Type: "string", Desc: "Updated last name"},
		"email":     {Type: "string", Desc: "Updated email"},
		"phone":     {Type: "string", Desc: "Updated phone"},
		"metadata":  {Type: "object", Desc: "Updated metadata"},
		"is_active": {Type: "boolean", Desc: "Active status"},
	}, []string{"projectId", "userId"}), reg.updateAppUser)

	srv.AddTool(makeTool("delete_app_user", "Delete or deactivate an application user", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"userId":    {Type: "string", Desc: "User ID"},
		"permanent": {Type: "boolean", Desc: "Permanently delete (true) or deactivate (false, default)"},
	}, []string{"projectId", "userId"}), reg.deleteAppUser)

	srv.AddTool(makeTool("assign_user_role", "Assign a role to an application user", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"userId":    {Type: "string", Desc: "User ID"},
		"roleId":    {Type: "number", Desc: "Role ID to assign"},
	}, []string{"projectId", "userId", "roleId"}), reg.assignUserRole)

	srv.AddTool(makeTool("list_app_roles", "List all roles for a project", map[string]prop{
		"projectId":          {Type: "string", Desc: "Project ID"},
		"include_user_count": {Type: "boolean", Desc: "Include count of users per role (default: false)"},
	}, []string{"projectId"}), reg.listAppRoles)

	srv.AddTool(makeTool("get_app_role", "Get a specific role by ID", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"roleId":    {Type: "string", Desc: "Role ID"},
	}, []string{"projectId", "roleId"}), reg.getAppRole)

	srv.AddTool(makeTool("create_app_role", "Create a new role", map[string]prop{
		"projectId":                {Type: "string", Desc: "Project ID"},
		"role_name":                {Type: "string", Desc: "Role display name"},
		"role_key":                 {Type: "string", Desc: "Role key (lowercase, alphanumeric + underscore)"},
		"description":              {Type: "string", Desc: "Role description"},
		"permissions":              {Type: "array", Desc: "Permission array"},
		"session_duration_minutes": {Type: "number", Desc: "Session duration in minutes (default: 10080)"},
	}, []string{"projectId", "role_name", "role_key"}), reg.createAppRole)

	srv.AddTool(makeTool("update_app_role", "Update an existing role", map[string]prop{
		"projectId":                {Type: "string", Desc: "Project ID"},
		"roleId":                   {Type: "string", Desc: "Role ID"},
		"role_name":                {Type: "string", Desc: "Updated role name"},
		"description":              {Type: "string", Desc: "Updated description"},
		"permissions":              {Type: "array", Desc: "Updated permissions"},
		"session_duration_minutes": {Type: "number", Desc: "Updated session duration"},
	}, []string{"projectId", "roleId"}), reg.updateAppRole)

	srv.AddTool(makeTool("delete_app_role", "Delete a custom role", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"roleId":    {Type: "string", Desc: "Role ID"},
	}, []string{"projectId", "roleId"}), reg.deleteAppRole)

	srv.AddTool(makeTool("list_custom_fields", "List custom user fields for a project", map[string]prop{
		"projectId":        {Type: "string", Desc: "Project ID"},
		"include_inactive": {Type: "boolean", Desc: "Include inactive fields (default: false)"},
	}, []string{"projectId"}), reg.listCustomFields)

	srv.AddTool(makeTool("create_custom_field", "Create a custom user field", map[string]prop{
		"projectId":        {Type: "string", Desc: "Project ID"},
		"field_name":       {Type: "string", Desc: "Field name"},
		"field_label":      {Type: "string", Desc: "Field display label"},
		"field_type":       {Type: "string", Desc: "Field type: text, number, boolean, date, select, multi_select, reference"},
		"is_required":      {Type: "boolean", Desc: "Is field required (default: false)"},
		"options":          {Type: "array", Desc: "Options for select/multi_select fields"},
		"reference_table":  {Type: "string", Desc: "Table name for reference fields"},
		"reference_column": {Type: "string", Desc: "Column name for reference fields"},
	}, []string{"projectId", "field_name", "field_label", "field_type"}), reg.createCustomField)

	srv.AddTool(makeTool("apply_custom_field", "Apply a custom field (add column to users table)", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"fieldId":   {Type: "string", Desc: "Field ID"},
	}, []string{"projectId", "fieldId"}), reg.applyCustomField)

	srv.AddTool(makeTool("get_skaftin_system_auth_settings", "Get authentication settings for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.getAuthSettings)

	srv.AddTool(makeTool("update_skaftin_system_auth_settings", "Update authentication settings for a project", map[string]prop{
		"projectId":                {Type: "string", Desc: "Project ID"},
		"allow_duplicate_emails":   {Type: "boolean", Desc: "Allow users with same email"},
		"require_email":            {Type: "boolean", Desc: "Require email for registration"},
		"registration_enabled":     {Type: "boolean", Desc: "Enable user registration"},
		"auth_enabled":             {Type: "boolean", Desc: "Enable/disable auth system"},
		"default_role_id":          {Type: "number", Desc: "Default role ID for new users"},
		"email_provider_id":        {Type: "number", Desc: "Email provider ID for auth emails"},
		"send_registration_email":  {Type: "boolean", Desc: "Send registration email on signup"},
		"send_verification_email":  {Type: "boolean", Desc: "Send email verification link"},
		"send_password_reset_email": {Type: "boolean", Desc: "Send password reset email"},
		"send_welcome_email":       {Type: "boolean", Desc: "Send welcome email after registration"},
	}, []string{"projectId"}), reg.updateAuthSettings)
}

type authTools struct {
	pool *pgxpool.Pool
	svc  *dbproxy.Service
}

func (a *authTools) acquireConn(ctx context.Context, args map[string]any) (*dbproxy.ProjectConn, error) {
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return nil, err
	}
	return a.svc.AcquireConn(ctx, pid)
}

func (a *authTools) listAppUsers(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	limit := getInt(args, "limit", 50)
	page := getInt(args, "page", 1)
	offset := (page - 1) * limit

	query := `SELECT u.*, COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') as roles FROM skaftin_system_users u LEFT JOIN skaftin_system_user_roles ur ON u.id = ur.user_id LEFT JOIN skaftin_system_roles r ON ur.role_id = r.id`
	var clauses []string
	var qArgs []any
	idx := 1

	if search := getString(args, "search"); search != "" {
		clauses = append(clauses, fmt.Sprintf(`(u.name ILIKE $%d OR u.email ILIKE $%d)`, idx, idx))
		qArgs = append(qArgs, "%"+search+"%")
		idx++
	}
	if roleId := getString(args, "role_id"); roleId != "" {
		clauses = append(clauses, fmt.Sprintf(`ur.role_id = $%d`, idx))
		qArgs = append(qArgs, roleId)
		idx++
	}
	if _, ok := args["is_active"]; ok {
		clauses = append(clauses, fmt.Sprintf(`u.is_active = $%d`, idx))
		qArgs = append(qArgs, getBool(args, "is_active", true))
		idx++
	}

	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " GROUP BY u.id ORDER BY u.created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", idx, idx+1)
	qArgs = append(qArgs, limit, offset)

	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list users: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (a *authTools) getAppUser(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	userId := getString(args, "userId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `SELECT u.*, COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') as roles FROM skaftin_system_users u LEFT JOIN skaftin_system_user_roles ur ON u.id = ur.user_id LEFT JOIN skaftin_system_roles r ON ur.role_id = r.id WHERE u.id = $1 GROUP BY u.id`, userId)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get user: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("User not found")
	}
	return textResult(result[0])
}

func (a *authTools) createAppUser(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	name := getString(args, "name")
	email := getString(args, "email")
	if name == "" || email == "" {
		return errorResult("name and email are required")
	}

	rows, err := pc.Query(ctx, `INSERT INTO skaftin_system_users (name, last_name, email, phone, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
		name, getString(args, "last_name"), email, getString(args, "phone"), getMap(args, "metadata"))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to create user: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Failed to create user")
	}
	return textResult(map[string]any{"success": true, "message": "User created (note: password must be set via HTTP API)", "user": result[0]})
}

func (a *authTools) updateAppUser(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	userId := getString(args, "userId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var setClauses []string
	var qArgs []any
	idx := 1

	fields := []string{"name", "last_name", "email", "phone"}
	for _, f := range fields {
		if v := getString(args, f); v != "" {
			setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, f, idx))
			qArgs = append(qArgs, v)
			idx++
		}
	}
	if _, ok := args["is_active"]; ok {
		setClauses = append(setClauses, fmt.Sprintf(`is_active = $%d`, idx))
		qArgs = append(qArgs, getBool(args, "is_active", true))
		idx++
	}
	if m := getMap(args, "metadata"); m != nil {
		setClauses = append(setClauses, fmt.Sprintf(`metadata = $%d`, idx))
		qArgs = append(qArgs, m)
		idx++
	}

	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}
	setClauses = append(setClauses, "updated_at = NOW()")

	qArgs = append(qArgs, userId)
	query := fmt.Sprintf(`UPDATE skaftin_system_users SET %s WHERE id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx)
	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to update user: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("User not found")
	}
	return textResult(map[string]any{"success": true, "user": result[0]})
}

func (a *authTools) deleteAppUser(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	userId := getString(args, "userId")
	permanent := getBool(args, "permanent", false)

	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if permanent {
		if err := pc.Exec(ctx, `DELETE FROM skaftin_system_users WHERE id = $1`, userId); err != nil {
			return errorResult(fmt.Sprintf("Failed to delete user: %v", err))
		}
		return textResult(map[string]any{"success": true, "message": "User permanently deleted"})
	}

	if err := pc.Exec(ctx, `UPDATE skaftin_system_users SET is_active = false WHERE id = $1`, userId); err != nil {
		return errorResult(fmt.Sprintf("Failed to deactivate user: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": "User deactivated"})
}

func (a *authTools) assignUserRole(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	userId := getString(args, "userId")
	roleId := getInt(args, "roleId", 0)
	if err := pc.Exec(ctx, `INSERT INTO skaftin_system_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userId, roleId); err != nil {
		return errorResult(fmt.Sprintf("Failed to assign role: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": "Role assigned"})
}

func (a *authTools) listAppRoles(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `SELECT r.*, COUNT(DISTINCT ur.user_id) as user_count FROM skaftin_system_roles r LEFT JOIN skaftin_system_user_roles ur ON r.id = ur.role_id GROUP BY r.id ORDER BY r.created_at`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list roles: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (a *authTools) getAppRole(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	roleId := getString(args, "roleId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `SELECT r.*, COUNT(DISTINCT ur.user_id) as user_count FROM skaftin_system_roles r LEFT JOIN skaftin_system_user_roles ur ON r.id = ur.role_id WHERE r.id = $1 GROUP BY r.id`, roleId)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get role: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Role not found")
	}
	return textResult(result[0])
}

func (a *authTools) createAppRole(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `INSERT INTO skaftin_system_roles (name, description) VALUES ($1, $2) RETURNING *`,
		getString(args, "role_name"), getString(args, "description"))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to create role: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Failed to create role")
	}
	return textResult(map[string]any{"success": true, "role": result[0]})
}

func (a *authTools) updateAppRole(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	roleId := getString(args, "roleId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var setClauses []string
	var qArgs []any
	idx := 1
	if v := getString(args, "role_name"); v != "" {
		setClauses = append(setClauses, fmt.Sprintf(`name = $%d`, idx))
		qArgs = append(qArgs, v)
		idx++
	}
	if v := getString(args, "description"); v != "" {
		setClauses = append(setClauses, fmt.Sprintf(`description = $%d`, idx))
		qArgs = append(qArgs, v)
		idx++
	}
	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}
	setClauses = append(setClauses, "updated_at = NOW()")
	qArgs = append(qArgs, roleId)
	query := fmt.Sprintf(`UPDATE skaftin_system_roles SET %s WHERE id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx)
	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to update role: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "role": collectRows(rows)})
}

func (a *authTools) deleteAppRole(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	roleId := getString(args, "roleId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if err := pc.Exec(ctx, `DELETE FROM skaftin_system_roles WHERE id = $1`, roleId); err != nil {
		return errorResult(fmt.Sprintf("Failed to delete role: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": "Role deleted"})
}

func (a *authTools) listCustomFields(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	query := `SELECT * FROM app_user_custom_fields`
	if !getBool(args, "include_inactive", false) {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY display_order, created_at`

	rows, err := pc.Query(ctx, query)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list custom fields: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (a *authTools) createCustomField(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `INSERT INTO app_user_custom_fields (field_name, field_label, field_type, is_required, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *`,
		getString(args, "field_name"), getString(args, "field_label"), getString(args, "field_type"), getBool(args, "is_required", false))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to create custom field: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "field": collectRows(rows)})
}

func (a *authTools) applyCustomField(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	fieldId := getString(args, "fieldId")
	pc, err := a.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var fieldName, fieldType string
	if err := pc.QueryRow(ctx, `SELECT field_name, field_type FROM app_user_custom_fields WHERE id = $1`, fieldId).Scan(&fieldName, &fieldType); err != nil {
		return errorResult("Custom field not found")
	}

	pgType := "TEXT"
	switch fieldType {
	case "number":
		pgType = "NUMERIC"
	case "boolean":
		pgType = "BOOLEAN"
	case "date":
		pgType = "TIMESTAMP"
	case "reference":
		pgType = "INTEGER"
	}

	if err := pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE skaftin_system_users ADD COLUMN IF NOT EXISTS "%s" %s`, fieldName, pgType)); err != nil {
		return errorResult(fmt.Sprintf("Failed to apply custom field: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Column %s (%s) added to users table", fieldName, pgType)})
}

func (a *authTools) getAuthSettings(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	rows, err := a.pool.Query(ctx, `SELECT * FROM skaftin_system_auth_settings WHERE project_id = $1`, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get auth settings: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Auth settings not found")
	}
	return textResult(result[0])
}

func (a *authTools) updateAuthSettings(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	var setClauses []string
	var qArgs []any
	idx := 1

	boolFields := []string{"allow_duplicate_emails", "require_email", "registration_enabled", "auth_enabled", "send_registration_email", "send_verification_email", "send_password_reset_email", "send_welcome_email"}
	for _, f := range boolFields {
		if _, ok := args[f]; ok {
			setClauses = append(setClauses, fmt.Sprintf(`%s = $%d`, f, idx))
			qArgs = append(qArgs, getBool(args, f, false))
			idx++
		}
	}
	intFields := []string{"default_role_id", "email_provider_id"}
	for _, f := range intFields {
		if v := getInt(args, f, -1); v >= 0 {
			setClauses = append(setClauses, fmt.Sprintf(`%s = $%d`, f, idx))
			qArgs = append(qArgs, v)
			idx++
		}
	}

	if len(setClauses) == 0 {
		return errorResult("No settings to update")
	}

	qArgs = append(qArgs, pid)
	query := fmt.Sprintf(`UPDATE skaftin_system_auth_settings SET %s WHERE project_id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx)
	rows, err := a.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to update auth settings: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "settings": collectRows(rows)})
}
