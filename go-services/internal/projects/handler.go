package projects

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves project and bucket endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new projects Handler.
func NewHandler(pool *pgxpool.Pool, cfg *config.Config) (*Handler, error) {
	svc, err := NewService(pool, cfg.MinIO)
	if err != nil {
		return nil, err
	}
	return &Handler{service: svc}, nil
}

// RegisterRoutes registers all project and bucket routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Project CRUD
	mux.HandleFunc("GET /api/projects/list", h.ListProjects)
	mux.HandleFunc("GET /api/projects/dashboard-stats", h.GetDashboardStats)
	mux.HandleFunc("POST /api/projects/create", h.CreateProject)
	mux.HandleFunc("GET /api/projects/{id}", h.GetProject)
	mux.HandleFunc("PUT /api/projects/update/{id}", h.UpdateProject)
	mux.HandleFunc("DELETE /api/projects/delete/{id}", h.DeleteProject)
	mux.HandleFunc("POST /api/projects/{id}/reset", h.ResetProject)
	mux.HandleFunc("GET /api/projects/{id}/stats", h.GetProjectStats)

	// Bucket management
	mux.HandleFunc("GET /api/projects/{projectId}/buckets", h.ListBuckets)
	mux.HandleFunc("POST /api/projects/{projectId}/buckets", h.CreateBucket)
	mux.HandleFunc("GET /api/projects/{projectId}/buckets/{bucketId}", h.GetBucket)
	mux.HandleFunc("PUT /api/projects/{projectId}/buckets/{bucketId}", h.UpdateBucket)
	mux.HandleFunc("DELETE /api/projects/{projectId}/buckets/{bucketId}", h.DeleteBucket)
	mux.HandleFunc("GET /api/projects/{projectId}/buckets/{bucketId}/policy", h.GetBucketPolicy)
	mux.HandleFunc("PUT /api/projects/{projectId}/buckets/{bucketId}/policy", h.SetBucketPolicy)
	mux.HandleFunc("GET /api/projects/{projectId}/buckets/{bucketId}/stats", h.GetBucketStats)
}

// --- helpers ---

func userCtx(r *http.Request) *model.UserContext {
	return auth.GetUserContext(r)
}

func requireUser(w http.ResponseWriter, r *http.Request) *model.UserContext {
	u := userCtx(r)
	if u == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return nil
	}
	return u
}

func pathInt(r *http.Request, name string) (int, bool) {
	v, err := strconv.Atoi(r.PathValue(name))
	if err != nil {
		return 0, false
	}
	return v, true
}

func decodeBody(r *http.Request, dst any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}

// requireProjectAccess checks access for routes that use {id} (not {projectId}).
func (h *Handler) requireProjectAccess(w http.ResponseWriter, r *http.Request, userID string, requiredRoles ...string) (*Project, *AccessResult) {
	id, ok := pathInt(r, "id")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid project ID")
		return nil, nil
	}

	project, err := h.service.GetProject(r.Context(), id)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Project not found")
		return nil, nil
	}

	u := userCtx(r)
	if u != nil && u.Role == "admin" {
		return project, &AccessResult{HasAccess: true, Role: "admin"}
	}

	access, err := h.service.CheckProjectAccess(r.Context(), id, userID)
	if err != nil || !access.HasAccess {
		httputil.WriteError(w, http.StatusForbidden, "You do not have access to this project")
		return nil, nil
	}

	if len(requiredRoles) > 0 {
		allowed := false
		for _, rr := range requiredRoles {
			if access.Role == rr {
				allowed = true
				break
			}
		}
		if !allowed {
			httputil.WriteError(w, http.StatusForbidden, "You do not have permission for this action")
			return nil, nil
		}
	}

	return project, access
}

// requireBucketProjectAccess checks access for routes that use {projectId}.
func (h *Handler) requireBucketProjectAccess(w http.ResponseWriter, r *http.Request, userID string) (int, bool) {
	projectID, ok := pathInt(r, "projectId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid project ID")
		return 0, false
	}

	u := userCtx(r)
	if u != nil && u.Role == "admin" {
		return projectID, true
	}

	access, err := h.service.CheckProjectAccess(r.Context(), projectID, userID)
	if err != nil || !access.HasAccess {
		httputil.WriteError(w, http.StatusForbidden, "Project not found or access denied")
		return 0, false
	}

	return projectID, true
}
