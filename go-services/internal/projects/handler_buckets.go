package projects

import (
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

var bucketNameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)

// ListBuckets returns all buckets for a project with file stats.
func (h *Handler) ListBuckets(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	buckets, err := h.service.ListBuckets(r.Context(), projectID)
	if err != nil {
		slog.Error("failed to list buckets", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list buckets")
		return
	}
	if buckets == nil {
		buckets = []map[string]any{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Buckets listed successfully", buckets)
}

// CreateBucket creates a new bucket for a project.
func (h *Handler) CreateBucket(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	var body struct {
		BucketName   string  `json:"bucketName"`
		Description  *string `json:"description"`
		AccessPolicy string  `json:"accessPolicy"`
		// snake_case alias
		AccessPolicySnake string `json:"access_policy"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	bucketName := strings.TrimSpace(body.BucketName)
	if bucketName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Bucket name is required")
		return
	}

	if !bucketNameRegex.MatchString(bucketName) || len(bucketName) < 3 || len(bucketName) > 63 {
		httputil.WriteError(w, http.StatusBadRequest, "Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens")
		return
	}

	policy := body.AccessPolicy
	if policy == "" {
		policy = body.AccessPolicySnake
	}
	if policy == "" {
		policy = "public"
	}
	if policy != "private" && policy != "public" {
		httputil.WriteError(w, http.StatusBadRequest, `Access policy must be either "private" or "public"`)
		return
	}

	var desc *string
	if body.Description != nil {
		trimmed := strings.TrimSpace(*body.Description)
		if trimmed != "" {
			desc = &trimmed
		}
	}

	bucket, err := h.service.CreateBucket(r.Context(), projectID, bucketName, desc, policy)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			httputil.WriteError(w, http.StatusConflict, "Bucket name already exists")
			return
		}
		slog.Error("failed to create bucket", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create bucket")
		return
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Bucket created successfully", bucket)
}

// GetBucket returns a single bucket with stats and policy info.
func (h *Handler) GetBucket(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	data, err := h.service.GetBucketWithStats(r.Context(), projectID, bucketID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Bucket retrieved successfully", data)
}

// UpdateBucket updates a bucket's metadata.
func (h *Handler) UpdateBucket(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	existing, err := h.service.GetBucket(r.Context(), projectID, bucketID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
		return
	}

	var body struct {
		BucketName   *string `json:"bucketName"`
		Description  *string `json:"description"`
		AccessPolicy *string `json:"accessPolicy"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.BucketName == nil && body.Description == nil && body.AccessPolicy == nil {
		httputil.WriteError(w, http.StatusBadRequest, "No fields to update")
		return
	}

	if body.BucketName != nil {
		name := strings.TrimSpace(*body.BucketName)
		if name == "" {
			httputil.WriteError(w, http.StatusBadRequest, "Bucket name cannot be empty")
			return
		}
		if !bucketNameRegex.MatchString(name) || len(name) < 3 || len(name) > 63 {
			httputil.WriteError(w, http.StatusBadRequest, "Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens")
			return
		}
		// Check uniqueness
		exists, err := h.service.BucketNameExists(r.Context(), name)
		if err == nil && exists && name != existing.BucketName {
			httputil.WriteError(w, http.StatusConflict, "Bucket name already exists")
			return
		}
		body.BucketName = &name
	}

	if body.AccessPolicy != nil {
		if *body.AccessPolicy != "private" && *body.AccessPolicy != "public" {
			httputil.WriteError(w, http.StatusBadRequest, `Access policy must be either "private" or "public"`)
			return
		}
	}

	var desc *string
	if body.Description != nil {
		trimmed := strings.TrimSpace(*body.Description)
		if trimmed == "" {
			empty := ""
			desc = &empty
		} else {
			desc = &trimmed
		}
	}

	updated, err := h.service.UpdateBucket(r.Context(), projectID, bucketID, body.BucketName, desc, body.AccessPolicy, existing.BucketName)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") || strings.Contains(err.Error(), "23505") {
			httputil.WriteError(w, http.StatusConflict, "Bucket name already exists")
			return
		}
		slog.Error("failed to update bucket", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update bucket")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Bucket updated successfully", updated)
}

// DeleteBucket deletes a bucket.
func (h *Handler) DeleteBucket(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	existing, err := h.service.GetBucket(r.Context(), projectID, bucketID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
		return
	}

	force := r.URL.Query().Get("force") == "true"

	if err := h.service.DeleteBucket(r.Context(), projectID, bucketID, existing.BucketName, force); err != nil {
		if strings.Contains(err.Error(), "not empty") {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		slog.Error("failed to delete bucket", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete bucket")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Bucket deleted successfully", map[string]any{
		"bucketId":   bucketID,
		"bucketName": existing.BucketName,
	})
}

// GetBucketPolicy returns stored and actual bucket policy.
func (h *Handler) GetBucketPolicy(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	data, err := h.service.GetBucketPolicyInfo(r.Context(), projectID, bucketID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Bucket policy retrieved successfully", data)
}

// SetBucketPolicy updates the access policy for a bucket.
func (h *Handler) SetBucketPolicy(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	var body struct {
		AccessPolicy string `json:"accessPolicy"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.AccessPolicy != "private" && body.AccessPolicy != "public" {
		httputil.WriteError(w, http.StatusBadRequest, `Access policy must be either "private" or "public"`)
		return
	}

	bucket, err := h.service.SetBucketPolicy(r.Context(), projectID, bucketID, body.AccessPolicy)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		slog.Error("failed to set bucket policy", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to set bucket policy")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Bucket policy updated successfully", map[string]any{
		"id":            bucket.ID,
		"project_id":    bucket.ProjectID,
		"bucket_name":   bucket.BucketName,
		"description":   bucket.Description,
		"access_policy": bucket.AccessPolicy,
		"created_at":    bucket.CreatedAt,
		"updated_at":    bucket.UpdatedAt,
		"actualPolicy":  body.AccessPolicy,
	})
}

// GetBucketStats returns detailed stats for a bucket.
func (h *Handler) GetBucketStats(w http.ResponseWriter, r *http.Request) {
	u := auth.RequireUser(w, r)
	if u == nil {
		return
	}

	projectID, ok := h.requireBucketProjectAccess(w, r, u.UserID)
	if !ok {
		return
	}

	bucketID, ok := httputil.PathInt(r, "bucketId")
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid bucket ID")
		return
	}

	existing, err := h.service.GetBucket(r.Context(), projectID, bucketID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
		return
	}

	stats := h.service.GetBucketDetailedStats(r.Context(), existing.BucketName)

	httputil.WriteSuccess(w, http.StatusOK, "Bucket statistics retrieved successfully", map[string]any{
		"bucketId":    bucketID,
		"bucketName":  existing.BucketName,
		"fileCount":   stats.FileCount,
		"totalSize":   stats.TotalSize,
		"largestFile": stats.LargestFile,
		"oldestFile":  stats.OldestFile,
		"newestFile":  stats.NewestFile,
	})
}
