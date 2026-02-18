package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 4: Columns ---

func (h *Handler) AddColumn(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		ColumnName   string  `json:"columnName"`
		ColumnType   string  `json:"columnType"`
		Nullable     bool    `json:"nullable"`
		DefaultValue *string `json:"defaultValue"`
	}
	body.Nullable = true
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.ColumnName == "" || body.ColumnType == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Column name and type are required")
		return
	}

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN "%s" %s`, tableName, body.ColumnName, body.ColumnType)
	if !body.Nullable {
		sql += " NOT NULL"
	}
	if body.DefaultValue != nil && *body.DefaultValue != "" {
		sql += formatDefault(*body.DefaultValue)
	}

	if err := pc.Exec(r.Context(), sql); err != nil {
		slog.Error("failed to add column", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to add column")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Column %s added successfully", body.ColumnName), map[string]any{
		"columnName": body.ColumnName,
		"columnType": body.ColumnType,
	})
}

func (h *Handler) AlterColumn(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	columnName := r.PathValue("columnName")

	var body struct {
		NewName      *string `json:"newName"`
		NewType      *string `json:"newType"`
		Nullable     *bool   `json:"nullable"`
		DefaultValue *string `json:"defaultValue"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	ctx := r.Context()

	if body.NewType != nil {
		if err := pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s" ALTER COLUMN "%s" TYPE %s`, tableName, columnName, *body.NewType)); err != nil {
			slog.Error("alter column type failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to alter column")
			return
		}
	}

	if body.Nullable != nil {
		action := "DROP NOT NULL"
		if !*body.Nullable {
			action = "SET NOT NULL"
		}
		if err := pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s" ALTER COLUMN "%s" %s`, tableName, columnName, action)); err != nil {
			slog.Error("alter column nullable failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to alter column")
			return
		}
	}

	if body.DefaultValue != nil {
		if *body.DefaultValue == "" {
			pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s" ALTER COLUMN "%s" DROP DEFAULT`, tableName, columnName))
		} else {
			sql := fmt.Sprintf(`ALTER TABLE "%s" ALTER COLUMN "%s" SET DEFAULT`, tableName, columnName)
			sql += " " + formatDefaultValue(*body.DefaultValue)
			if err := pc.Exec(ctx, sql); err != nil {
				slog.Error("alter column default failed", "error", err)
				httputil.WriteError(w, http.StatusInternalServerError, "Failed to alter column")
				return
			}
		}
	}

	if body.NewName != nil && *body.NewName != columnName {
		if err := pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s" RENAME COLUMN "%s" TO "%s"`, tableName, columnName, *body.NewName)); err != nil {
			slog.Error("rename column failed", "error", err)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to alter column")
			return
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Column %s altered successfully", columnName), nil)
}

func (h *Handler) DropColumn(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	columnName := r.PathValue("columnName")

	if err := pc.Exec(r.Context(), fmt.Sprintf(`ALTER TABLE "%s" DROP COLUMN IF EXISTS "%s"`, tableName, columnName)); err != nil {
		slog.Error("drop column failed", "error", err)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to drop column")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Column %s dropped successfully", columnName), nil)
}

// formatDefault returns the DEFAULT clause for PostgreSQL functions vs string literals.
func formatDefault(val string) string {
	return " DEFAULT " + formatDefaultValue(val)
}

func formatDefaultValue(val string) string {
	pgFunctions := []string{"CURRENT_TIMESTAMP", "NOW()", "CURRENT_DATE", "CURRENT_TIME", "LOCALTIMESTAMP", "LOCALTIME"}
	for _, fn := range pgFunctions {
		if strings.Contains(strings.ToUpper(val), fn) {
			return val
		}
	}
	return fmt.Sprintf(`'%s'`, strings.ReplaceAll(val, "'", "''"))
}
