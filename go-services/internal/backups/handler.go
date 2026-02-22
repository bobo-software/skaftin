package backups

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/storage"
)

// Handler serves backup and restore endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new backups Handler.
func NewHandler(pool *pgxpool.Pool, s3 *storage.S3Client, bucket string, projectsStore *projects.Store) *Handler {
	return &Handler{service: NewService(pool, s3, bucket, projectsStore)}
}

// RegisterRoutes registers project-scoped backup routes (require project access).
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/backups/{projectId}/create", h.createBackup)
	mux.HandleFunc("GET /api/backups/{projectId}/list", h.listBackups)
	mux.HandleFunc("GET /api/backups/{projectId}/{backupId}/download", h.downloadBackup)
	mux.HandleFunc("POST /api/backups/{projectId}/{backupId}/restore", h.restoreBackup)
	mux.HandleFunc("DELETE /api/backups/{projectId}/{backupId}", h.deleteBackup)

	mux.HandleFunc("POST /api/backups/{projectId}/full", h.createFullBackup)
	mux.HandleFunc("POST /api/backups/{projectId}/cleanup", h.cleanupOldBackups)

	mux.HandleFunc("GET /api/backups/{projectId}/schedules", h.listSchedules)
	mux.HandleFunc("POST /api/backups/{projectId}/schedules", h.createSchedule)
	mux.HandleFunc("PUT /api/backups/{projectId}/schedules/{scheduleId}", h.updateSchedule)
	mux.HandleFunc("DELETE /api/backups/{projectId}/schedules/{scheduleId}", h.deleteSchedule)
}

// RegisterRestoreRoute registers the full-restore route (JWT auth only, no project access).
func (h *Handler) RegisterRestoreRoute(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/backups/restore", h.restoreFullBackup)
}

// Service returns the underlying backup service.
func (h *Handler) Service() *Service {
	return h.service
}

// SetScheduler attaches a scheduler to the service.
func (h *Handler) SetScheduler(sched *Scheduler) {
	h.service.scheduler = sched
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func parseProjectID(r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	return id, err == nil && id > 0
}

func parseScheduleID(r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("scheduleId"))
	return id, err == nil && id > 0
}

func backupFilename(r *http.Request) string {
	raw := r.PathValue("backupId")
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return raw
	}
	return decoded
}

// ---------------------------------------------------------------------------
// Database backup handlers
// ---------------------------------------------------------------------------

func (h *Handler) createBackup(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Type        string `json:"type"`
	}
	httputil.ReadJSON(r, &body)
	if body.Type == "" {
		body.Type = "database"
	}

	meta, err := h.service.CreateBackup(r.Context(), pid, body.Name, body.Description, body.Type)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create backup")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Backup created successfully", meta)
}

func (h *Handler) listBackups(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	backups, err := h.service.ListBackups(r.Context(), pid)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list backups")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Backups fetched successfully", backups)
}

func (h *Handler) downloadBackup(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	filename := backupFilename(r)
	if filename == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Backup filename is required")
		return
	}

	rc, name, err := h.service.DownloadBackup(r.Context(), pid, filename)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Backup file not found")
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	io.Copy(w, rc)
}

func (h *Handler) restoreBackup(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	filename := backupFilename(r)
	if filename == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Backup filename is required")
		return
	}

	var body struct {
		DropExisting bool `json:"dropExisting"`
	}
	httputil.ReadJSON(r, &body)

	if err := h.service.RestoreBackup(r.Context(), pid, filename, body.DropExisting); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to restore backup")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Backup restored successfully", map[string]any{
		"projectId":    pid,
		"backupId":     fmt.Sprintf("backups/%d/%s", pid, filename),
		"dropExisting": body.DropExisting,
	})
}

func (h *Handler) deleteBackup(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	filename := backupFilename(r)
	if filename == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Backup filename is required")
		return
	}

	if err := h.service.DeleteBackup(r.Context(), pid, filename); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete backup")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Backup deleted successfully", map[string]any{
		"backupId": fmt.Sprintf("backups/%d/%s", pid, filename),
	})
}

// ---------------------------------------------------------------------------
// Full backup handlers
// ---------------------------------------------------------------------------

func (h *Handler) createFullBackup(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	httputil.ReadJSON(r, &body)

	meta, err := h.service.CreateFullBackup(r.Context(), pid, body.Name, body.Description)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create full backup")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Full backup created successfully", meta)
}

func (h *Handler) restoreFullBackup(w http.ResponseWriter, r *http.Request) {
	userCtx := auth.GetUserContext(r)
	if userCtx == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body struct {
		BackupID       string `json:"backupId"`
		NewProjectName string `json:"newProjectName"`
		OrganizationID int    `json:"organizationId"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.BackupID == "" || body.NewProjectName == "" || body.OrganizationID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Backup ID, new project name, and organization ID are required")
		return
	}

	result, err := h.service.RestoreFullBackup(r.Context(), body.BackupID, body.NewProjectName, body.OrganizationID, userCtx.UserID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to restore backup")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Backup restored successfully", result)
}

func (h *Handler) cleanupOldBackups(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	var body struct {
		RetentionPolicy string `json:"retentionPolicy"`
		RetentionValue  int    `json:"retentionValue"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.RetentionPolicy != "keep_count" && body.RetentionPolicy != "keep_days" {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid retention policy")
		return
	}
	if body.RetentionValue < 1 {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid retention value")
		return
	}

	result, err := h.service.CleanupOldBackups(r.Context(), pid, body.RetentionPolicy, body.RetentionValue)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to cleanup backups")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Cleaned up %v old backups", result["deletedCount"]), result)
}

// ---------------------------------------------------------------------------
// Schedule handlers
// ---------------------------------------------------------------------------

func (h *Handler) listSchedules(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	schedules, err := h.service.store.ListSchedules(r.Context(), pid)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list backup schedules")
		return
	}
	if schedules == nil {
		schedules = []BackupSchedule{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Backup schedules fetched successfully", schedules)
}

func (h *Handler) createSchedule(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	userCtx := auth.GetUserContext(r)

	var body struct {
		Name             string  `json:"name"`
		Description      *string `json:"description"`
		Schedule         string  `json:"schedule"`
		BackupNamePrefix *string `json:"backupNamePrefix"`
		RetentionDays    *int    `json:"retentionDays"`
		BackupType       string  `json:"backupType"`
		RetentionPolicy  string  `json:"retentionPolicy"`
		RetentionValue   *int    `json:"retentionValue"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Name == "" || body.Schedule == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Name and schedule are required")
		return
	}

	if !validateCron(body.Schedule) {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid cron schedule format")
		return
	}

	if body.BackupType == "" {
		body.BackupType = "database"
	}
	if body.RetentionPolicy == "" {
		body.RetentionPolicy = "keep_all"
	}

	var createdBy *string
	if userCtx != nil {
		createdBy = &userCtx.UserID
	}

	sched, err := h.service.store.CreateSchedule(r.Context(), CreateScheduleParams{
		ProjectID:        pid,
		Name:             body.Name,
		Description:      body.Description,
		Schedule:         body.Schedule,
		BackupNamePrefix: body.BackupNamePrefix,
		RetentionDays:    body.RetentionDays,
		CreatedBy:        createdBy,
		BackupType:       body.BackupType,
		RetentionPolicy:  body.RetentionPolicy,
		RetentionValue:   body.RetentionValue,
	})
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create backup schedule")
		return
	}

	if h.service.scheduler != nil {
		h.service.scheduler.Schedule(r.Context(), sched.ID)
	}

	httputil.WriteSuccess(w, http.StatusOK, "Backup schedule created successfully", sched)
}

func (h *Handler) updateSchedule(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	sid, ok := parseScheduleID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Schedule ID is required")
		return
	}

	existing, err := h.service.store.GetSchedule(r.Context(), sid, pid)
	if err != nil || existing == nil {
		httputil.WriteError(w, http.StatusNotFound, "Backup schedule not found")
		return
	}

	var body struct {
		Name             *string `json:"name"`
		Description      *string `json:"description"`
		Schedule         *string `json:"schedule"`
		Enabled          *bool   `json:"enabled"`
		BackupNamePrefix *string `json:"backupNamePrefix"`
		RetentionDays    *int    `json:"retentionDays"`
		BackupType       *string `json:"backupType"`
		RetentionPolicy  *string `json:"retentionPolicy"`
		RetentionValue   *int    `json:"retentionValue"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Schedule != nil && !validateCron(*body.Schedule) {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid cron schedule format")
		return
	}

	updated, err := h.service.store.UpdateSchedule(r.Context(), sid, UpdateScheduleParams{
		Name:             body.Name,
		Description:      body.Description,
		Schedule:         body.Schedule,
		Enabled:          body.Enabled,
		BackupNamePrefix: body.BackupNamePrefix,
		RetentionDays:    body.RetentionDays,
		BackupType:       body.BackupType,
		RetentionPolicy:  body.RetentionPolicy,
		RetentionValue:   body.RetentionValue,
	})
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update backup schedule")
		return
	}

	if h.service.scheduler != nil && (body.Schedule != nil || body.Enabled != nil) {
		h.service.scheduler.Unschedule(sid)
		if updated.Enabled {
			h.service.scheduler.Schedule(r.Context(), sid)
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, "Backup schedule updated successfully", updated)
}

func (h *Handler) deleteSchedule(w http.ResponseWriter, r *http.Request) {
	pid, ok := parseProjectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	sid, ok := parseScheduleID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Schedule ID is required")
		return
	}

	existing, err := h.service.store.GetSchedule(r.Context(), sid, pid)
	if err != nil || existing == nil {
		httputil.WriteError(w, http.StatusNotFound, "Backup schedule not found")
		return
	}

	if h.service.scheduler != nil {
		h.service.scheduler.Unschedule(sid)
	}

	if err := h.service.store.DeleteSchedule(r.Context(), sid); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete backup schedule")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "Backup schedule deleted successfully", map[string]any{
		"scheduleId": sid,
	})
}
