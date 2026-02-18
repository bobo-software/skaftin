package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 2: Table DDL ---

func (h *Handler) CreateTable(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		TableName string `json:"tableName"`
		Columns   []struct {
			Name         string `json:"name"`
			Type         string `json:"type"`
			PrimaryKey   bool   `json:"primaryKey"`
			Nullable     bool   `json:"nullable"`
			DefaultValue *string `json:"defaultValue"`
		} `json:"columns"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.TableName == "" || len(body.Columns) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Table name and columns are required")
		return
	}

	var colDefs []string
	var pkCols []string

	pgFunctions := []string{"CURRENT_TIMESTAMP", "NOW()", "CURRENT_DATE", "CURRENT_TIME", "LOCALTIMESTAMP", "LOCALTIME"}

	for _, col := range body.Columns {
		def := fmt.Sprintf(`"%s" %s`, col.Name, col.Type)

		if col.PrimaryKey || (!col.Nullable && col.Type != "SERIAL" && col.Type != "BIGSERIAL") {
			def += " NOT NULL"
		}

		if col.DefaultValue != nil && *col.DefaultValue != "" && col.Type != "SERIAL" && col.Type != "BIGSERIAL" {
			dv := *col.DefaultValue
			isFunc := false
			for _, fn := range pgFunctions {
				if strings.Contains(strings.ToUpper(dv), fn) {
					isFunc = true
					break
				}
			}
			if strings.Contains(strings.ToUpper(col.Type), "INT") || strings.EqualFold(col.Type, "BOOLEAN") || isFunc {
				def += " DEFAULT " + dv
			} else {
				def += fmt.Sprintf(` DEFAULT '%s'`, strings.ReplaceAll(dv, "'", "''"))
			}
		}

		colDefs = append(colDefs, def)
		if col.PrimaryKey {
			pkCols = append(pkCols, fmt.Sprintf(`"%s"`, col.Name))
		}
	}

	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS \"%s\" (\n  %s", body.TableName, strings.Join(colDefs, ",\n  "))
	if len(pkCols) > 0 {
		sql += fmt.Sprintf(",\n  PRIMARY KEY (%s)", strings.Join(pkCols, ", "))
	}
	sql += "\n)"

	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("failed to create table", "error", err, "table", body.TableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create table")
		return
	}

	httputil.WriteSuccess(w, http.StatusCreated, fmt.Sprintf("Table %s created successfully", body.TableName), map[string]any{
		"tableName": body.TableName,
		"columns":   len(body.Columns),
	})
}

func (h *Handler) RenameTable(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		NewTableName string `json:"newTableName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.NewTableName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "New table name is required")
		return
	}

	if ok, _ := regexp.MatchString(`^[a-zA-Z_][a-zA-Z0-9_]*$`, body.NewTableName); !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Table name must start with a letter or underscore and contain only letters, numbers, and underscores")
		return
	}

	// Check if new name already exists
	var exists bool
	pc.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_name = $1
		)
	`, body.NewTableName).Scan(&exists)

	if exists {
		httputil.WriteError(w, http.StatusConflict, fmt.Sprintf("Table \"%s\" already exists", body.NewTableName))
		return
	}

	if err := pc.Exec(r.Context(), fmt.Sprintf(`ALTER TABLE "%s" RENAME TO "%s"`, tableName, body.NewTableName)); err != nil {
		slog.Error("failed to rename table", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to rename table")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Table renamed from \"%s\" to \"%s\" successfully", tableName, body.NewTableName), map[string]any{
		"oldName": tableName,
		"newName": body.NewTableName,
	})
}

func (h *Handler) DropTable(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	if err := pc.Exec(r.Context(), fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tableName)); err != nil {
		slog.Error("failed to drop table", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to drop table")
		return
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Table %s dropped successfully", tableName), nil)
}
