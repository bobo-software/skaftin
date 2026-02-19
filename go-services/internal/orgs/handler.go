package orgs

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves organization endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new orgs Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers all organization routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Organization CRUD
	mux.HandleFunc("GET /api/organizations/list", h.ListOrganizations)
	mux.HandleFunc("GET /api/organizations/{id}", h.GetOrganization)
	mux.HandleFunc("POST /api/organizations/create", h.CreateOrganization)
	mux.HandleFunc("PUT /api/organizations/{id}", h.UpdateOrganization)
	mux.HandleFunc("DELETE /api/organizations/{id}", h.DeleteOrganization)

	// Member management
	mux.HandleFunc("GET /api/organizations/{id}/members", h.ListMembers)
	mux.HandleFunc("POST /api/organizations/{id}/members", h.AddMember)
	mux.HandleFunc("POST /api/organizations/{id}/members/by-user-id", h.AddMemberByUserID)
	mux.HandleFunc("PUT /api/organizations/{id}/members/{memberId}", h.UpdateMemberRole)
	mux.HandleFunc("DELETE /api/organizations/{id}/members/{memberId}", h.RemoveMember)
}

// --- Organization CRUD handlers ---

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgs, err := h.service.ListUserOrgs(r.Context(), u.UserID)
	if err != nil {
		slog.Error("failed to list organizations", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch organizations")
		return
	}
	if orgs == nil {
		orgs = []OrgWithRole{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Organizations retrieved successfully", orgs)
}

func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	detail, err := h.service.GetOrgDetail(r.Context(), orgID, u.UserID)
	if err != nil {
		if err.Error() == "forbidden" {
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
			return
		}
		if err.Error() == "not found" {
			httputil.WriteError(w, http.StatusNotFound, "Organization not found")
			return
		}
		slog.Error("failed to get organization", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch organization")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Organization retrieved successfully", detail)
}

func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(body.Name) == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Organization name is required")
		return
	}

	org, err := h.service.CreateOrg(r.Context(), body.Name, body.Description, u.UserID)
	if err != nil {
		slog.Error("failed to create organization", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create organization")
		return
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Organization created successfully", org)
}

func (h *Handler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	var raw map[string]any
	if err := httputil.DecodeBody(r, &raw); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var namePtr *string
	if v, ok := raw["name"]; ok {
		if s, ok := v.(string); ok {
			namePtr = &s
		}
	}

	var descPtr *string
	descExplicit := false
	if v, exists := raw["description"]; exists {
		descExplicit = true
		if v == nil {
			descPtr = nil
		} else if s, ok := v.(string); ok {
			descPtr = &s
		}
	}

	org, err := h.service.UpdateOrg(r.Context(), orgID, u.UserID, namePtr, descPtr, descExplicit)
	if err != nil {
		switch err.Error() {
		case "forbidden":
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
		case "not found":
			httputil.WriteError(w, http.StatusNotFound, "Organization not found")
		case "permission denied":
			httputil.WriteError(w, http.StatusForbidden, "You do not have permission to update this organization")
		default:
			slog.Error("failed to update organization", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update organization")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Organization updated successfully", org)
}

func (h *Handler) DeleteOrganization(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	err := h.service.DeleteOrg(r.Context(), orgID, u.UserID)
	if err != nil {
		switch err.Error() {
		case "not found":
			httputil.WriteError(w, http.StatusNotFound, "Organization not found")
		case "only owner":
			httputil.WriteError(w, http.StatusForbidden, "Only the organization owner can delete it")
		default:
			slog.Error("failed to delete organization", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete organization")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Organization deleted successfully", nil)
}

// --- Member management handlers ---

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	members, err := h.service.ListMembers(r.Context(), orgID, u.UserID)
	if err != nil {
		if err.Error() == "forbidden" {
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
			return
		}
		slog.Error("failed to list members", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch members")
		return
	}
	if members == nil {
		members = []Member{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Members retrieved successfully", members)
}

// AddMember (by email) returns 501 -- not implemented, matching Node behavior.
func (h *Handler) AddMember(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	httputil.WriteError(w, http.StatusNotImplemented,
		"Adding members by email requires email invitation system (not yet implemented). Please provide user_id instead.")
}

func (h *Handler) AddMemberByUserID(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	var body struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.UserID == "" || body.Role == "" {
		httputil.WriteError(w, http.StatusBadRequest, "user_id and role are required")
		return
	}

	if !validRoles[body.Role] {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid role")
		return
	}

	member, err := h.service.AddMemberByUserID(r.Context(), orgID, u.UserID, body.UserID, body.Role)
	if err != nil {
		switch err.Error() {
		case "forbidden":
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
		case "only admins and owners":
			httputil.WriteError(w, http.StatusForbidden, "Only admins and owners can add members")
		case "already member":
			httputil.WriteError(w, http.StatusConflict, "User is already a member of this organization")
		case "invalid role":
			httputil.WriteError(w, http.StatusBadRequest, "Invalid role")
		default:
			slog.Error("failed to add member", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to add member")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Member added successfully", member)
}

func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	memberID, ok := httputil.PathInt(r, "memberId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid member ID")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !validRoles[body.Role] {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid role")
		return
	}

	member, err := h.service.UpdateMemberRole(r.Context(), orgID, memberID, u.UserID, body.Role)
	if err != nil {
		switch err.Error() {
		case "forbidden":
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
		case "only admins and owners":
			httputil.WriteError(w, http.StatusForbidden, "Only admins and owners can update member roles")
		case "not found":
			httputil.WriteError(w, http.StatusNotFound, "Organization not found")
		case "member not found":
			httputil.WriteError(w, http.StatusNotFound, "Member not found")
		case "cannot change owner role":
			httputil.WriteError(w, http.StatusForbidden, "Cannot change the owner's role")
		default:
			slog.Error("failed to update member role", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to update member role")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Member role updated successfully", member)
}

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	orgID, ok := httputil.PathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid organization ID")
		return
	}

	memberID, ok := httputil.PathInt(r, "memberId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid member ID")
		return
	}

	err := h.service.RemoveMember(r.Context(), orgID, memberID, u.UserID)
	if err != nil {
		switch err.Error() {
		case "forbidden":
			httputil.WriteError(w, http.StatusForbidden, "You do not have access to this organization")
		case "not found":
			httputil.WriteError(w, http.StatusNotFound, "Organization not found")
		case "member not found":
			httputil.WriteError(w, http.StatusNotFound, "Member not found")
		case "cannot remove owner":
			httputil.WriteError(w, http.StatusForbidden, "Cannot remove the organization owner")
		case "permission denied":
			httputil.WriteError(w, http.StatusForbidden, "You do not have permission to remove this member")
		default:
			slog.Error("failed to remove member", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to remove member")
		}
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Member removed successfully", nil)
}
