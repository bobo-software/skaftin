package storage

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

const maxUploadSize = 100 << 20 // 100 MB

// Handler serves storage endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new storage Handler.
func NewHandler(pool *pgxpool.Pool, cfg *config.Config) (*Handler, error) {
	svc, err := NewService(pool, cfg.MinIO)
	if err != nil {
		return nil, err
	}
	return &Handler{service: svc}, nil
}

// S3 returns the underlying S3 client for reuse by other packages.
func (h *Handler) S3() *S3Client {
	return h.service.s3
}

// RegisterRoutes registers all storage routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Non-project routes (bucket/path in body or query).
	// Registered first so literal "files" beats the {projectId} wildcard.
	mux.HandleFunc("GET /api/storage/files/download", h.DownloadFileFromQuery)
	mux.HandleFunc("POST /api/storage/files", h.UploadFileFromForm)
	mux.HandleFunc("DELETE /api/storage/files", h.DeleteFileFromBody)

	// Project-scoped simple routes
	mux.HandleFunc("GET /api/storage/{projectId}/buckets", h.ListBuckets)
	mux.HandleFunc("GET /api/storage/{projectId}/{bucketName}/files", h.ListFiles)
	mux.HandleFunc("POST /api/storage/{projectId}/{bucketName}/search", h.SearchFiles)
	mux.HandleFunc("POST /api/storage/{projectId}/{bucketName}/upload", h.UploadFile)
	mux.HandleFunc("POST /api/storage/{projectId}/{bucketName}/upload-multipart", h.UploadFileMultipart)
	mux.HandleFunc("PUT /api/storage/{projectId}/{bucketName}/folders/rename", h.RenameFolder)

	// Wildcard routes for file download, delete, metadata, and folder delete
	mux.HandleFunc("GET /api/storage/{projectId}/{bucketName}/download/{filePath...}", h.DownloadFile)
	mux.HandleFunc("GET /api/storage/{projectId}/{bucketName}/files/{rest...}", h.FilePathDispatch)
	mux.HandleFunc("DELETE /api/storage/{projectId}/{bucketName}/files/{filePath...}", h.DeleteFile)
	mux.HandleFunc("DELETE /api/storage/{projectId}/{bucketName}/folders/{folderPath...}", h.DeleteFolder)
}

// RegisterAppAPIRoutes registers client-facing storage routes that rely on
// API key middleware for project resolution.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	// Non-project routes (bucket/path in body or query).
	mux.HandleFunc("GET /app-api/storage/files/download", h.DownloadFileFromQuery)
	mux.HandleFunc("POST /app-api/storage/files", h.UploadFileFromForm)
	mux.HandleFunc("DELETE /app-api/storage/files", h.DeleteFileFromBody)

	// Project-scoped routes (project resolved from auth context).
	mux.HandleFunc("GET /app-api/storage/buckets", h.ListBuckets)
	mux.HandleFunc("GET /app-api/storage/{bucketName}/files", h.ListFiles)
	mux.HandleFunc("POST /app-api/storage/{bucketName}/search", h.SearchFiles)
	mux.HandleFunc("POST /app-api/storage/{bucketName}/upload", h.UploadFile)
	mux.HandleFunc("POST /app-api/storage/{bucketName}/upload-multipart", h.UploadFileMultipart)
	mux.HandleFunc("PUT /app-api/storage/{bucketName}/folders/rename", h.RenameFolder)

	// Wildcard routes for file download, delete, metadata, and folder delete
	mux.HandleFunc("GET /app-api/storage/{bucketName}/download/{filePath...}", h.DownloadFile)
	mux.HandleFunc("GET /app-api/storage/{bucketName}/files/{rest...}", h.FilePathDispatch)
	mux.HandleFunc("DELETE /app-api/storage/{bucketName}/files/{filePath...}", h.DeleteFile)
	mux.HandleFunc("DELETE /app-api/storage/{bucketName}/folders/{folderPath...}", h.DeleteFolder)
}

// RegisterAppAPI2Routes registers read-only open-browse storage routes at /app-api2.
func (h *Handler) RegisterAppAPI2Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /app-api2/storage/files/download", h.DownloadFileFromQueryOpenBrowse)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// validateBucket is a handler-level helper that validates bucket ownership and
// writes an error response if invalid.
func (h *Handler) validateBucket(w http.ResponseWriter, r *http.Request, pid int, bucketName string) bool {
	msg, err := h.service.ValidateBucket(r.Context(), pid, bucketName)
	if err != nil {
		slog.Error("bucket validation failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Internal server error")
		return false
	}
	if msg != "" {
		status := http.StatusBadRequest
		if strings.Contains(msg, "not found") {
			status = http.StatusNotFound
		}
		httputil.WriteError(w, status, msg)
		return false
	}
	return true
}

func isNoSuchBucket(err error) bool {
	return err != nil && strings.Contains(err.Error(), "NoSuchBucket")
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "not found") || strings.Contains(s, "NoSuchKey") || strings.Contains(s, "NotFound") || strings.Contains(s, "The specified key does not exist")
}

// requireAuth allows both JWT user context and API key auth context.
func requireAuth(w http.ResponseWriter, r *http.Request) bool {
	if auth.GetUserContext(r) != nil || auth.GetAuthContext(r) != nil {
		return true
	}
	httputil.WriteError(w, http.StatusUnauthorized, "Unauthorized")
	return false
}

// projectID resolves project ID from API-key auth context first, then falls
// back to path-based projectId for existing /api/storage/{projectId}/... routes.
func projectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	if authCtx := auth.GetAuthContext(r); authCtx != nil && authCtx.ProjectID > 0 {
		return authCtx.ProjectID, true
	}
	return httputil.ProjectID(w, r)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// ListBuckets handles GET /api/storage/{projectId}/buckets
func (h *Handler) ListBuckets(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}

	includeStats := r.URL.Query().Get("includeStats") == "true"

	buckets, err := h.service.ListBuckets(r.Context(), pid, includeStats)
	if err != nil {
		slog.Error("failed to list buckets", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list buckets")
		return
	}
	if buckets == nil {
		buckets = []BucketInfo{}
	}

	msg := "Buckets listed successfully"
	if len(buckets) == 0 {
		msg = "No buckets found for this project"
	}
	httputil.WriteSuccess(w, http.StatusOK, msg, buckets)
}

// ListFiles handles GET /api/storage/{projectId}/{bucketName}/files
func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	prefix := r.URL.Query().Get("prefix")
	maxKeys, _ := strconv.Atoi(r.URL.Query().Get("maxKeys"))
	if maxKeys <= 0 {
		maxKeys = 1000
	}

	result, err := h.service.ListFiles(r.Context(), bucketName, prefix, maxKeys)
	if err != nil {
		slog.Error("failed to list files", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list files")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Files listed successfully", result)
}

// SearchFiles handles POST /api/storage/{projectId}/{bucketName}/search
func (h *Handler) SearchFiles(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	var params SearchParams
	if err := httputil.DecodeBody(r, &params); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if params.Query == "" {
		httputil.WriteError(w, http.StatusBadRequest, "query is required")
		return
	}

	result, err := h.service.SearchFiles(r.Context(), bucketName, params)
	if err != nil {
		slog.Error("failed to search files", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to search files")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Search completed successfully", result)
}

// UploadFile handles POST /api/storage/{projectId}/{bucketName}/upload (base64 body)
func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	var body struct {
		FilePath    string            `json:"filePath"`
		FileContent string            `json:"fileContent"`
		ContentType string            `json:"contentType"`
		Metadata    map[string]string `json:"metadata"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.FilePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "filePath and fileContent are required")
		return
	}

	var buf []byte
	if body.FileContent != "" {
		var err error
		buf, err = base64.StdEncoding.DecodeString(body.FileContent)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "Invalid base64 file content")
			return
		}
	}

	reader := bytes.NewReader(buf)
	if err := h.service.Upload(r.Context(), bucketName, body.FilePath, reader, int64(len(buf)), body.ContentType, body.Metadata); err != nil {
		slog.Error("failed to upload file", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to upload file")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "File uploaded successfully", map[string]any{
		"filePath":    body.FilePath,
		"size":        len(buf),
		"contentType": body.ContentType,
		"bucket":      bucketName,
	})
}

// UploadFileMultipart handles POST /api/storage/{projectId}/{bucketName}/upload-multipart
func (h *Handler) UploadFileMultipart(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	fileName := fmt.Sprintf("%d-%s", timeNowUnixMilli(), header.Filename)
	contentType := header.Header.Get("Content-Type")

	if err := h.service.Upload(r.Context(), bucketName, fileName, file, header.Size, contentType, nil); err != nil {
		slog.Error("failed to upload multipart file", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to upload file")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "File uploaded successfully", map[string]any{
		"fileName":     fileName,
		"originalName": header.Filename,
		"size":         header.Size,
		"contentType":  contentType,
		"bucket":       bucketName,
	})
}

// UploadFileFromForm handles POST /api/storage/files (multipart with bucket/path in form)
func (h *Handler) UploadFileFromForm(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}

	bucketName := r.FormValue("bucket")
	filePath := r.FormValue("path")

	if bucketName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Bucket name is required in form data. Send the request as multipart/form-data and do not set Content-Type manually (let the client set multipart/form-data with boundary).")
		return
	}
	if filePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required in form data")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if err := h.service.Upload(r.Context(), bucketName, filePath, file, header.Size, contentType, nil); err != nil {
		slog.Error("failed to upload file from form", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to upload file")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "File uploaded successfully", map[string]any{
		"filePath":     filePath,
		"originalName": header.Filename,
		"size":         header.Size,
		"contentType":  contentType,
		"bucket":       bucketName,
	})
}

// DownloadFileFromQuery handles GET /api/storage/files/download?bucket=...&path=...
func (h *Handler) DownloadFileFromQuery(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	h.serveDownloadFromQuery(w, r, false)
}

// DownloadFileFromQueryOpenBrowse handles GET /app-api2/storage/files/download.
func (h *Handler) DownloadFileFromQueryOpenBrowse(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	h.serveDownloadFromQuery(w, r, true)
}

func (h *Handler) serveDownloadFromQuery(w http.ResponseWriter, r *http.Request, openBrowse bool) {
	bucketName := r.URL.Query().Get("bucket")
	filePath := r.URL.Query().Get("path")

	if bucketName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Bucket name is required in query parameters")
		return
	}
	if filePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required in query parameters")
		return
	}

	if openBrowse {
		pid, ok := projectID(w, r)
		if !ok {
			return
		}
		msg, err := h.service.ValidatePublicBucket(r.Context(), pid, bucketName)
		if err != nil {
			slog.Error("bucket validation failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Internal server error")
			return
		}
		if msg != "" {
			status := http.StatusBadRequest
			if strings.Contains(msg, "not available") {
				status = http.StatusForbidden
			} else if strings.Contains(msg, "not found") {
				status = http.StatusNotFound
			}
			httputil.WriteError(w, status, msg)
			return
		}
	}

	decodedPath, _ := url.QueryUnescape(filePath)
	if decodedPath == "" {
		decodedPath = filePath
	}

	signedURL, err := h.service.DownloadURL(r.Context(), bucketName, decodedPath)
	if err != nil {
		slog.Error("failed to generate download URL", "error", err)
		if isNotFound(err) {
			httputil.WriteError(w, http.StatusNotFound, "File not found")
			return
		}
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to download file")
		return
	}

	if r.URL.Query().Get("returnUrl") == "true" {
		httputil.WriteSuccess(w, http.StatusOK, "Download URL generated", map[string]any{
			"url": signedURL.String(),
		})
		return
	}
	http.Redirect(w, r, signedURL.String(), http.StatusFound)
}

// DownloadFile handles GET /api/storage/{projectId}/{bucketName}/download/{filePath...}
func (h *Handler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	filePath := r.PathValue("filePath")
	if filePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required")
		return
	}

	signedURL, err := h.service.DownloadURL(r.Context(), bucketName, filePath)
	if err != nil {
		slog.Error("failed to download file", "error", err)
		if isNotFound(err) {
			httputil.WriteError(w, http.StatusNotFound, "File not found")
			return
		}
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to download file")
		return
	}

	if r.URL.Query().Get("returnUrl") == "true" {
		httputil.WriteSuccess(w, http.StatusOK, "Download URL generated", map[string]any{
			"url": signedURL.String(),
		})
		return
	}
	http.Redirect(w, r, signedURL.String(), http.StatusFound)
}

// DeleteFileFromBody handles DELETE /api/storage/files (bucket/path in JSON body)
func (h *Handler) DeleteFileFromBody(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}

	var body struct {
		Bucket string `json:"bucket"`
		Path   string `json:"path"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Bucket == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Bucket name is required in request body")
		return
	}
	if body.Path == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required in request body")
		return
	}

	if err := h.service.DeleteFile(r.Context(), body.Bucket, body.Path); err != nil {
		slog.Error("failed to delete file", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete file")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "File deleted successfully", map[string]any{
		"filePath": body.Path,
		"bucket":   body.Bucket,
	})
}

// DeleteFile handles DELETE /api/storage/{projectId}/{bucketName}/files/{filePath...}
func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	filePath := r.PathValue("filePath")
	if filePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required")
		return
	}

	if err := h.service.DeleteFile(r.Context(), bucketName, filePath); err != nil {
		slog.Error("failed to delete file", "error", err)
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete file")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "File deleted successfully", map[string]any{
		"filePath": filePath,
		"bucket":   bucketName,
	})
}

// FilePathDispatch handles GET /api/storage/{projectId}/{bucketName}/files/{rest...}
// It dispatches to getFileMetadata when the path ends with /metadata.
func (h *Handler) FilePathDispatch(w http.ResponseWriter, r *http.Request) {
	rest := r.PathValue("rest")
	if strings.HasSuffix(rest, "/metadata") {
		h.getFileMetadata(w, r, strings.TrimSuffix(rest, "/metadata"))
		return
	}
	// For paths like /files/something that's not /metadata, check for a bare
	// "metadata" path (single segment without leading slash).
	if rest == "metadata" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required before /metadata")
		return
	}
	httputil.WriteError(w, http.StatusNotFound, "Not found")
}

// getFileMetadata is the inner handler for file metadata retrieval.
func (h *Handler) getFileMetadata(w http.ResponseWriter, r *http.Request, filePath string) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}
	if filePath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File path is required")
		return
	}

	meta, err := h.service.GetFileMetadata(r.Context(), bucketName, filePath)
	if err != nil {
		slog.Error("failed to get file metadata", "error", err)
		if isNotFound(err) {
			httputil.WriteError(w, http.StatusNotFound, "File not found")
			return
		}
		if isNoSuchBucket(err) {
			httputil.WriteError(w, http.StatusNotFound, "Bucket not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get file metadata")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "File metadata retrieved", meta)
}

// RenameFolder handles PUT /api/storage/{projectId}/{bucketName}/folders/rename
func (h *Handler) RenameFolder(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	var body struct {
		OldPath string `json:"oldPath"`
		NewPath string `json:"newPath"`
	}
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.OldPath == "" || body.NewPath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "oldPath and newPath are required")
		return
	}

	result, err := h.service.RenameFolder(r.Context(), bucketName, body.OldPath, body.NewPath)
	if err != nil {
		slog.Error("failed to rename folder", "error", err)
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "empty") {
			httputil.WriteError(w, http.StatusNotFound, "Folder not found or is empty")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to rename folder")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Folder renamed successfully", result)
}

// DeleteFolder handles DELETE /api/storage/{projectId}/{bucketName}/folders/{folderPath...}
func (h *Handler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	if !requireAuth(w, r) {
		return
	}
	pid, ok := projectID(w, r)
	if !ok {
		return
	}
	bucketName := r.PathValue("bucketName")
	if !h.validateBucket(w, r, pid, bucketName) {
		return
	}

	folderPath := r.PathValue("folderPath")
	if folderPath == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Folder path is required")
		return
	}

	result, err := h.service.DeleteFolder(r.Context(), bucketName, folderPath)
	if err != nil {
		slog.Error("failed to delete folder", "error", err)
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "empty") {
			httputil.WriteError(w, http.StatusNotFound, "Folder not found or is empty")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete folder")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Folder deleted successfully", result)
}

// timeNowUnixMilli returns the current time in Unix milliseconds.
// Extracted as a function for testability.
func timeNowUnixMilli() int64 {
	return time.Now().UnixMilli()
}
