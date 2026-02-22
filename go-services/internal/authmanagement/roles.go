package authmanagement

import (
	"encoding/json"
	"net/http"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func (h *Handler) ListRolesHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	includeCount := r.URL.Query().Get("include_user_count") == "true"
	roles, err := h.service.ListRoles(r.Context(), projectID, includeCount)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Roles fetched successfully", roles)
}

func (h *Handler) GetRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	role, err := h.service.GetRole(r.Context(), projectID, roleID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if role == nil {
		httputil.WriteError(w, 404, "Role not found")
		return
	}
	httputil.WriteSuccess(w, 200, "Role fetched successfully", role)
}

func (h *Handler) CreateRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body struct {
		RoleName        string           `json:"role_name"`
		RoleKey         string           `json:"role_key"`
		Description     *string          `json:"description"`
		Permissions     json.RawMessage  `json:"permissions"`
		SessionDuration int              `json:"session_duration_minutes"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if body.RoleName == "" || body.RoleKey == "" {
		httputil.WriteError(w, 400, "role_name and role_key are required")
		return
	}
	role, err := h.service.CreateRole(r.Context(), projectID, body.RoleName, body.RoleKey, body.Description, body.Permissions, body.SessionDuration)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 201, "Role created successfully", role)
}

func (h *Handler) UpdateRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	allowed := map[string]bool{
		"role_name": true, "description": true, "permissions": true,
		"session_duration_minutes": true, "organisation_field_name": true,
		"organisation_lookup_table": true, "organisation_lookup_field": true,
	}
	fields := make(map[string]any)
	for k, v := range body {
		if allowed[k] {
			fields[k] = v
		}
	}
	role, err := h.service.UpdateRole(r.Context(), projectID, roleID, fields)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Role updated successfully", role)
}

func (h *Handler) DeleteRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	if err := h.service.DeleteRole(r.Context(), projectID, roleID); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Role deleted successfully", nil)
}

func (h *Handler) GetRolePermissionsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	perms, err := h.service.GetRolePermissions(r.Context(), projectID, roleID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if perms == nil {
		httputil.WriteError(w, 404, "Role not found")
		return
	}
	httputil.WriteSuccess(w, 200, "Permissions fetched successfully", map[string]any{"permissions": perms})
}

func (h *Handler) UpdateRolePermissionsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	var body struct {
		Permissions json.RawMessage `json:"permissions"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	role, err := h.service.UpdateRolePermissions(r.Context(), projectID, roleID, body.Permissions)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Permissions updated successfully", role)
}

func (h *Handler) UpdateSessionDurationHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	var body struct {
		Minutes int `json:"session_duration_minutes"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if body.Minutes <= 0 {
		httputil.WriteError(w, 400, "session_duration_minutes must be positive")
		return
	}
	role, err := h.service.UpdateSessionDuration(r.Context(), projectID, roleID, body.Minutes)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Session duration updated successfully", role)
}

func (h *Handler) VerifyOrgContextHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	result, err := h.service.VerifyOrgContext(r.Context(), projectID, roleID)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Organization context verified", result)
}
