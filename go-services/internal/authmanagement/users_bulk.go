package authmanagement

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/bulkresult"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func (h *Handler) BulkCreateUsersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		Users []map[string]any `json:"users"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || len(body.Users) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "users array is required")
		return
	}
	if len(body.Users) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.Users))}
	for i, rawUser := range body.Users {
		result := bulkresult.ItemResult{Index: i}
		data, roleIDs, err := filterBulkUserData(rawUser)
		if err != nil {
			summary.AddFailure(result, err.Error())
			continue
		}

		user, err := h.service.CreateUserAdmin(r.Context(), projectID, data)
		if err != nil {
			if isDuplicateUserError(err) {
				result.Data = map[string]any{"email": data["email"]}
				summary.AddSkipped(result, "User already exists")
				continue
			}
			summary.AddFailure(result, err.Error())
			continue
		}
		stripUserPassword(user)

		roleErrors := make([]string, 0)
		for _, roleID := range roleIDs {
			if err := h.service.AssignRole(r.Context(), projectID, user.ID, roleID, "admin"); err != nil {
				roleErrors = append(roleErrors, fmt.Sprintf("role %d: %v", roleID, err))
			}
		}

		result.ID = user.ID
		result.Data = map[string]any{"user": user}
		if len(roleErrors) > 0 {
			result.Data["roleErrors"] = roleErrors
		}
		summary.AddSuccess(result)
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk user create completed: %d succeeded, %d skipped, %d failed", summary.Succeeded, summary.Skipped, summary.Failed), summary)
}

func (h *Handler) BulkRoleAssignmentHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		UserIDs []int  `json:"user_ids"`
		RoleID  int    `json:"role_id"`
		Action  string `json:"action"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || len(body.UserIDs) == 0 || body.RoleID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "user_ids and role_id are required")
		return
	}
	if len(body.UserIDs) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}
	action := strings.ToLower(strings.TrimSpace(body.Action))
	if action == "" {
		action = "assign"
	}
	if action != "assign" && action != "remove" {
		httputil.WriteError(w, http.StatusBadRequest, "action must be assign or remove")
		return
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.UserIDs))}
	for i, userID := range body.UserIDs {
		result := bulkresult.ItemResult{Index: i, ID: userID}
		var err error
		if action == "assign" {
			err = h.service.AssignRole(r.Context(), projectID, userID, body.RoleID, "admin")
		} else {
			err = h.service.RemoveRole(r.Context(), projectID, userID, body.RoleID)
		}
		if err != nil {
			summary.AddFailure(result, err.Error())
			continue
		}
		result.Data = map[string]any{"user_id": userID, "role_id": body.RoleID, "action": action}
		summary.AddSuccess(result)
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk role %s completed: %d succeeded, %d failed", action, summary.Succeeded, summary.Failed), summary)
}

func (h *Handler) BulkResendOTPHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		UserIDs []int `json:"user_ids"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || len(body.UserIDs) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "user_ids array is required")
		return
	}
	if len(body.UserIDs) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.UserIDs))}
	for i, userID := range body.UserIDs {
		result := bulkresult.ItemResult{Index: i, ID: userID}
		if err := h.service.ResendOTP(r.Context(), projectID, userID); err != nil {
			summary.AddFailure(result, err.Error())
			continue
		}
		result.Data = map[string]any{"user_id": userID}
		summary.AddSuccess(result)
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk resend OTP completed: %d succeeded, %d failed", summary.Succeeded, summary.Failed), summary)
}

func (h *Handler) BulkVerifyUsersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		UserIDs []int `json:"user_ids"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil || len(body.UserIDs) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "user_ids array is required")
		return
	}
	if len(body.UserIDs) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.UserIDs))}
	for i, userID := range body.UserIDs {
		result := bulkresult.ItemResult{Index: i, ID: userID}
		if err := h.service.ManuallyVerifyUser(r.Context(), projectID, userID); err != nil {
			summary.AddFailure(result, err.Error())
			continue
		}
		result.Data = map[string]any{"user_id": userID}
		summary.AddSuccess(result)
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk verify completed: %d succeeded, %d failed", summary.Succeeded, summary.Failed), summary)
}

func filterBulkUserData(body map[string]any) (map[string]any, []int, error) {
	name, _ := body["name"].(string)
	if strings.TrimSpace(name) == "" {
		return nil, nil, fmt.Errorf("name is required")
	}

	allowed := map[string]bool{
		"name": true, "email": true, "phone": true, "metadata": true,
		"custom_field_1": true, "custom_field_2": true, "is_active": true,
		"organisation_id": true, "last_name": true,
	}
	data := make(map[string]any)
	for key, value := range body {
		if allowed[key] {
			data[key] = value
		}
	}
	if _, ok := data["is_active"]; !ok {
		data["is_active"] = true
	}

	roleIDs := make([]int, 0)
	if rawRoleIDs, ok := body["role_ids"]; ok {
		parsed, err := parseJSONIntArray(rawRoleIDs)
		if err != nil {
			return nil, nil, fmt.Errorf("role_ids must be an array of integers")
		}
		roleIDs = parsed
	}

	return data, roleIDs, nil
}

func parseJSONIntArray(value any) ([]int, error) {
	switch typed := value.(type) {
	case []int:
		return typed, nil
	case []any:
		out := make([]int, 0, len(typed))
		for _, item := range typed {
			switch n := item.(type) {
			case float64:
				out = append(out, int(n))
			case int:
				out = append(out, n)
			default:
				return nil, fmt.Errorf("invalid integer value")
			}
		}
		return out, nil
	default:
		return nil, fmt.Errorf("invalid array")
	}
}

func isDuplicateUserError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "already exists")
}
