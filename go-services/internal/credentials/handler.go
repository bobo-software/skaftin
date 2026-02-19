package credentials

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves API key and access token management endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new credentials Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers this domain's routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/credentials/permissions", h.GetAvailablePermissions)
	mux.HandleFunc("GET /api/credentials/{projectId}/credentials", h.ListCredentials)
	mux.HandleFunc("POST /api/credentials/{projectId}/credentials", h.CreateCredential)
	mux.HandleFunc("PUT /api/credentials/{projectId}/credentials/{credentialId}", h.UpdateCredential)
	mux.HandleFunc("DELETE /api/credentials/{projectId}/credentials/{credentialId}", h.DeleteCredential)
	mux.HandleFunc("GET /api/credentials/{projectId}/mcp-key", h.GetMcpKey)
	mux.HandleFunc("POST /api/credentials/{projectId}/mcp-key/regenerate", h.RegenerateMcpKey)
}

func (h *Handler) requireProjectAccess(w http.ResponseWriter, r *http.Request) (int, string, bool) {
	projectID, ok := httputil.ProjectID(w, r)
	if !ok {
		return 0, "", false
	}

	u := auth.RequireUser(w, r)
	if u == nil {
		return 0, "", false
	}

	if u.Role == "admin" {
		return projectID, u.UserID, true
	}

	for _, id := range u.ProjectIDs {
		if int(id) == projectID {
			return projectID, u.UserID, true
		}
	}

	httputil.WriteError(w, http.StatusForbidden, "You do not have access to this project")
	return 0, "", false
}

func (h *Handler) GetAvailablePermissions(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    AvailablePermissions,
	})
}

func (h *Handler) ListCredentials(w http.ResponseWriter, r *http.Request) {
	projectID, _, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	creds, err := h.service.ListCredentials(r.Context(), projectID)
	if err != nil {
		slog.Error("failed to list credentials", "error", err, "projectId", projectID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list credentials")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    creds,
		"count":   len(creds),
	})
}

func (h *Handler) CreateCredential(w http.ResponseWriter, r *http.Request) {
	projectID, userID, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	var req CreateRequest
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	slog.Info("creating credential",
		"projectId", projectID,
		"name", req.Name,
		"type", req.CredentialType,
	)

	cred, err := h.service.CreateCredential(r.Context(), projectID, userID, req)
	if err != nil {
		var conflict *ConflictError
		if errors.As(err, &conflict) {
			httputil.WriteError(w, http.StatusConflict, conflict.Message)
			return
		}
		if err.Error() == "name and credential_type are required" ||
			err.Error() == "invalid credential_type, must be api_key, access_token, or mcp_key" {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		slog.Error("failed to create credential", "error", err, "projectId", projectID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create credential")
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data":    cred,
		"message": "Credential created successfully",
	})
}

func (h *Handler) UpdateCredential(w http.ResponseWriter, r *http.Request) {
	projectID, _, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	credentialID, idOk := httputil.PathInt(r, "credentialId")
	if !idOk {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid credential ID")
		return
	}

	var req UpdateRequest
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cred, err := h.service.UpdateCredential(r.Context(), credentialID, projectID, req)
	if err != nil {
		var notFound *NotFoundError
		if errors.As(err, &notFound) {
			httputil.WriteError(w, http.StatusNotFound, notFound.Message)
			return
		}
		if err.Error() == "no fields to update" {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		slog.Error("failed to update credential", "error", err, "credentialId", credentialID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update credential")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    cred,
		"message": "Credential updated successfully",
	})
}

func (h *Handler) DeleteCredential(w http.ResponseWriter, r *http.Request) {
	projectID, _, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	credentialID, idOk := httputil.PathInt(r, "credentialId")
	if !idOk {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid credential ID")
		return
	}

	err := h.service.DeleteCredential(r.Context(), credentialID, projectID)
	if err != nil {
		var notFound *NotFoundError
		if errors.As(err, &notFound) {
			httputil.WriteError(w, http.StatusNotFound, notFound.Message)
			return
		}
		slog.Error("failed to delete credential", "error", err, "credentialId", credentialID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to revoke credential")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Credential revoked successfully",
	})
}

func (h *Handler) GetMcpKey(w http.ResponseWriter, r *http.Request) {
	projectID, _, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	cred, err := h.service.GetMcpKey(r.Context(), projectID)
	if err != nil {
		var notFound *NotFoundError
		if errors.As(err, &notFound) {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]any{
				"success": false,
				"error":   notFound.Message,
				"data":    nil,
			})
			return
		}
		slog.Error("failed to get MCP key", "error", err, "projectId", projectID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get MCP key")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    cred,
	})
}

func (h *Handler) RegenerateMcpKey(w http.ResponseWriter, r *http.Request) {
	projectID, userID, ok := h.requireProjectAccess(w, r)
	if !ok {
		return
	}

	slog.Info("regenerating MCP key", "projectId", projectID)

	cred, created, err := h.service.RegenerateMcpKey(r.Context(), projectID, userID)
	if err != nil {
		slog.Error("failed to regenerate MCP key", "error", err, "projectId", projectID)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to regenerate MCP key")
		return
	}

	status := http.StatusOK
	msg := "MCP key regenerated successfully"
	if created {
		status = http.StatusCreated
		msg = "MCP key created successfully"
	}

	httputil.WriteJSON(w, status, map[string]any{
		"success": true,
		"data":    cred,
		"message": msg,
	})
}
