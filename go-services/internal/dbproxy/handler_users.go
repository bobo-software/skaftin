package dbproxy

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
	"golang.org/x/crypto/bcrypt"
)

// --- Phase 6: User Management ---

func resolveUserRolesUserIDColumn(ctx context.Context, pc *ProjectConn, schemaName string) (string, error) {
	rows, err := pc.Query(ctx, `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = $1
		  AND table_name = 'skaftin_system_user_roles'
		  AND column_name IN ('app_user_id', 'user_id')
	`, schemaName)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	seen := map[string]bool{}
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err != nil {
			return "", err
		}
		seen[col] = true
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	if seen["app_user_id"] {
		return "app_user_id", nil
	}
	if seen["user_id"] {
		return "user_id", nil
	}
	return "", fmt.Errorf("skaftin_system_user_roles has no app_user_id/user_id column in schema %s", schemaName)
}

func (h *Handler) SelectUsers(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Where          map[string]any `json:"where"`
		Limit          *int           `json:"limit"`
		Offset         *int           `json:"offset"`
		Columns        []string       `json:"columns"`
		OrderBy        string         `json:"orderBy"`
		OrderDirection string         `json:"orderDirection"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	// Get schema name
	var schemaName string
	pc.QueryRow(r.Context(), `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, pid).Scan(&schemaName)
	if schemaName == "" {
		httputil.WriteError(w, http.StatusNotFound, "Project not found")
		return
	}
	userRoleUserIDColumn, err := resolveUserRolesUserIDColumn(r.Context(), pc, schemaName)
	if err != nil {
		slog.Error("resolve user role user id column failed", "error", err, "schema", schemaName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read role schema")
		return
	}

	// Get available columns
	colRows, _ := pc.Query(r.Context(), `
		SELECT column_name FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = 'skaftin_system_users'
	`, schemaName)
	availableCols := make(map[string]bool)
	if colRows != nil {
		for colRows.Next() {
			var c string
			colRows.Scan(&c)
			availableCols[c] = true
		}
		colRows.Close()
	}

	// Build SELECT clause (exclude password)
	var selectCols []string
	if len(body.Columns) > 0 {
		for _, c := range body.Columns {
			if c != "password" && c != "pwd" {
				selectCols = append(selectCols, fmt.Sprintf(`u."%s"`, c))
			}
		}
	} else {
		for c := range availableCols {
			if c != "password" && c != "pwd" {
				selectCols = append(selectCols, fmt.Sprintf(`u."%s"`, c))
			}
		}
	}

	rolesAgg := `, COALESCE(json_agg(json_build_object(
		'id', r.id, 'role_name', r.role_name, 'role_key', r.role_key,
		'description', r.description, 'permissions', r.permissions,
		'session_duration_minutes', r.session_duration_minutes,
		'is_system_role', r.is_system_role, 'assigned_at', ur.assigned_at
	)) FILTER (WHERE r.id IS NOT NULL), '[]'::json) as roles`

	selectClause := strings.Join(selectCols, ", ") + rolesAgg

	var whereClauses []string
	var args []any
	idx := 1

	for key, val := range body.Where {
		if val == nil {
			continue
		}
		if key == "role_id" {
			whereClauses = append(whereClauses, fmt.Sprintf(`EXISTS (SELECT 1 FROM %s.skaftin_system_user_roles ur2 WHERE ur2.%s = u.id AND ur2.role_id = $%d)`, schemaName, userRoleUserIDColumn, idx))
			args = append(args, val)
			idx++
			continue
		}
		colName := key
		if colName == "user_id" {
			colName = "id"
		}
		if availableCols[colName] {
			whereClauses = append(whereClauses, fmt.Sprintf(`u."%s" = $%d`, colName, idx))
			args = append(args, val)
			idx++
		}
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	orderBy := body.OrderBy
	if orderBy == "" {
		orderBy = "created_at"
	}
	dir := "ASC"
	if strings.EqualFold(body.OrderDirection, "DESC") {
		dir = "DESC"
	}

	query := fmt.Sprintf(`SELECT %s FROM %s.skaftin_system_users u
		LEFT JOIN %s.skaftin_system_user_roles ur ON u.id = ur.%s
		LEFT JOIN %s.skaftin_system_roles r ON ur.role_id = r.id
		%s GROUP BY u.id ORDER BY u."%s" %s`,
		selectClause, schemaName, schemaName, userRoleUserIDColumn, schemaName, whereClause, orderBy, dir)

	if body.Limit != nil {
		query += fmt.Sprintf(" LIMIT $%d", idx)
		args = append(args, *body.Limit)
		idx++
	}
	if body.Offset != nil && *body.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", idx)
		args = append(args, *body.Offset)
	}

	rows, err := pc.Query(r.Context(), query, args...)
	if err != nil {
		slog.Error("select users failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to select users")
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	httputil.WriteSuccess(w, http.StatusOK, "Users fetched successfully", result)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Name         string         `json:"name"`
		LastName     string         `json:"last_name"`
		Email        string         `json:"email"`
		Password     string         `json:"password"`
		Phone        string         `json:"phone"`
		Metadata     map[string]any `json:"metadata"`
		RoleIDs      []int          `json:"role_ids"`
		CustomField1 *string        `json:"custom_field_1"`
		CustomField2 *string        `json:"custom_field_2"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Name == "" || body.Password == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Name and password are required")
		return
	}

	var schemaName string
	pc.QueryRow(r.Context(), `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, pid).Scan(&schemaName)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	ctx := r.Context()
	userRoleUserIDColumn, err := resolveUserRolesUserIDColumn(ctx, pc, schemaName)
	if err != nil {
		slog.Error("resolve user role user id column failed", "error", err, "schema", schemaName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read role schema")
		return
	}

	metadataJSON := "{}"
	if body.Metadata != nil {
		b, _ := json.Marshal(body.Metadata)
		metadataJSON = string(b)
	}

	var userID int
	err = pc.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO %s.skaftin_system_users (name, last_name, email, password, phone, metadata, custom_field_1, custom_field_2)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING id
	`, schemaName), body.Name, body.LastName, body.Email, string(hashedPassword), body.Phone, metadataJSON, body.CustomField1, body.CustomField2).Scan(&userID)
	if err != nil {
		slog.Error("create user failed", "error", err)
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			httputil.WriteError(w, http.StatusBadRequest, "User with this email already exists in this project")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Assign roles
	for _, roleID := range body.RoleIDs {
		pc.Exec(ctx, fmt.Sprintf(`INSERT INTO %s.skaftin_system_user_roles (%s, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, schemaName, userRoleUserIDColumn), userID, roleID)
	}

	// Fetch the user with roles
	rows, _ := pc.Query(ctx, fmt.Sprintf(`
		SELECT u.id, u.name, u.last_name, u.email, u.phone, u.metadata, u.is_active, u.created_at, u.updated_at,
			COALESCE(json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key))
			FILTER (WHERE r.id IS NOT NULL), '[]') as roles
		FROM %s.skaftin_system_users u
		LEFT JOIN %s.skaftin_system_user_roles ur ON u.id = ur.%s
		LEFT JOIN %s.skaftin_system_roles r ON ur.role_id = r.id
		WHERE u.id = $1 GROUP BY u.id
	`, schemaName, schemaName, userRoleUserIDColumn, schemaName), userID)
	if rows != nil {
		defer rows.Close()
		result := collectRows(rows)
		if len(result) > 0 {
			httputil.WriteSuccess(w, http.StatusCreated, "User created successfully", result[0])
			return
		}
	}

	httputil.WriteSuccess(w, http.StatusCreated, "User created successfully", map[string]any{"id": userID})
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Where   map[string]any `json:"where"`
		Data    map[string]any `json:"data"`
		RoleIDs []int          `json:"role_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	userID := extractUserID(body.Where)
	if userID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "where clause must contain user_id or id")
		return
	}

	var schemaName string
	pc.QueryRow(r.Context(), `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, pid).Scan(&schemaName)

	ctx := r.Context()
	userRoleUserIDColumn, err := resolveUserRolesUserIDColumn(ctx, pc, schemaName)
	if err != nil {
		slog.Error("resolve user role user id column failed", "error", err, "schema", schemaName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read role schema")
		return
	}

	// Build dynamic UPDATE
	if len(body.Data) > 0 {
		delete(body.Data, "password")
		delete(body.Data, "pwd")

		var setClauses []string
		var args []any
		idx := 1
		for col, val := range body.Data {
			if col == "metadata" {
				b, _ := json.Marshal(val)
				setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d::jsonb`, col, idx))
				args = append(args, string(b))
			} else {
				setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
				args = append(args, val)
			}
			idx++
		}
		setClauses = append(setClauses, `updated_at = CURRENT_TIMESTAMP`)

		args = append(args, userID)
		query := fmt.Sprintf(`UPDATE %s.skaftin_system_users SET %s WHERE id = $%d`,
			schemaName, strings.Join(setClauses, ", "), idx)

		if err := pc.Exec(ctx, query, args...); err != nil {
			slog.Error("update user failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update user")
			return
		}
	}

	// Update roles if provided
	if body.RoleIDs != nil {
		pc.Exec(ctx, fmt.Sprintf(`DELETE FROM %s.skaftin_system_user_roles WHERE %s = $1`, schemaName, userRoleUserIDColumn), userID)
		for _, roleID := range body.RoleIDs {
			pc.Exec(ctx, fmt.Sprintf(`INSERT INTO %s.skaftin_system_user_roles (%s, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, schemaName, userRoleUserIDColumn), userID, roleID)
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, "User updated successfully", map[string]any{"id": userID})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Where       map[string]any `json:"where"`
		NewPassword string         `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	userID := extractUserID(body.Where)
	if userID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "where clause must contain user_id or id")
		return
	}
	if body.NewPassword == "" {
		httputil.WriteError(w, http.StatusBadRequest, "New password is required")
		return
	}

	var schemaName string
	pc.QueryRow(r.Context(), `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, pid).Scan(&schemaName)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	if err := pc.Exec(r.Context(), fmt.Sprintf(`UPDATE %s.skaftin_system_users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, schemaName), string(hashedPassword), userID); err != nil {
		slog.Error("change password failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to change password")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Password changed successfully", nil)
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		Where     map[string]any `json:"where"`
		Permanent bool           `json:"permanent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	userID := extractUserID(body.Where)
	if userID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "where clause must contain user_id or id")
		return
	}

	var schemaName string
	pc.QueryRow(r.Context(), `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, pid).Scan(&schemaName)

	ctx := r.Context()
	userRoleUserIDColumn, err := resolveUserRolesUserIDColumn(ctx, pc, schemaName)
	if err != nil {
		slog.Error("resolve user role user id column failed", "error", err, "schema", schemaName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read role schema")
		return
	}

	if body.Permanent {
		// Delete user roles first
		pc.Exec(ctx, fmt.Sprintf(`DELETE FROM %s.skaftin_system_user_roles WHERE %s = $1`, schemaName, userRoleUserIDColumn), userID)
		if err := pc.Exec(ctx, fmt.Sprintf(`DELETE FROM %s.skaftin_system_users WHERE id = $1`, schemaName), userID); err != nil {
			slog.Error("permanent delete user failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete user")
			return
		}
		httputil.WriteSuccess(w, http.StatusOK, "User permanently deleted", nil)
	} else {
		// Soft delete
		if err := pc.Exec(ctx, fmt.Sprintf(`UPDATE %s.skaftin_system_users SET is_active = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, schemaName), userID); err != nil {
			slog.Error("soft delete user failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete user")
			return
		}
		httputil.WriteSuccess(w, http.StatusOK, "User deactivated successfully", nil)
	}
}

func extractUserID(where map[string]any) int {
	if where == nil {
		return 0
	}
	for _, key := range []string{"user_id", "id"} {
		if v, ok := where[key]; ok {
			switch val := v.(type) {
			case float64:
				return int(val)
			case string:
				if id, err := strconv.Atoi(val); err == nil {
					return id
				}
			}
		}
	}
	return 0
}
