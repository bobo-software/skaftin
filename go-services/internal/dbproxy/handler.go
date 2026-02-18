package dbproxy

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves project database operation endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new dbproxy Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterRoutes registers all database routes on the given mux.
// Paths are relative to /api/database/ which is the prefix set in routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Tables
	mux.HandleFunc("GET /api/database/{projectId}/tables", h.ListTables)
	mux.HandleFunc("GET /api/database/{projectId}/tables/{tableName}/schema", h.GetTableSchema)
	mux.HandleFunc("GET /api/database/{projectId}/tables/{tableName}/select", h.SelectDataGet)
	mux.HandleFunc("POST /api/database/{projectId}/tables/create", h.CreateTable)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/rename", h.RenameTable)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/select", h.SelectData)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/insert", h.InsertData)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/bulk-insert", h.BulkInsertData)
	mux.HandleFunc("PUT /api/database/{projectId}/tables/{tableName}/update", h.UpdateData)
	mux.HandleFunc("DELETE /api/database/{projectId}/tables/{tableName}/delete", h.DeleteData)
	mux.HandleFunc("DELETE /api/database/{projectId}/tables/{tableName}", h.DropTable)

	// Columns
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/columns", h.AddColumn)
	mux.HandleFunc("PUT /api/database/{projectId}/tables/{tableName}/columns/{columnName}", h.AlterColumn)
	mux.HandleFunc("DELETE /api/database/{projectId}/tables/{tableName}/columns/{columnName}", h.DropColumn)

	// Constraints
	mux.HandleFunc("GET /api/database/{projectId}/tables/{tableName}/constraints", h.ListConstraints)
	mux.HandleFunc("GET /api/database/{projectId}/tables/{tableName}/foreign-keys", h.ListForeignKeys)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/constraints/foreign-key", h.CreateForeignKey)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/constraints/unique", h.CreateUniqueConstraint)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/constraints/primary-key", h.CreatePrimaryKeyConstraint)
	mux.HandleFunc("POST /api/database/{projectId}/tables/{tableName}/constraints/check", h.CreateCheckConstraint)
	mux.HandleFunc("DELETE /api/database/{projectId}/tables/{tableName}/constraints/{constraintName}", h.DropConstraint)

	// Query
	mux.HandleFunc("POST /api/database/{projectId}/query", h.ExecuteQuery)

	// Cron
	mux.HandleFunc("GET /api/database/{projectId}/cron", h.ListCronJobs)
	mux.HandleFunc("GET /api/database/{projectId}/cron/{jobId}/history", h.GetCronJobHistory)
	mux.HandleFunc("POST /api/database/{projectId}/cron", h.CreateCronJob)
	mux.HandleFunc("PUT /api/database/{projectId}/cron/{jobId}", h.UpdateCronJob)
	mux.HandleFunc("PATCH /api/database/{projectId}/cron/{jobId}/toggle", h.ToggleCronJob)
	mux.HandleFunc("DELETE /api/database/{projectId}/cron/{jobId}", h.DeleteCronJob)

	// Import / Export
	mux.HandleFunc("POST /api/database/{projectId}/import", h.ImportDatabaseDump)
	mux.HandleFunc("POST /api/database/{projectId}/export", h.ExportDatabaseDump)

	// Users
	mux.HandleFunc("POST /api/database/{projectId}/users/select", h.SelectUsers)
	mux.HandleFunc("POST /api/database/{projectId}/users/insert", h.CreateUser)
	mux.HandleFunc("PUT /api/database/{projectId}/users/update", h.UpdateUser)
	mux.HandleFunc("POST /api/database/{projectId}/users/change_password", h.ChangePassword)
	mux.HandleFunc("DELETE /api/database/{projectId}/users/delete", h.DeleteUser)
}

// projectID extracts and parses the projectId path parameter.
func projectID(r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		return 0, false
	}
	return id, true
}

// acquireConn is a helper that acquires a project connection and writes
// an error response if it fails. Returns nil on failure.
func (h *Handler) acquireConn(w http.ResponseWriter, r *http.Request) (*ProjectConn, int) {
	pid, ok := projectID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
		return nil, 0
	}
	pc, err := h.service.AcquireConn(r.Context(), pid)
	if err != nil {
		slog.Error("failed to acquire project connection", "error", err, "projectId", pid)
		httputil.WriteError(w, http.StatusNotFound, "Project not found")
		return nil, 0
	}
	return pc, pid
}

// --- Phase 1: Tables ---

func (h *Handler) ListTables(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	includeSystem := r.URL.Query().Get("includeSystemTables") == "true"
	tables, err := h.service.ListTables(r.Context(), pc, includeSystem)
	if err != nil {
		slog.Error("failed to list tables", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch tables")
		return
	}
	if tables == nil {
		tables = []map[string]any{}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Tables fetched successfully", tables)
}

func (h *Handler) GetTableSchema(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	columns, err := h.service.GetTableSchema(r.Context(), pc, tableName)
	if err != nil {
		slog.Error("failed to get table schema", "error", err, "table", tableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch table schema")
		return
	}
	if columns == nil {
		httputil.WriteError(w, http.StatusNotFound, "Table not found")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Table schema fetched successfully", columns)
}
