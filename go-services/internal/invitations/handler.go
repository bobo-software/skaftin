package invitations

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

type Handler struct {
	service *Service
}

func NewHandler(pool *pgxpool.Pool, comms *communications.Service, frontendURL string) *Handler {
	return &Handler{service: NewService(pool, comms, frontendURL)}
}

// RegisterPublicRoutes registers unauthenticated routes.
func (h *Handler) RegisterPublicRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/invitations/code/{inviteCode}", h.GetByCode)
}

// RegisterAuthRoutes registers JWT-authenticated routes (no project check).
func (h *Handler) RegisterAuthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/invitations/accept/{inviteCode}", h.Accept)
}

// RegisterProjectRoutes registers JWT + project-access routes.
func (h *Handler) RegisterProjectRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/invitations/{projectId}/invitations", h.ListInvitations)
	mux.HandleFunc("POST /api/invitations/{projectId}/invitations", h.CreateInvitation)
	mux.HandleFunc("DELETE /api/invitations/{projectId}/invitations/{invitationId}", h.RevokeInvitation)
	mux.HandleFunc("GET /api/invitations/{projectId}/members", h.ListMembers)
	mux.HandleFunc("DELETE /api/invitations/{projectId}/members/{memberId}", h.RemoveMember)
}

func (h *Handler) GetByCode(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("inviteCode")
	if code == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Invite code is required"})
		return
	}

	inv, status, err := h.service.GetInvitationByCode(r.Context(), code)
	if err != nil {
		httputil.WriteJSON(w, status, map[string]any{"success": false, "error": err.Error()})
		return
	}

	httputil.WriteSuccess(w, 200, "Invitation retrieved successfully", inv)
}

func (h *Handler) Accept(w http.ResponseWriter, r *http.Request) {
	user := auth.RequireUser(w, r)
	if user == nil {
		return
	}

	code := r.PathValue("inviteCode")
	if code == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Invite code is required"})
		return
	}

	member, status, err := h.service.AcceptInvitation(r.Context(), code, user.UserID)
	if err != nil {
		httputil.WriteJSON(w, status, map[string]any{"success": false, "error": err.Error()})
		return
	}

	httputil.WriteSuccess(w, 200, "Invitation accepted successfully", member)
}

func (h *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	status := r.URL.Query().Get("status")
	list, err := h.service.ListInvitations(r.Context(), projectID, status)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}

	httputil.WriteSuccess(w, 200, "Invitations listed successfully", list)
}

func (h *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	user := auth.RequireUser(w, r)
	if user == nil {
		return
	}

	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	var body struct {
		Email           string `json:"email"`
		Role            string `json:"role"`
		EmailProviderID int    `json:"email_provider_id"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}

	inv, inviteLink, err := h.service.CreateInvitation(r.Context(), projectID, body.Email, body.Role, user.UserID, body.EmailProviderID)
	if err != nil {
		msg := err.Error()
		switch msg {
		case "Email is required":
			httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": msg})
		case "Invitation already exists for this email", "User is already a member of this project":
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": msg})
		case "Project not found":
			httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": msg})
		default:
			httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to create invitation", "message": msg})
		}
		return
	}

	httputil.WriteSuccess(w, 201, "Invitation created successfully", map[string]any{"invitation": inv, "invite_link": inviteLink})
}

func (h *Handler) RevokeInvitation(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	invitationID, err := strconv.Atoi(r.PathValue("invitationId"))
	if err != nil || invitationID <= 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Invalid invitation ID"})
		return
	}

	revoked, err := h.service.RevokeInvitation(r.Context(), invitationID, projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	if !revoked {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Invitation not found or already processed"})
		return
	}

	httputil.WriteSuccess(w, 200, "Invitation revoked successfully", nil)
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	list, err := h.service.ListMembers(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}

	httputil.WriteSuccess(w, 200, "Members listed successfully", list)
}

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}

	memberID, err := strconv.Atoi(r.PathValue("memberId"))
	if err != nil || memberID <= 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Invalid member ID"})
		return
	}

	removed, err := h.service.RemoveMember(r.Context(), memberID, projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	if !removed {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Member not found"})
		return
	}

	httputil.WriteSuccess(w, 200, "Member removed successfully", nil)
}

func parseProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Project ID is required"})
		return 0, false
	}
	return id, true
}
