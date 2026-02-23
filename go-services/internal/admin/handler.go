package admin

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
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
}

func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
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
