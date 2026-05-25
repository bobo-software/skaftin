package authmanagement

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// ListUsersPOST lists users; all filters and pagination are read from the JSON body.
// App API: POST /app-api/auth/users/list — JWT API: POST /api/auth/{projectId}/users/list
func (h *Handler) ListUsersPOST(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		httputil.WriteError(w, 400, "Failed to read request body")
		return
	}
	_ = r.Body.Close()
	if len(bytes.TrimSpace(raw)) == 0 {
		raw = []byte("{}")
	}
	var body struct {
		Search   string         `json:"search"`
		RoleID   *int           `json:"role_id"`
		IsActive *bool          `json:"is_active"`
		Page     int            `json:"page"`
		Limit    int            `json:"limit"`
		Metadata map[string]any `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid JSON body")
		return
	}
	filters := map[string]any{}
	if body.Search != "" {
		filters["search"] = body.Search
	}
	if body.RoleID != nil && *body.RoleID > 0 {
		filters["role_id"] = *body.RoleID
	}
	if body.IsActive != nil {
		filters["is_active"] = *body.IsActive
	}
	if len(body.Metadata) > 0 {
		filters["metadata"] = body.Metadata
	}
	limit := 50
	if body.Limit > 0 {
		limit = body.Limit
	}
	page := 1
	if body.Page > 1 {
		page = body.Page
	}
	offset := (page - 1) * limit

	users, total, err := h.service.ListUsers(r.Context(), projectID, filters, limit, offset)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if users == nil {
		users = []AppUser{}
	}
	httputil.WriteSuccess(w, 200, "Users fetched successfully", map[string]any{
		"users": users,
		"pagination": map[string]any{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": (total + limit - 1) / limit,
		},
	})
}

func (h *Handler) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	user, err := h.service.GetUser(r.Context(), projectID, userID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if user == nil {
		httputil.WriteError(w, 404, "User not found")
		return
	}
	httputil.WriteSuccess(w, 200, "User fetched successfully", user)
}

func (h *Handler) GetUsersByRole(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	users, err := h.service.GetUsersByRole(r.Context(), projectID, roleID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if users == nil {
		users = []AppUser{}
	}
	httputil.WriteSuccess(w, 200, "Users fetched successfully", users)
}

func (h *Handler) GetUserPasswordHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	hasPassword, err := h.service.UserHasPassword(r.Context(), projectID, userID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password status fetched", map[string]bool{"has_password": hasPassword})
}

func (h *Handler) SetUserPasswordHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || body.Password == "" {
		httputil.WriteError(w, 400, "password is required")
		return
	}
	if err := h.service.SetUserPassword(r.Context(), projectID, userID, body.Password); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password updated", nil)
}

func (h *Handler) VerifyUserPasswordHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || strings.TrimSpace(body.Password) == "" {
		httputil.WriteError(w, 400, "password is required")
		return
	}

	valid, hasPassword, err := h.service.VerifyUserPassword(r.Context(), projectID, userID, body.Password)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password verification completed", map[string]any{
		"valid":        valid,
		"has_password": hasPassword,
	})
}

func (h *Handler) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	name, _ := body["name"].(string)
	if name == "" {
		httputil.WriteError(w, 400, "name is required")
		return
	}
	allowed := map[string]bool{
		"name": true, "email": true, "phone": true, "metadata": true,
		"custom_field_1": true, "custom_field_2": true, "is_active": true,
		"organisation_id": true, "last_name": true,
	}
	data := make(map[string]any)
	for k, v := range body {
		if allowed[k] {
			data[k] = v
		}
	}
	if _, ok := data["is_active"]; !ok {
		data["is_active"] = true
	}
	user, err := h.service.CreateUserAdmin(r.Context(), projectID, data)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 201, "User created successfully", user)
}

func (h *Handler) UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	allowed := map[string]bool{
		"name": true, "last_name": true, "email": true, "phone": true,
		"metadata": true, "custom_field_1": true, "custom_field_2": true,
		"is_active": true, "email_verified": true, "phone_verified": true,
		"organisation_id": true,
	}
	fields := make(map[string]any)
	for k, v := range body {
		if allowed[k] {
			fields[k] = v
		}
	}
	user, err := h.service.UpdateUser(r.Context(), projectID, userID, fields)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "User updated successfully", user)
}

func (h *Handler) DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	permanent := r.URL.Query().Get("permanent") == "true"
	if err := h.service.DeleteUser(r.Context(), projectID, userID, permanent); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "User deleted successfully", nil)
}

func (h *Handler) GetUserOTPStatusHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	otps, err := h.service.GetUserOTPStatus(r.Context(), projectID, userID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP status fetched", otps)
}

func (h *Handler) ResendOTPHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	if err := h.service.ResendOTP(r.Context(), projectID, userID); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP resent", nil)
}

func (h *Handler) ManuallyVerifyHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	if err := h.service.ManuallyVerifyUser(r.Context(), projectID, userID); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "User verified", nil)
}

func (h *Handler) AssignRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	var body struct {
		RoleID int `json:"role_id"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || body.RoleID == 0 {
		httputil.WriteError(w, 400, "role_id is required")
		return
	}
	if err := h.service.AssignRole(r.Context(), projectID, userID, body.RoleID, "admin"); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Role assigned", nil)
}

func (h *Handler) RemoveRoleHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	userID, ok := parsePathInt(r, "userId")
	if !ok {
		httputil.WriteError(w, 400, "User ID is required")
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	if err := h.service.RemoveRole(r.Context(), projectID, userID, roleID); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Role removed", nil)
}

func (h *Handler) ExportUsersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	sql, err := h.service.ExportUsers(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/sql")
	w.Header().Set("Content-Disposition", "attachment; filename=users_export.sql")
	w.WriteHeader(200)
	w.Write([]byte(sql))
}

func (h *Handler) ImportUsersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body struct {
		SQL              string `json:"sql"`
		SQLContent       string `json:"sqlContent"`
		ClearExisting    bool   `json:"clear_existing"`
		ClearExistingAlt bool   `json:"clearExisting"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	sql := body.SQL
	if sql == "" {
		sql = body.SQLContent
	}
	sql = strings.TrimSpace(sql)
	if sql == "" {
		httputil.WriteError(w, 400, "sql or sqlContent field is required")
		return
	}
	clearExisting := body.ClearExisting || body.ClearExistingAlt
	result, err := h.service.ImportUsers(r.Context(), projectID, sql, clearExisting)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Users imported successfully", result)
}
