package dbproxy

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/realtime"
	"github.com/skaftin/go-services/internal/supertokens"
)

// Handler serves project database operation endpoints.
type Handler struct {
	service *Service
	st      *supertokens.Client
	rt      *realtime.Hub
}

// NewHandler creates a new dbproxy Handler.
func NewHandler(pool *pgxpool.Pool, st *supertokens.Client, rt *realtime.Hub) *Handler {
	return &Handler{service: NewService(pool), st: st, rt: rt}
}

// RegisterRoutes registers all database routes on the given mux.
// Paths are relative to /api/database/ which is the prefix set in routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	h.registerRoutesWithBase(mux, "/api/database/{projectId}")
}

// RegisterAppAPIRoutes registers client-facing database routes that rely on
// API key middleware for project resolution.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	h.registerRoutesWithBase(mux, "/app-api/database")
}

// RegisterAppAPI2Routes registers public client-facing database routes
// (GET/POST only), matching Node's /app-api-2 behavior.
func (h *Handler) RegisterAppAPI2Routes(mux *http.ServeMux) {
	base := "/app-api-2/database"

	// Tables
	mux.HandleFunc("GET "+base+"/tables", h.ListTables)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/schema", h.GetTableSchema)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/select", h.SelectDataGet)
	mux.HandleFunc("POST "+base+"/tables/create", h.CreateTable)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/rename", h.RenameTable)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/select", h.SelectData)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/insert", h.InsertData)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/bulk-insert", h.BulkInsertData)

	// Columns
	mux.HandleFunc("POST "+base+"/tables/{tableName}/columns", h.AddColumn)

	// Constraints
	mux.HandleFunc("GET "+base+"/tables/{tableName}/constraints", h.ListConstraints)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/foreign-keys", h.ListForeignKeys)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/foreign-key", h.CreateForeignKey)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/unique", h.CreateUniqueConstraint)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/primary-key", h.CreatePrimaryKeyConstraint)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/check", h.CreateCheckConstraint)

	// Query
	mux.HandleFunc("POST "+base+"/query", h.ExecuteQuery)

	// Cron
	mux.HandleFunc("GET "+base+"/cron", h.ListCronJobs)
	mux.HandleFunc("GET "+base+"/cron/{jobId}/history", h.GetCronJobHistory)
	mux.HandleFunc("POST "+base+"/cron", h.CreateCronJob)

	// Import / Export
	mux.HandleFunc("POST "+base+"/import", h.ImportDatabaseDump)
	mux.HandleFunc("POST "+base+"/export", h.ExportDatabaseDump)

	// Users
	mux.HandleFunc("POST "+base+"/users/select", h.SelectUsers)
	mux.HandleFunc("POST "+base+"/users/insert", h.CreateUser)
	mux.HandleFunc("POST "+base+"/users/change_password", h.ChangePassword)
}

func (h *Handler) registerRoutesWithBase(mux *http.ServeMux, base string) {
	// Tables
	mux.HandleFunc("GET "+base+"/tables", h.ListTables)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/schema", h.GetTableSchema)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/select", h.SelectDataGet)
	mux.HandleFunc("POST "+base+"/tables/create", h.CreateTable)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/rename", h.RenameTable)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/select", h.SelectData)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/insert", h.InsertData)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/bulk-insert", h.BulkInsertData)
	mux.HandleFunc("PUT "+base+"/tables/{tableName}/update", h.UpdateData)
	mux.HandleFunc("DELETE "+base+"/tables/{tableName}/delete", h.DeleteData)
	mux.HandleFunc("DELETE "+base+"/tables/{tableName}", h.DropTable)

	// Columns
	mux.HandleFunc("POST "+base+"/tables/{tableName}/columns", h.AddColumn)
	mux.HandleFunc("PUT "+base+"/tables/{tableName}/columns/{columnName}", h.AlterColumn)
	mux.HandleFunc("DELETE "+base+"/tables/{tableName}/columns/{columnName}", h.DropColumn)

	// Constraints
	mux.HandleFunc("GET "+base+"/tables/{tableName}/constraints", h.ListConstraints)
	mux.HandleFunc("GET "+base+"/tables/{tableName}/foreign-keys", h.ListForeignKeys)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/foreign-key", h.CreateForeignKey)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/unique", h.CreateUniqueConstraint)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/primary-key", h.CreatePrimaryKeyConstraint)
	mux.HandleFunc("POST "+base+"/tables/{tableName}/constraints/check", h.CreateCheckConstraint)
	mux.HandleFunc("DELETE "+base+"/tables/{tableName}/constraints/{constraintName}", h.DropConstraint)

	// Query
	mux.HandleFunc("POST "+base+"/query", h.ExecuteQuery)

	// Cron
	mux.HandleFunc("GET "+base+"/cron", h.ListCronJobs)
	mux.HandleFunc("GET "+base+"/cron/{jobId}/history", h.GetCronJobHistory)
	mux.HandleFunc("POST "+base+"/cron", h.CreateCronJob)
	mux.HandleFunc("PUT "+base+"/cron/{jobId}", h.UpdateCronJob)
	mux.HandleFunc("PATCH "+base+"/cron/{jobId}/toggle", h.ToggleCronJob)
	mux.HandleFunc("DELETE "+base+"/cron/{jobId}", h.DeleteCronJob)

	// Import / Export
	mux.HandleFunc("POST "+base+"/import", h.ImportDatabaseDump)
	mux.HandleFunc("POST "+base+"/export", h.ExportDatabaseDump)

	// Users
	mux.HandleFunc("POST "+base+"/users/select", h.SelectUsers)
	mux.HandleFunc("POST "+base+"/users/insert", h.CreateUser)
	mux.HandleFunc("PUT "+base+"/users/update", h.UpdateUser)
	mux.HandleFunc("POST "+base+"/users/change_password", h.ChangePassword)
	mux.HandleFunc("DELETE "+base+"/users/delete", h.DeleteUser)
}

// projectID extracts and parses the projectId path parameter.
func projectID(r *http.Request) (int, bool) {
	if authCtx := auth.GetAuthContext(r); authCtx != nil && authCtx.ProjectID > 0 {
		return authCtx.ProjectID, true
	}
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
