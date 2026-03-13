package dbmetrics

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	fromPattern   = regexp.MustCompile(`(?i)\bfrom\s+([a-zA-Z0-9_."$]+)`)
	intoPattern   = regexp.MustCompile(`(?i)\binto\s+([a-zA-Z0-9_."$]+)`)
	updatePattern = regexp.MustCompile(`(?i)\bupdate\s+([a-zA-Z0-9_."$]+)`)
	tablePattern  = regexp.MustCompile(`(?i)\btable\s+([a-zA-Z0-9_."$]+)`)
)

type Record struct {
	ProjectID    int
	Query        string
	RowsAffected int64
	Duration     time.Duration
}

type Recorder struct {
	pool *pgxpool.Pool
}

func NewRecorder(pool *pgxpool.Pool) *Recorder {
	return &Recorder{pool: pool}
}

func (r *Recorder) Record(ctx context.Context, rec Record) {
	if r == nil || r.pool == nil || rec.ProjectID <= 0 {
		return
	}

	queryType := inferQueryType(rec.Query)
	if queryType == "" {
		return
	}

	normalized := strings.ToLower(rec.Query)
	if strings.Contains(normalized, "skaftin_system_database_metrics") {
		return
	}

	tableName := extractTableName(rec.Query, queryType)
	execMs := int(rec.Duration.Milliseconds())
	if execMs < 0 {
		execMs = 0
	}
	rowsAffected := int(rec.RowsAffected)
	if rowsAffected < 0 {
		rowsAffected = 0
	}

	_, _ = r.pool.Exec(ctx, `
		INSERT INTO public.skaftin_system_database_metrics
			(project_id, table_name, query_type, execution_time_ms, rows_affected, created_at)
		VALUES
			($1, $2, $3, $4, $5, NOW())`,
		rec.ProjectID,
		nullableString(tableName),
		queryType,
		execMs,
		rowsAffected,
	)
}

type rowWithCapture struct {
	row    pgx.Row
	onScan func(error)
}

func (r *rowWithCapture) Scan(dest ...any) error {
	err := r.row.Scan(dest...)
	if r.onScan != nil {
		r.onScan(err)
	}
	return err
}

func WrapRow(row pgx.Row, onScan func(error)) pgx.Row {
	return &rowWithCapture{row: row, onScan: onScan}
}

func inferQueryType(query string) string {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return ""
	}
	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return ""
	}

	first := strings.ToUpper(parts[0])
	if first == "WITH" {
		low := strings.ToLower(trimmed)
		switch {
		case strings.Contains(low, " insert "):
			return "INSERT"
		case strings.Contains(low, " update "):
			return "UPDATE"
		case strings.Contains(low, " delete "):
			return "DELETE"
		default:
			return "SELECT"
		}
	}
	return first
}

func extractTableName(query, queryType string) string {
	var matches []string
	switch queryType {
	case "SELECT":
		matches = fromPattern.FindStringSubmatch(query)
	case "INSERT":
		matches = intoPattern.FindStringSubmatch(query)
	case "UPDATE":
		matches = updatePattern.FindStringSubmatch(query)
	case "DELETE":
		matches = fromPattern.FindStringSubmatch(query)
	case "ALTER", "CREATE", "DROP", "TRUNCATE":
		matches = tablePattern.FindStringSubmatch(query)
	}
	if len(matches) < 2 {
		return ""
	}

	raw := strings.TrimSpace(matches[1])
	raw = strings.Trim(raw, `"'`)
	raw = strings.TrimSuffix(raw, ",")
	if idx := strings.LastIndex(raw, "."); idx >= 0 {
		raw = raw[idx+1:]
	}
	raw = strings.Trim(raw, `"'`)
	return raw
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
