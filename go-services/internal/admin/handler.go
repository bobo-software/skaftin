package admin

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

type Handler struct {
	service *Service
}

func NewHandler(pool *pgxpool.Pool, st *supertokens.Client) *Handler {
	return &Handler{service: NewService(pool, st)}
}

// RegisterPublicRoutes registers unauthenticated admin routes.
func (h *Handler) RegisterPublicRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/admin/users/check-email", h.CheckEmail)
}

// RegisterProtectedRoutes registers JWT-protected admin routes.
func (h *Handler) RegisterProtectedRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/admin/users/search", h.SearchUsers)
	mux.HandleFunc("DELETE /api/admin/users/{userId}", h.DeleteUserByID)
	mux.HandleFunc("POST /api/admin/users/delete-by-email", h.DeleteUserByEmail)
	mux.HandleFunc("POST /api/admin/users/complete-cleanup", h.CompleteCleanup)
	mux.HandleFunc("GET /api/admin/supertokens/users", h.SearchSuperTokensUsers)
	mux.HandleFunc("GET /api/admin/supertokens/users/{userId}", h.GetSuperTokensUserByID)
	mux.HandleFunc("POST /api/admin/supertokens/users/{userId}/revoke-sessions", h.RevokeSuperTokensUserSessions)
	mux.HandleFunc("DELETE /api/admin/supertokens/users/{userId}", h.DeleteSuperTokensUserByID)
}

func requireAdminUser(w http.ResponseWriter, r *http.Request) bool {
	u := auth.RequireUser(w, r)
	if u == nil {
		return false
	}
	if u.Role != "admin" {
		httputil.WriteError(w, http.StatusForbidden, "Admin access required")
		return false
	}
	return true
}

func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	email := r.URL.Query().Get("email")
	if email == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email query parameter is required")
		return
	}

	users, err := h.service.SearchUsersByEmail(r.Context(), email)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to search users")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Users found", users)
}

func (h *Handler) CheckEmail(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email query parameter is required")
		return
	}

	exists, userInfo, err := h.service.CheckEmail(r.Context(), email)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to check email")
		return
	}

	if exists {
		httputil.WriteSuccess(w, http.StatusOK, "Email exists", map[string]any{
			"exists": true,
			"user":   userInfo,
		})
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Email does not exist", map[string]any{
		"exists": false,
		"user":   nil,
	})
}

func (h *Handler) DeleteUserByID(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	userID := r.PathValue("userId")
	if userID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	if err := h.service.DeleteUserByID(r.Context(), userID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "User deleted successfully from SuperTokens", nil)
}

func (h *Handler) DeleteUserByEmail(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	var body struct {
		Email   string `json:"email"`
		Confirm bool   `json:"confirm"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Email == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email is required")
		return
	}
	if !body.Confirm {
		httputil.WriteError(w, http.StatusBadRequest, "Confirmation required (confirm: true)")
		return
	}

	deletedIDs, err := h.service.DeleteUsersByEmail(r.Context(), body.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "User not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Deleted "+strconv.Itoa(len(deletedIDs))+" user(s)", map[string]any{
		"deletedUserIds": deletedIDs,
	})
}

func (h *Handler) CompleteCleanup(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	var body struct {
		Email     string `json:"email"`
		ProjectID any    `json:"projectId"`
		Confirm   bool   `json:"confirm"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Email == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email is required")
		return
	}
	if !body.Confirm {
		httputil.WriteError(w, http.StatusBadRequest, "Confirmation required (confirm: true)")
		return
	}

	projectID, ok := parseOptionalProjectID(body.ProjectID)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid projectId")
		return
	}

	result := h.service.CompleteUserCleanup(r.Context(), body.Email, projectID)
	msg := "User completely removed"
	if !result.Success {
		msg = "Cleanup completed with some errors"
	}

	httputil.WriteSuccess(w, http.StatusOK, msg, map[string]any{
		"email":                  body.Email,
		"deletedFromSuperTokens": result.DeletedFromSuperTokens,
		"deletedFromAppUsers":    result.DeletedFromAppUsers,
		"deletedRoleAssignments": result.DeletedRoleAssignments,
		"errors":                 result.Errors,
	})
}

func (h *Handler) SearchSuperTokensUsers(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("query"))
	users, err := h.service.SearchSuperTokensUsers(r.Context(), query)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to search SuperTokens users")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "SuperTokens users fetched successfully", users)
}

func (h *Handler) GetSuperTokensUserByID(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	userID := strings.TrimSpace(r.PathValue("userId"))
	if userID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	user, err := h.service.GetSuperTokensUserByID(r.Context(), userID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			httputil.WriteError(w, http.StatusNotFound, "SuperTokens user not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch SuperTokens user")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "SuperTokens user fetched successfully", user)
}

func (h *Handler) RevokeSuperTokensUserSessions(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	userID := strings.TrimSpace(r.PathValue("userId"))
	if userID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	result, err := h.service.RevokeUserSessions(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to revoke sessions")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Sessions revoked successfully", map[string]any{
		"status":                result.Status,
		"sessionHandlesRevoked": result.SessionHandlesRevoked,
	})
}

func (h *Handler) DeleteSuperTokensUserByID(w http.ResponseWriter, r *http.Request) {
	if !requireAdminUser(w, r) {
		return
	}

	userID := strings.TrimSpace(r.PathValue("userId"))
	if userID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	if err := h.service.DeleteUserByID(r.Context(), userID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete SuperTokens user")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "SuperTokens user deleted successfully", map[string]any{
		"userId": userID,
	})
}

func parseOptionalProjectID(v any) (*int, bool) {
	if v == nil {
		return nil, true
	}

	switch t := v.(type) {
	case float64:
		id := int(t)
		if id <= 0 {
			return nil, false
		}
		return &id, true
	case string:
		if t == "" {
			return nil, true
		}
		id, err := strconv.Atoi(t)
		if err != nil || id <= 0 {
			return nil, false
		}
		return &id, true
	default:
		return nil, false
	}
}
