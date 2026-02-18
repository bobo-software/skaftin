package dbproxy

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

// collectRows reads all rows from a pgx.Rows into a slice of maps.
func collectRows(rows pgx.Rows) []map[string]any {
	descs := rows.FieldDescriptions()
	var result []map[string]any

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			slog.Error("row scan error", "error", err)
			continue
		}
		row := make(map[string]any, len(descs))
		for i, fd := range descs {
			row[fd.Name] = values[i]
		}
		result = append(result, row)
	}

	if result == nil {
		result = []map[string]any{}
	}
	return result
}

// safeIdent validates and quotes an identifier. Returns empty string if invalid.
func safeIdent(name string) string {
	if ok, _ := regexp.MatchString(`^[a-zA-Z_][a-zA-Z0-9_]*$`, name); !ok {
		return ""
	}
	return fmt.Sprintf(`"%s"`, strings.ReplaceAll(name, `"`, `""`))
}

// getAutoIncrementColumns returns column names that have nextval() defaults (SERIAL/BIGSERIAL).
func getAutoIncrementColumns(ctx context.Context, pc *ProjectConn, tableName string) []string {
	rows, err := pc.Query(ctx, `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = $1
		  AND column_default IS NOT NULL
		  AND column_default::text LIKE 'nextval(%'
	`, tableName)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var col string
		if rows.Scan(&col) == nil {
			cols = append(cols, col)
		}
	}
	return cols
}

// filterAutoIncrement returns a copy of data with auto-increment columns removed.
func filterAutoIncrement(data map[string]any, autoIncrCols []string) map[string]any {
	if len(autoIncrCols) == 0 {
		return data
	}
	skip := make(map[string]bool, len(autoIncrCols))
	for _, c := range autoIncrCols {
		skip[c] = true
	}
	out := make(map[string]any, len(data))
	for k, v := range data {
		if !skip[k] {
			out[k] = v
		}
	}
	return out
}

// syncSequencesToMax syncs serial sequences to MAX(col) to avoid duplicate key after manual inserts.
func syncSequencesToMax(ctx context.Context, pc *ProjectConn, tableName string, autoIncrCols []string) {
	safeTable := safeIdent(tableName)
	if safeTable == "" {
		return
	}
	for _, col := range autoIncrCols {
		safeCol := safeIdent(col)
		if safeCol == "" {
			continue
		}
		_, err := pc.conn.Exec(ctx, fmt.Sprintf(`
			SELECT setval(
				pg_get_serial_sequence($1::text, $2::text),
				COALESCE((SELECT MAX(%s) FROM %s), 1)
			)
		`, safeCol, safeTable), tableName, col)
		if err != nil {
			slog.Warn("syncSequencesToMax failed", "table", tableName, "column", col, "error", err)
		}
	}
}

// columnExists checks whether a column exists in a table within the current schema.
func columnExists(ctx context.Context, pc *ProjectConn, tableName, columnName string) bool {
	var exists bool
	pc.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = $1
			  AND column_name = $2
		)
	`, tableName, columnName).Scan(&exists)
	return exists
}

// normalizeQuery converts MySQL backtick identifiers to PostgreSQL double quotes.
func normalizeQuery(query string) string {
	re := regexp.MustCompile("`([^`]+)`")
	return re.ReplaceAllStringFunc(query, func(match string) string {
		ident := match[1 : len(match)-1]
		if strings.Contains(ident, ".") {
			parts := strings.Split(ident, ".")
			quoted := make([]string, len(parts))
			for i, p := range parts {
				quoted[i] = fmt.Sprintf(`"%s"`, strings.TrimSpace(p))
			}
			return strings.Join(quoted, ".")
		}
		return fmt.Sprintf(`"%s"`, ident)
	})
}
