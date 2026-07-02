package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/bulkresult"
	"github.com/skaftin/go-services/internal/pkg/encryption"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func (h *Handler) BulkDeleteData(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		IDs      []any  `json:"ids"`
		IDColumn string `json:"idColumn"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "ids array is required")
		return
	}
	if len(body.IDs) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}

	idColumn := strings.TrimSpace(body.IDColumn)
	if idColumn == "" {
		idColumn = "id"
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.IDs))}
	query := fmt.Sprintf(`DELETE FROM "%s" WHERE "%s" = $1 RETURNING *`, tableName, idColumn)
	for i, id := range body.IDs {
		result := bulkresult.ItemResult{Index: i, ID: id}
		rows, err := pc.Query(r.Context(), query, id)
		if err != nil {
			slog.Error("bulk delete row failed", "error", err, "table", tableName, "idColumn", idColumn, "id", id)
			summary.AddFailure(result, bulkDeleteErrorMessage(err))
			continue
		}
		deleted := collectRows(rows)
		rows.Close()
		if len(deleted) == 0 {
			summary.AddFailure(result, "No rows were deleted. The specified row may not exist or may not match the identifier.")
			continue
		}
		result.Data = map[string]any{"rows": deleted, "deletedCount": len(deleted)}
		summary.AddSuccess(result)
		for _, row := range deleted {
			h.emitDatabaseEvent(pid, "delete", tableName, row, nil)
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk delete completed: %d succeeded, %d failed", summary.Succeeded, summary.Failed), summary)
}

func (h *Handler) BulkUpdateData(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		Updates []struct {
			Data  map[string]any `json:"data"`
			Where map[string]any `json:"where"`
		} `json:"updates"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Updates) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "updates array is required")
		return
	}
	if len(body.Updates) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.Updates))}
	for i, update := range body.Updates {
		result := bulkresult.ItemResult{Index: i}
		if len(update.Data) == 0 || len(update.Where) == 0 {
			summary.AddFailure(result, "Each update item requires non-empty data and where fields")
			continue
		}

		setClause, setArgs := buildAssignmentClause(update.Data, 1)
		whereClause, whereArgs, nextIdx := buildWhereClause(update.Where, len(setArgs)+1)
		query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s RETURNING *`, tableName, setClause, whereClause)
		args := append(setArgs, whereArgs...)

		rows, err := pc.Query(r.Context(), query, args...)
		_ = nextIdx
		if err != nil {
			slog.Error("bulk update row failed", "error", err, "table", tableName)
			summary.AddFailure(result, bulkUpdateErrorMessage(err))
			continue
		}
		updated := collectRows(rows)
		rows.Close()
		if len(updated) == 0 {
			summary.AddFailure(result, "No rows were updated. The specified row may not exist or may not match the where clause.")
			continue
		}
		result.Data = map[string]any{"rows": updated, "updatedCount": len(updated)}
		summary.AddSuccess(result)
		for _, row := range updated {
			h.emitDatabaseEvent(pid, "update", tableName, row, nil)
		}
	}

	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk update completed: %d succeeded, %d failed", summary.Succeeded, summary.Failed), summary)
}

func (h *Handler) BulkUpsertData(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		DataArray       []map[string]any `json:"dataArray"`
		ConflictColumns []string         `json:"conflictColumns"`
		Encrypt         []string         `json:"encrypt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.DataArray) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "dataArray is required")
		return
	}
	if len(body.DataArray) > bulkresult.MaxBatchSize {
		httputil.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize))
		return
	}
	if len(body.ConflictColumns) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "conflictColumns is required")
		return
	}

	schema, err := h.service.store.GetTableSchema(r.Context(), pc, tableName)
	if err != nil {
		slog.Error("bulk upsert schema lookup failed", "error", err, "table", tableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to inspect table schema")
		return
	}
	if !validateConflictColumns(schema, body.ConflictColumns) {
		httputil.WriteError(w, http.StatusBadRequest, "conflictColumns must reference primary key columns on the target table")
		return
	}

	autoIncrCols := getAutoIncrementColumns(r.Context(), pc, tableName)
	encKey := ""
	if len(body.Encrypt) > 0 {
		key, err := encryption.GetProjectFieldEncryptionKey(r.Context(), h.service.store.pool, pid)
		if err != nil {
			slog.Error("failed to get encryption key", "error", err, "projectId", pid)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to fetch encryption key")
			return
		}
		if strings.TrimSpace(key) == "" {
			httputil.WriteError(w, http.StatusBadRequest, "No encryption key / secret found")
			return
		}
		encKey = key
	}

	summary := bulkresult.Summary{Results: make([]bulkresult.ItemResult, 0, len(body.DataArray))}
	for i, raw := range body.DataArray {
		result := bulkresult.ItemResult{Index: i}
		rowData := filterAutoIncrement(cloneMap(raw), autoIncrCols)
		if len(rowData) == 0 {
			summary.AddFailure(result, "Row data is empty after removing auto-increment columns")
			continue
		}
		if encKey != "" {
			if err := encryption.EncryptFieldsInData(rowData, body.Encrypt, encKey); err != nil {
				summary.AddFailure(result, "Failed to encrypt selected fields")
				continue
			}
		}

		query, args, err := buildBulkUpsertQuery(tableName, rowData, body.ConflictColumns)
		if err != nil {
			summary.AddFailure(result, err.Error())
			continue
		}
		rows, err := pc.Query(r.Context(), query, args...)
		if err != nil {
			slog.Error("bulk upsert row failed", "error", err, "table", tableName)
			summary.AddFailure(result, "Failed to bulk upsert data")
			continue
		}
		upserted := collectRows(rows)
		rows.Close()
		if len(upserted) == 0 {
			summary.AddFailure(result, "Upsert did not return a row")
			continue
		}

		row := upserted[0]
		wasInsert := false
		if insertFlag, ok := row["__skaftin_inserted"].(bool); ok {
			wasInsert = insertFlag
		}
		delete(row, "__skaftin_inserted")
		result.Data = map[string]any{
			"row":       row,
			"operation": map[bool]string{true: "insert", false: "update"}[wasInsert],
		}
		summary.AddSuccess(result)
		if wasInsert {
			h.emitDatabaseEvent(pid, "insert", tableName, row, nil)
		} else {
			h.emitDatabaseEvent(pid, "update", tableName, row, nil)
		}
	}

	syncSequencesToMax(r.Context(), pc, tableName, autoIncrCols)
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("Bulk upsert completed: %d succeeded, %d failed", summary.Succeeded, summary.Failed), summary)
}

func buildAssignmentClause(data map[string]any, startIdx int) (string, []any) {
	keys := sortedMapKeys(data)
	clauses := make([]string, 0, len(keys))
	args := make([]any, 0, len(keys))
	idx := startIdx
	for _, key := range keys {
		clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, key, idx))
		args = append(args, data[key])
		idx++
	}
	return strings.Join(clauses, ", "), args
}

func buildWhereClause(where map[string]any, startIdx int) (string, []any, int) {
	keys := sortedMapKeys(where)
	clauses := make([]string, 0, len(keys))
	args := make([]any, 0, len(keys))
	idx := startIdx
	for _, key := range keys {
		clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, key, idx))
		args = append(args, where[key])
		idx++
	}
	return strings.Join(clauses, " AND "), args, idx
}

func buildBulkUpsertQuery(tableName string, rowData map[string]any, conflictColumns []string) (string, []any, error) {
	keys := sortedMapKeys(rowData)
	if len(keys) == 0 {
		return "", nil, fmt.Errorf("Row data is empty")
	}

	columns := make([]string, 0, len(keys))
	placeholders := make([]string, 0, len(keys))
	args := make([]any, 0, len(keys))
	for idx, key := range keys {
		columns = append(columns, fmt.Sprintf(`"%s"`, key))
		placeholders = append(placeholders, fmt.Sprintf("$%d", idx+1))
		args = append(args, rowData[key])
	}

	updateColumns := make([]string, 0, len(keys))
	conflictSet := make(map[string]struct{}, len(conflictColumns))
	for _, col := range conflictColumns {
		conflictSet[col] = struct{}{}
	}
	for _, key := range keys {
		if _, ok := conflictSet[key]; ok {
			continue
		}
		updateColumns = append(updateColumns, fmt.Sprintf(`"%s" = EXCLUDED."%s"`, key, key))
	}
	if len(updateColumns) == 0 {
		first := strings.TrimSpace(conflictColumns[0])
		updateColumns = append(updateColumns, fmt.Sprintf(`"%s" = EXCLUDED."%s"`, first, first))
	}

	conflicts := make([]string, 0, len(conflictColumns))
	for _, col := range conflictColumns {
		conflicts = append(conflicts, fmt.Sprintf(`"%s"`, strings.TrimSpace(col)))
	}

	query := fmt.Sprintf(
		`INSERT INTO "%s" (%s) VALUES (%s) ON CONFLICT (%s) DO UPDATE SET %s RETURNING *, (xmax = 0) AS "__skaftin_inserted"`,
		tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
		strings.Join(conflicts, ", "),
		strings.Join(updateColumns, ", "),
	)
	return query, args, nil
}

func validateConflictColumns(schema []TableColumn, conflictColumns []string) bool {
	if len(schema) == 0 || len(conflictColumns) == 0 {
		return false
	}
	primaryKeys := make(map[string]struct{})
	for _, col := range schema {
		if col.IsPrimaryKey {
			primaryKeys[col.ColumnName] = struct{}{}
		}
	}
	if len(primaryKeys) == 0 {
		return false
	}
	for _, col := range conflictColumns {
		col = strings.TrimSpace(col)
		if col == "" {
			return false
		}
		if _, ok := primaryKeys[col]; !ok {
			return false
		}
	}
	return true
}

func sortedMapKeys(data map[string]any) []string {
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func cloneMap(data map[string]any) map[string]any {
	cloned := make(map[string]any, len(data))
	for key, value := range data {
		cloned[key] = value
	}
	return cloned
}

func bulkDeleteErrorMessage(err error) string {
	if strings.Contains(err.Error(), "23503") {
		return "Cannot delete row: It is referenced by other tables through foreign key constraints."
	}
	return "Failed to delete data"
}

func bulkUpdateErrorMessage(err error) string {
	if strings.Contains(err.Error(), "23503") {
		return "Cannot update row: Foreign key constraint violation"
	}
	return "Failed to update data"
}
