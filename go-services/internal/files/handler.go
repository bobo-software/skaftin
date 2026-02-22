package files

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/storage"
)

const maxUploadSize = 10 << 20 // 10 MB

// Handler serves the /api/files endpoints.
type Handler struct {
	s3     *storage.S3Client
	bucket string
}

// NewHandler creates a files Handler that operates on the given bucket.
func NewHandler(s3 *storage.S3Client, bucket string) *Handler {
	return &Handler{s3: s3, bucket: bucket}
}

// RegisterRoutes registers all /api/files routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/files/list", h.List)
	mux.HandleFunc("GET /api/files/{fileName...}", h.Download)
	mux.HandleFunc("POST /api/files/upload", h.Upload)
	mux.HandleFunc("DELETE /api/files/{fileName...}", h.Delete)
}

// List handles GET /api/files/list
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	objects, err := h.s3.ListObjects(r.Context(), h.bucket, "", 1000)
	if err != nil {
		slog.Error("failed to list files", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list files")
		return
	}
	if objects == nil {
		objects = []storage.ObjectInfo{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Files listed successfully", objects)
}

// Download handles GET /api/files/{fileName...}
func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	fileName := r.PathValue("fileName")
	if fileName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File name is required")
		return
	}

	if _, err := h.s3.StatObject(r.Context(), h.bucket, fileName); err != nil {
		if isNotFound(err) {
			httputil.WriteError(w, http.StatusNotFound, "File not found")
			return
		}
		slog.Error("failed to stat file", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to retrieve file info")
		return
	}

	signedURL, err := h.s3.PresignedGetObject(r.Context(), h.bucket, fileName, 1*time.Hour)
	if err != nil {
		slog.Error("failed to generate download URL", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to generate download URL")
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

// Upload handles POST /api/files/upload
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Failed to parse multipart form or file exceeds 10 MB limit")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "No file uploaded (field name must be 'file')")
		return
	}
	defer file.Close()

	key := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), header.Filename)
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if err := h.s3.PutObject(r.Context(), h.bucket, key, file, header.Size, contentType, nil); err != nil {
		slog.Error("failed to upload file", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to upload file")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "File uploaded successfully", map[string]any{
		"key":          key,
		"originalName": header.Filename,
		"size":         header.Size,
		"contentType":  contentType,
		"bucket":       h.bucket,
	})
}

// Delete handles DELETE /api/files/{fileName...}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	fileName := r.PathValue("fileName")
	if fileName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "File name is required")
		return
	}

	if err := h.s3.RemoveObject(r.Context(), h.bucket, fileName); err != nil {
		slog.Error("failed to delete file", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete file")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, "File deleted successfully", map[string]any{
		"fileName": fileName,
		"bucket":   h.bucket,
	})
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "not found") || strings.Contains(s, "NoSuchKey") || strings.Contains(s, "NotFound") || strings.Contains(s, "The specified key does not exist")
}
