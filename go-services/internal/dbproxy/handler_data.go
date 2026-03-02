package dbproxy

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/encryption"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 3: Data CRUD ---

func (h *Handler) SelectDataGet(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	q := r.URL.Query()

	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 100
	}
	offset, _ := strconv.Atoi(q.Get("offset"))

	selectClause := "*"
	if cols := q.Get("columns"); cols != "" {
		parts := strings.Split(cols, ",")
		quoted := make([]string, 0, len(parts))
		for _, c := range parts {
			c = strings.TrimSpace(c)
			if c != "" {
				quoted = append(quoted, fmt.Sprintf(`"%s"`, c))
			}
		}
		if len(quoted) > 0 {
			selectClause = strings.Join(quoted, ", ")
		}
	}

	query := fmt.Sprintf(`SELECT %s FROM "%s"`, selectClause, tableName)
	var args []any
	idx := 1

	if whereJSON := q.Get("where"); whereJSON != "" {
		var where map[string]any
		if err := json.Unmarshal([]byte(whereJSON), &where); err == nil && len(where) > 0 {
			var clauses []string
			for col, val := range where {
				clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
				args = append(args, val)
				idx++
			}
			query += " WHERE " + strings.Join(clauses, " AND ")
		}
	}

	query += fmt.Sprintf(" LIMIT $%d", idx)
	args = append(args, limit)
	idx++

	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", idx)
		args = append(args, offset)
	}

	rows, err := pc.Query(r.Context(), query, args...)
	if err != nil {
		slog.Error("select data get failed", "error", err, "table", tableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to select data")
		return
	}
	defer rows.Close()

	decryptFields := parseDecryptFieldsFromQuery(r.URL.Query().Get("decrypt"))
	result := collectRows(rows)
	if len(decryptFields) > 0 {
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
		if err := encryption.DecryptFieldsInRows(result, decryptFields, key); err != nil {
			slog.Error("failed to decrypt selected fields", "error", err, "table", tableName)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to decrypt selected fields")
			return
		}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Data fetched successfully", result)
}

func (h *Handler) SelectData(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		Columns        []string       `json:"columns"`
		Where          map[string]any `json:"where"`
		Limit          *int           `json:"limit"`
		Offset         int            `json:"offset"`
		OrderBy        string         `json:"orderBy"`
		OrderDirection string         `json:"orderDirection"`
		Decrypt        []string       `json:"decrypt"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	selectClause := "*"
	if len(body.Columns) > 0 {
		quoted := make([]string, len(body.Columns))
		for i, c := range body.Columns {
			quoted[i] = fmt.Sprintf(`"%s"`, c)
		}
		selectClause = strings.Join(quoted, ", ")
	}

	query := fmt.Sprintf(`SELECT %s FROM "%s"`, selectClause, tableName)
	var args []any
	idx := 1

	if len(body.Where) > 0 {
		var clauses []string
		for col, val := range body.Where {
			clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
			args = append(args, val)
			idx++
		}
		query += " WHERE " + strings.Join(clauses, " AND ")
	}

	orderBy := body.OrderBy
	if orderBy == "" {
		orderBy = "id"
	}
	dir := "ASC"
	if strings.EqualFold(body.OrderDirection, "DESC") {
		dir = "DESC"
	}
	query += fmt.Sprintf(` ORDER BY "%s" %s`, orderBy, dir)

	if body.Limit != nil {
		query += fmt.Sprintf(" LIMIT $%d", idx)
		args = append(args, *body.Limit)
		idx++
	}
	if body.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", idx)
		args = append(args, body.Offset)
	}

	rows, err := pc.Query(r.Context(), query, args...)
	if err != nil {
		slog.Error("select data failed", "error", err, "table", tableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to select data")
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	if len(body.Decrypt) > 0 {
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
		if err := encryption.DecryptFieldsInRows(result, body.Decrypt, key); err != nil {
			slog.Error("failed to decrypt selected fields", "error", err, "table", tableName)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to decrypt selected fields")
			return
		}
	}
	httputil.WriteSuccess(w, http.StatusOK, "Data fetched successfully", result)
}

func parseDecryptFieldsFromQuery(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		field := strings.TrimSpace(p)
		if field != "" {
			out = append(out, field)
		}
	}
	return out
}

func (h *Handler) InsertData(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		Data map[string]any `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Data == nil {
		httputil.WriteError(w, http.StatusBadRequest, "Data is required")
		return
	}

	autoIncrCols := getAutoIncrementColumns(r.Context(), pc, tableName)
	insertData := filterAutoIncrement(body.Data, autoIncrCols)
	syncSequencesToMax(r.Context(), pc, tableName, autoIncrCols)

	columns := make([]string, 0, len(insertData))
	values := make([]any, 0, len(insertData))
	placeholders := make([]string, 0, len(insertData))
	i := 1
	for col, val := range insertData {
		columns = append(columns, fmt.Sprintf(`"%s"`, col))
		values = append(values, val)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
		tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))

	rows, err := pc.Query(r.Context(), query, values...)
	if err != nil {
		slog.Error("insert data failed", "error", err, "table", tableName)
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to insert data")
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	var row any
	if len(result) > 0 {
		row = result[0]
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Data inserted successfully", row)
}

func (h *Handler) BulkInsertData(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		DataArray []map[string]any `json:"dataArray"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.DataArray) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Data array is required")
		return
	}

	autoIncrCols := getAutoIncrementColumns(r.Context(), pc, tableName)
	var inserted []map[string]any

	for _, data := range body.DataArray {
		rowData := filterAutoIncrement(data, autoIncrCols)

		columns := make([]string, 0, len(rowData))
		values := make([]any, 0, len(rowData))
		placeholders := make([]string, 0, len(rowData))
		i := 1
		for col, val := range rowData {
			columns = append(columns, fmt.Sprintf(`"%s"`, col))
			values = append(values, val)
			placeholders = append(placeholders, fmt.Sprintf("$%d", i))
			i++
		}

		query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
			tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))

		rows, err := pc.Query(r.Context(), query, values...)
		if err != nil {
			slog.Error("bulk insert row failed", "error", err, "table", tableName)
			httputil.WriteError(w, http.StatusInternalServerError, "Failed to bulk insert data")
			return
		}
		result := collectRows(rows)
		rows.Close()
		if len(result) > 0 {
			inserted = append(inserted, result[0])
		}
	}

	syncSequencesToMax(r.Context(), pc, tableName, autoIncrCols)
	httputil.WriteSuccess(w, http.StatusCreated, fmt.Sprintf("%d rows inserted successfully", len(inserted)), inserted)
}

func (h *Handler) UpdateData(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		Data  map[string]any `json:"data"`
		Where map[string]any `json:"where"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Data == nil || body.Where == nil {
		httputil.WriteError(w, http.StatusBadRequest, "Data and where clause are required")
		return
	}
	if len(body.Where) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Where clause cannot be empty. At least one condition is required for safety.")
		return
	}

	var setClauses []string
	var args []any
	idx := 1
	for col, val := range body.Data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		args = append(args, val)
		idx++
	}

	var whereClauses []string
	for col, val := range body.Where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		args = append(args, val)
		idx++
	}

	query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s RETURNING *`,
		tableName, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))

	rows, err := pc.Query(r.Context(), query, args...)
	if err != nil {
		slog.Error("update data failed", "error", err, "table", tableName)
		errMsg := "Failed to update data"
		if pgErr := err.Error(); strings.Contains(pgErr, "23503") {
			errMsg = "Cannot update row: Foreign key constraint violation"
		}
		httputil.WriteError(w, http.StatusInternalServerError, errMsg)
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	if len(result) == 0 {
		httputil.WriteError(w, http.StatusNotFound, "No rows were updated. The specified row may not exist or may not match the where clause.")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("%d row(s) updated successfully", len(result)), result)
}

func (h *Handler) DeleteData(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	tableName := r.PathValue("tableName")
	var body struct {
		Where map[string]any `json:"where"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Where == nil {
		httputil.WriteError(w, http.StatusBadRequest, "Where clause is required")
		return
	}
	if len(body.Where) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Where clause cannot be empty. At least one condition is required for safety.")
		return
	}

	var whereClauses []string
	var args []any
	idx := 1
	for col, val := range body.Where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		args = append(args, val)
		idx++
	}

	query := fmt.Sprintf(`DELETE FROM "%s" WHERE %s RETURNING *`, tableName, strings.Join(whereClauses, " AND "))

	rows, err := pc.Query(r.Context(), query, args...)
	if err != nil {
		slog.Error("delete data failed", "error", err, "table", tableName)
		errMsg := "Failed to delete data"
		if strings.Contains(err.Error(), "23503") {
			errMsg = "Cannot delete row: It is referenced by other tables through foreign key constraints."
		}
		httputil.WriteError(w, http.StatusInternalServerError, errMsg)
		return
	}
	defer rows.Close()

	result := collectRows(rows)
	if len(result) == 0 {
		httputil.WriteError(w, http.StatusNotFound, "No rows were deleted. The specified row may not exist or may not match the where clause.")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, fmt.Sprintf("%d row(s) deleted successfully", len(result)), map[string]any{
		"deletedCount": len(result),
	})
}
