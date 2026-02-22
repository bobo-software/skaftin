package migrations

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

type Handler struct {
	pool *pgxpool.Pool
	dir  string
}

func NewHandler(pool *pgxpool.Pool, migrationsDir string) *Handler {
	return &Handler{pool: pool, dir: migrationsDir}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/migrations/", h.ListMigrations)
	mux.HandleFunc("POST /api/migrations/run-all", h.RunAll)
	mux.HandleFunc("POST /api/migrations/run-batch", h.RunBatch)
	mux.HandleFunc("POST /api/migrations/{filename}/run", h.RunMigration)
	mux.HandleFunc("GET /api/migrations/{filename}", h.GetMigration)
}

type migrationFile struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

type migrationResult struct {
	File     string `json:"file"`
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
	Duration int64  `json:"duration"`
}

// ListMigrations handles GET /api/migrations/
func (h *Handler) ListMigrations(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/migrations/" && r.URL.Path != "/api/migrations" {
		h.GetMigration(w, r)
		return
	}

	entries, err := os.ReadDir(h.dir)
	if err != nil {
		if os.IsNotExist(err) {
			httputil.WriteSuccess(w, http.StatusOK, "Migrations directory not found", map[string]any{
				"migrations": []any{},
			})
			return
		}
		slog.Error("failed to read migrations dir", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list migrations")
		return
	}

	var list []migrationFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, migrationFile{
			Name:     e.Name(),
			Path:     filepath.Join(h.dir, e.Name()),
			Size:     info.Size(),
			Modified: info.ModTime(),
		})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })

	httputil.WriteSuccess(w, http.StatusOK, "Migrations listed", map[string]any{
		"migrations": list,
		"total":      len(list),
		"directory":  h.dir,
	})
}

// GetMigration handles GET /api/migrations/{filename}
func (h *Handler) GetMigration(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	if filename == "" {
		filename = strings.TrimPrefix(r.URL.Path, "/api/migrations/")
	}
	if !validateFilename(filename) {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid migration filename")
		return
	}

	filePath := filepath.Join(h.dir, filename)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			httputil.WriteError(w, http.StatusNotFound, "Migration file not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read migration file")
		return
	}

	info, _ := os.Stat(filePath)
	var size int64
	var modified time.Time
	if info != nil {
		size = info.Size()
		modified = info.ModTime()
	}

	httputil.WriteSuccess(w, http.StatusOK, "Migration content retrieved", map[string]any{
		"name":     filename,
		"content":  string(data),
		"size":     size,
		"modified": modified,
	})
}

// RunMigration handles POST /api/migrations/{filename}/run
func (h *Handler) RunMigration(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	if !validateFilename(filename) {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid migration filename")
		return
	}

	var body struct {
		DryRun bool `json:"dryRun"`
	}
	_ = httputil.ReadJSON(r, &body)

	filePath := filepath.Join(h.dir, filename)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			httputil.WriteError(w, http.StatusNotFound, "Migration file not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read migration file")
		return
	}
	sql := string(data)

	if body.DryRun {
		preview := sql
		if len(preview) > 1000 {
			preview = preview[:1000] + "..."
		}
		httputil.WriteSuccess(w, http.StatusOK, "Dry run - migration not executed", map[string]any{
			"file":        filename,
			"sql_preview": preview,
			"size":        len(sql),
			"dryRun":      true,
		})
		return
	}

	start := time.Now()
	slog.Info("running migration", "file", filename)

	_, err = h.pool.Exec(r.Context(), sql)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		slog.Error("migration failed", "file", filename, "error", err, "duration_ms", duration)
		httputil.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("Migration failed: %s", err.Error()))
		return
	}

	slog.Info("migration completed", "file", filename, "duration_ms", duration)
	httputil.WriteSuccess(w, http.StatusOK, "Migration executed successfully", map[string]any{
		"file":     filename,
		"success":  true,
		"duration": duration,
	})
}

// RunBatch handles POST /api/migrations/run-batch
func (h *Handler) RunBatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Migrations  []string `json:"migrations"`
		StopOnError bool     `json:"stopOnError"`
		DryRun      bool     `json:"dryRun"`
	}
	body.StopOnError = true

	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body.Migrations) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "migrations array is required")
		return
	}

	results := h.executeBatch(r, body.Migrations, body.StopOnError, body.DryRun)
	h.writeBatchResponse(w, results, body.DryRun)
}

// RunAll handles POST /api/migrations/run-all
func (h *Handler) RunAll(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StopOnError bool `json:"stopOnError"`
		DryRun      bool `json:"dryRun"`
	}
	body.StopOnError = true
	_ = httputil.ReadJSON(r, &body)

	entries, err := os.ReadDir(h.dir)
	if err != nil {
		if os.IsNotExist(err) {
			httputil.WriteError(w, http.StatusNotFound, "Migrations directory not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to read migrations directory")
		return
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	results := h.executeBatch(r, files, body.StopOnError, body.DryRun)
	h.writeBatchResponse(w, results, body.DryRun)
}

func (h *Handler) executeBatch(r *http.Request, filenames []string, stopOnError, dryRun bool) []migrationResult {
	var results []migrationResult

	for _, filename := range filenames {
		if !validateFilename(filename) {
			results = append(results, migrationResult{File: filename, Success: false, Error: "Invalid filename", Duration: 0})
			if stopOnError {
				break
			}
			continue
		}

		filePath := filepath.Join(h.dir, filename)
		data, err := os.ReadFile(filePath)
		if err != nil {
			results = append(results, migrationResult{File: filename, Success: false, Error: "File not found", Duration: 0})
			if stopOnError {
				break
			}
			continue
		}

		if dryRun {
			results = append(results, migrationResult{File: filename, Success: true, Duration: 0})
			continue
		}

		start := time.Now()
		slog.Info("running migration", "file", filename)
		_, err = h.pool.Exec(r.Context(), string(data))
		duration := time.Since(start).Milliseconds()

		if err != nil {
			slog.Error("migration failed", "file", filename, "error", err, "duration_ms", duration)
			results = append(results, migrationResult{File: filename, Success: false, Error: err.Error(), Duration: duration})
			if stopOnError {
				break
			}
			continue
		}

		slog.Info("migration completed", "file", filename, "duration_ms", duration)
		results = append(results, migrationResult{File: filename, Success: true, Duration: duration})
	}

	return results
}

func (h *Handler) writeBatchResponse(w http.ResponseWriter, results []migrationResult, dryRun bool) {
	successful := 0
	failed := 0
	var totalDuration int64
	for _, r := range results {
		if r.Success {
			successful++
		} else {
			failed++
		}
		totalDuration += r.Duration
	}

	httputil.WriteSuccess(w, http.StatusOK, "Batch migration completed", map[string]any{
		"results": results,
		"summary": map[string]any{
			"total":      len(results),
			"successful": successful,
			"failed":     failed,
			"duration":   totalDuration,
		},
		"dryRun": dryRun,
	})
}

func validateFilename(filename string) bool {
	if filename == "" {
		return false
	}
	if filepath.Base(filename) != filename {
		return false
	}
	if !strings.HasSuffix(filename, ".sql") {
		return false
	}
	return true
}
