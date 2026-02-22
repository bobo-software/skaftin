package users

import (
	"log/slog"
	"net/http"
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

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/users/me", h.GetCurrentUser)
	mux.HandleFunc("PUT /api/users/me", h.UpdateProfile)
	mux.HandleFunc("PUT /api/users/me/password", h.ChangePassword)
	mux.HandleFunc("DELETE /api/users/me", h.DeleteAccount)

	mux.HandleFunc("GET /api/users/list", h.ListUsers)
	mux.HandleFunc("POST /api/users/create", h.CreateUser)
}

func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	user, err := h.service.GetCurrentUser(r.Context(), u.UserID, u.ProjectIDs, u.Role)
	if err != nil {
		slog.Error("failed to get current user", "error", err, "userId", u.UserID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get user info")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "User info retrieved successfully", map[string]any{
		"user": user,
	})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	coreUser, err := h.service.st.GetUserByID(r.Context(), u.UserID)
	if err != nil {
		slog.Error("failed to fetch user email", "error", err, "userId", u.UserID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get user info")
		return
	}
	if len(coreUser.Emails) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "User email not found")
		return
	}
	currentEmail := coreUser.Emails[0]

	var body ProfileUpdate
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), u.UserID, currentEmail, body)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			httputil.WriteError(w, http.StatusNotFound, "User not found in database")
			return
		}
		slog.Error("failed to update profile", "error", err, "userId", u.UserID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Profile updated successfully", map[string]any{
		"user": map[string]any{
			"id":    updated.ID,
			"email": updated.Email,
			"name":  updated.FullName,
		},
	})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	coreUser, err := h.service.st.GetUserByID(r.Context(), u.UserID)
	if err != nil || len(coreUser.Emails) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "User email not found")
		return
	}

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err = h.service.ChangePassword(r.Context(), u.UserID, coreUser.Emails[0], body.CurrentPassword, body.NewPassword)
	if err != nil {
		msg := err.Error()
		switch {
		case strings.HasPrefix(msg, "validation: passwords required"):
			httputil.WriteError(w, http.StatusBadRequest, "Current password and new password are required")
		case strings.HasPrefix(msg, "validation: password too short"):
			httputil.WriteError(w, http.StatusBadRequest, "New password must be at least 8 characters long")
		case strings.HasPrefix(msg, "validation: same password"):
			httputil.WriteError(w, http.StatusBadRequest, "New password must be different from current password")
		case strings.HasPrefix(msg, "wrong password"):
			httputil.WriteError(w, http.StatusUnauthorized, "Current password is incorrect")
		default:
			slog.Error("failed to change password", "error", err, "userId", u.UserID)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update password")
		}
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Password changed successfully", map[string]any{
		"message": "Your password has been changed successfully.",
	})
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	if err := h.service.DeleteAccount(r.Context(), u.UserID); err != nil {
		slog.Error("failed to delete account", "error", err, "userId", u.UserID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete account")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Account deleted successfully", nil)
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}
	if u.Role != "admin" {
		httputil.WriteError(w, http.StatusForbidden, "Admin access required")
		return
	}

	users, err := h.service.ListAll(r.Context())
	if err != nil {
		slog.Error("failed to list users", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Users fetched successfully", users)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}
	if u.Role != "admin" {
		httputil.WriteError(w, http.StatusForbidden, "Admin access required")
		return
	}

	var body struct {
		Username string  `json:"username"`
		Email    string  `json:"email"`
		FullName *string `json:"full_name"`
		LastName *string `json:"last_name"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.service.Create(r.Context(), body.Username, body.Email, body.FullName, body.LastName)
	if err != nil {
		msg := err.Error()
		switch {
		case msg == "validation":
			httputil.WriteError(w, http.StatusBadRequest, "Username and email are required")
		case strings.Contains(msg, "23505"):
			httputil.WriteError(w, http.StatusConflict, "Username or email already exists")
		default:
			slog.Error("failed to create user", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to create user")
		}
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "User created successfully", user)
}
