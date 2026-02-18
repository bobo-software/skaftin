package projects

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// ListProjects returns all projects the authenticated user can access.
func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	projects, err := h.service.ListUserProjects(r.Context(), u.UserID)
	if err != nil {
		slog.Error("failed to list projects", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch projects")
		return
	}
	if projects == nil {
		projects = []Project{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Projects fetched successfully", projects)
}

// GetDashboardStats returns aggregated stats across all user projects.
func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	stats, err := h.service.GetDashboardStats(r.Context(), u.UserID)
	if err != nil {
		slog.Error("failed to get dashboard stats", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch dashboard statistics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Dashboard statistics fetched successfully", stats)
}

// CreateProject creates a new project.
func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	var body struct {
		Name           string `json:"name"`
		Description    string `json:"description"`
		OrganizationID *int   `json:"organization_id"`
	}
	if err := decodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(body.Name) == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Project name is required")
		return
	}
	if body.OrganizationID == nil || *body.OrganizationID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Organization ID is required")
		return
	}

	project, err := h.service.CreateProject(r.Context(), body.Name, body.Description, *body.OrganizationID, u.UserID)
	if err != nil {
		slog.Error("failed to create project", "error", err)
		httputil.WriteError(w, http.StatusForbidden, err.Error())
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Project created successfully", project)
}

// GetProject returns a single project by ID.
func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	project, _ := h.requireProjectAccess(w, r, u.UserID)
	if project == nil {
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Project fetched successfully", project)
}

// UpdateProject updates an existing project.
func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	project, _ := h.requireProjectAccess(w, r, u.UserID, "admin", "dev")
	if project == nil {
		return
	}

	var body struct {
		Name               *string `json:"name"`
		Description        *string `json:"description"`
		FieldEncryptionKey *string `json:"field_encryption_key"`
	}
	if err := decodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Trim name/description
	if body.Name != nil {
		trimmed := strings.TrimSpace(*body.Name)
		body.Name = &trimmed
	}
	if body.Description != nil {
		trimmed := strings.TrimSpace(*body.Description)
		if trimmed == "" {
			body.Description = nil
		} else {
			body.Description = &trimmed
		}
	}

	clearEncKey := false
	if body.FieldEncryptionKey != nil && (*body.FieldEncryptionKey == "" || *body.FieldEncryptionKey == "null") {
		clearEncKey = true
		body.FieldEncryptionKey = nil
	}

	updated, err := h.service.UpdateProject(r.Context(), project.ID, body.Name, body.Description, body.FieldEncryptionKey, clearEncKey)
	if err != nil {
		slog.Error("failed to update project", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update project")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Project updated successfully", updated)
}

// DeleteProject deletes a project.
func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	project, _ := h.requireProjectAccess(w, r, u.UserID, "admin")
	if project == nil {
		return
	}

	if err := h.service.DeleteProject(r.Context(), project.ID); err != nil {
		slog.Error("failed to delete project", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete project")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Project deleted successfully", nil)
}

// ResetProject resets a project's database tables and storage.
func (h *Handler) ResetProject(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	project, _ := h.requireProjectAccess(w, r, u.UserID, "admin", "dev")
	if project == nil {
		return
	}

	result, err := h.service.ResetProject(r.Context(), project)
	if err != nil {
		slog.Error("failed to reset project", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to reset project")
		return
	}

	msg := fmt.Sprintf("Project reset successfully. Dropped %d tables and deleted %d files.", result.DroppedTables, result.DeletedFiles)
	if result.ErrorCount > 0 {
		msg = fmt.Sprintf("Project reset completed with warnings. Dropped %d tables, deleted %d files, %d errors occurred.", result.DroppedTables, result.DeletedFiles, result.ErrorCount)
	}
	httputil.WriteSuccess(w, http.StatusOK, msg, result)
}

// GetProjectStats returns stats for a single project.
func (h *Handler) GetProjectStats(w http.ResponseWriter, r *http.Request) {
	u := requireUser(w, r)
	if u == nil {
		return
	}

	project, _ := h.requireProjectAccess(w, r, u.UserID)
	if project == nil {
		return
	}

	stats, err := h.service.GetProjectStats(r.Context(), project)
	if err != nil {
		slog.Error("failed to get project stats", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch project statistics")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Project statistics fetched successfully", stats)
}
