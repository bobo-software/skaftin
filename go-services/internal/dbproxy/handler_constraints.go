package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 4: Constraints ---

func (h *Handler) ListConstraints(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	rows, err := pc.Query(r.Context(), `
		SELECT
			tc.constraint_name,
			tc.constraint_type,
			kcu.column_name,
			ccu.table_name AS referenced_table_name,
			ccu.column_name AS referenced_column_name,
			rc.update_rule,
			rc.delete_rule,
			cc.check_clause
		FROM information_schema.table_constraints AS tc
		LEFT JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		LEFT JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		LEFT JOIN information_schema.referential_constraints AS rc
			ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		LEFT JOIN information_schema.check_constraints AS cc
			ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1
		ORDER BY tc.constraint_type, tc.constraint_name
	`, tableName)
	if err != nil {
		slog.Error("list constraints failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list constraints")
		return
	}
	defer rows.Close()

	result, err := collectRows(rows)
	if err != nil {
		slog.Error("list constraints failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list constraints")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Constraints fetched successfully", result)
}

func (h *Handler) ListForeignKeys(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	rows, err := pc.Query(r.Context(), `
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ccu.table_name AS referenced_table_name,
			ccu.column_name AS referenced_column_name,
			rc.update_rule,
			rc.delete_rule
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		JOIN information_schema.referential_constraints AS rc
			ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
		ORDER BY tc.constraint_name
	`, tableName)
	if err != nil {
		slog.Error("list foreign keys failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list foreign keys")
		return
	}
	defer rows.Close()

	result, err := collectRows(rows)
	if err != nil {
		slog.Error("list foreign keys failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list foreign keys")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Foreign keys fetched successfully", result)
}

func (h *Handler) CreateForeignKey(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		ColumnName       string `json:"columnName"`
		ReferencedTable  string `json:"referencedTable"`
		ReferencedColumn string `json:"referencedColumn"`
		OnDelete         string `json:"onDelete"`
		OnUpdate         string `json:"onUpdate"`
	}
	body.OnDelete = "RESTRICT"
	body.OnUpdate = "RESTRICT"
	json.NewDecoder(r.Body).Decode(&body)

	if body.ColumnName == "" || body.ReferencedTable == "" || body.ReferencedColumn == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Column name, referenced table, and referenced column are required")
		return
	}

	validActions := map[string]bool{"RESTRICT": true, "CASCADE": true, "SET NULL": true, "SET DEFAULT": true, "NO ACTION": true}
	if !validActions[body.OnDelete] || !validActions[body.OnUpdate] {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid referential action")
		return
	}

	constraintName := strings.ToLower(fmt.Sprintf("fk_%s_%s_%s_%s", tableName, body.ColumnName, body.ReferencedTable, body.ReferencedColumn))
	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY ("%s") REFERENCES "%s" ("%s") ON DELETE %s ON UPDATE %s`,
		tableName, constraintName, body.ColumnName, body.ReferencedTable, body.ReferencedColumn, body.OnDelete, body.OnUpdate)

	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("create foreign key failed", "error", err)
		httputil.WriteError(w, http.StatusConflict, fmt.Sprintf("Failed to create foreign key: %s", err.Error()))
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Foreign key created successfully", map[string]any{
		"constraintName":   constraintName,
		"tableName":        tableName,
		"columnName":       body.ColumnName,
		"referencedTable":  body.ReferencedTable,
		"referencedColumn": body.ReferencedColumn,
		"onDelete":         body.OnDelete,
		"onUpdate":         body.OnUpdate,
	})
	h.emitDatabaseEvent(pid, "create_constraint", tableName, map[string]any{
		"constraintType":   "FOREIGN KEY",
		"constraintName":   constraintName,
		"columnName":       body.ColumnName,
		"referencedTable":  body.ReferencedTable,
		"referencedColumn": body.ReferencedColumn,
		"onDelete":         body.OnDelete,
		"onUpdate":         body.OnUpdate,
	}, nil)
}

func (h *Handler) CreateUniqueConstraint(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		ColumnName     string `json:"columnName"`
		ConstraintName string `json:"constraintName"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.ColumnName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Column name is required")
		return
	}
	if body.ConstraintName == "" {
		body.ConstraintName = fmt.Sprintf("%s_%s_unique", tableName, body.ColumnName)
	}

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" UNIQUE ("%s")`, tableName, body.ConstraintName, body.ColumnName)
	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("create unique constraint failed", "error", err)
		if strings.Contains(err.Error(), "already exists") {
			httputil.WriteError(w, http.StatusConflict, "A constraint with this name already exists")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create unique constraint")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Unique constraint created successfully", map[string]any{
		"constraintName": body.ConstraintName,
		"tableName":      tableName,
		"columnName":     body.ColumnName,
	})
	h.emitDatabaseEvent(pid, "create_constraint", tableName, map[string]any{
		"constraintType": "UNIQUE",
		"constraintName": body.ConstraintName,
		"columnName":     body.ColumnName,
	}, nil)
}

func (h *Handler) CreatePrimaryKeyConstraint(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		ColumnNames    []string `json:"columnNames"`
		ConstraintName string   `json:"constraintName"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if len(body.ColumnNames) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Column names array is required")
		return
	}

	// Check existing PK
	var existingPK bool
	pc.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.table_constraints
			WHERE table_schema = current_schema() AND table_name = $1 AND constraint_type = 'PRIMARY KEY'
		)
	`, tableName).Scan(&existingPK)
	if existingPK {
		httputil.WriteError(w, http.StatusBadRequest, "Table already has a primary key. Drop the existing primary key before creating a new one.")
		return
	}

	if body.ConstraintName == "" {
		body.ConstraintName = tableName + "_pkey"
	}
	colList := make([]string, len(body.ColumnNames))
	for i, c := range body.ColumnNames {
		colList[i] = fmt.Sprintf(`"%s"`, c)
	}
	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" PRIMARY KEY (%s)`, tableName, body.ConstraintName, strings.Join(colList, ", "))

	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("create primary key failed", "error", err)
		errMsg := "Failed to create primary key constraint"
		if strings.Contains(err.Error(), "already exists") {
			errMsg = "A constraint with this name already exists"
		} else if strings.Contains(err.Error(), "contains null values") {
			errMsg = "Cannot create primary key on column(s) containing NULL values"
		}
		httputil.WriteError(w, http.StatusInternalServerError, errMsg)
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Primary key constraint created successfully", map[string]any{
		"constraintName": body.ConstraintName,
		"tableName":      tableName,
		"columnNames":    body.ColumnNames,
	})
	h.emitDatabaseEvent(pid, "create_constraint", tableName, map[string]any{
		"constraintType": "PRIMARY KEY",
		"constraintName": body.ConstraintName,
		"columnNames":    body.ColumnNames,
	}, nil)
}

func (h *Handler) CreateCheckConstraint(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		CheckExpression string `json:"checkExpression"`
		ConstraintName  string `json:"constraintName"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.CheckExpression == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Check expression is required")
		return
	}
	if body.ConstraintName == "" {
		body.ConstraintName = fmt.Sprintf("%s_check_%d", tableName, time.Now().UnixMilli())
	}

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" CHECK (%s)`, tableName, body.ConstraintName, body.CheckExpression)
	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("create check constraint failed", "error", err)
		if strings.Contains(err.Error(), "already exists") {
			httputil.WriteError(w, http.StatusConflict, "A constraint with this name already exists")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create check constraint")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, "Check constraint created successfully", map[string]any{
		"constraintName":  body.ConstraintName,
		"tableName":       tableName,
		"checkExpression": body.CheckExpression,
	})
	h.emitDatabaseEvent(pid, "create_constraint", tableName, map[string]any{
		"constraintType":  "CHECK",
		"constraintName":  body.ConstraintName,
		"checkExpression": body.CheckExpression,
	}, nil)
}

func (h *Handler) DropConstraint(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	constraintName := r.PathValue("constraintName")

	// Check if this is a NOT NULL constraint
	var checkClause, constraintType *string
	pc.QueryRow(r.Context(), `
		SELECT cc.check_clause, tc.constraint_type
		FROM information_schema.table_constraints AS tc
		LEFT JOIN information_schema.check_constraints AS cc
			ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1 AND tc.constraint_name = $2
	`, tableName, constraintName).Scan(&checkClause, &constraintType)

	if constraintType != nil && *constraintType == "CHECK" && checkClause != nil && strings.Contains(*checkClause, "IS NOT NULL") {
		httputil.WriteError(w, http.StatusBadRequest, "Cannot drop NOT NULL constraint directly. Please edit the column and change it to nullable instead.")
		return
	}

	if err := pc.Exec(r.Context(), fmt.Sprintf(`ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"`, tableName, constraintName)); err != nil {
		slog.Error("drop constraint failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to drop constraint")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Constraint %s dropped successfully", constraintName), nil)
	h.emitDatabaseEvent(pid, "drop_constraint", tableName, map[string]any{
		"constraintName": constraintName,
	}, nil)
}
