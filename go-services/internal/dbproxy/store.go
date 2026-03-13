package dbproxy

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/dbmetrics"
)

// Store handles dynamic SQL against project schemas.
type Store struct {
	pool     *pgxpool.Pool
	recorder *dbmetrics.Recorder
}

// NewStore creates a new dbproxy Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{
		pool:     pool,
		recorder: dbmetrics.NewRecorder(pool),
	}
}

// ProjectConn wraps a pgx connection with the project's search_path set.
// The caller MUST call Release() when done.
type ProjectConn struct {
	conn       *pgxpool.Conn
	ProjectID  int
	SchemaName string
	recorder   *dbmetrics.Recorder
}

// Release returns the connection to the pool.
func (pc *ProjectConn) Release() {
	if pc.conn != nil {
		pc.conn.Release()
	}
}

// Query executes a query that returns rows.
func (pc *ProjectConn) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	start := time.Now()
	rows, err := pc.conn.Query(ctx, sql, args...)
	pc.captureMetric(ctx, sql, 0, start)
	return rows, err
}

// QueryRow executes a query that returns at most one row.
func (pc *ProjectConn) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	start := time.Now()
	row := pc.conn.QueryRow(ctx, sql, args...)
	return dbmetrics.WrapRow(row, func(scanErr error) {
		rowsAffected := int64(0)
		if scanErr == nil {
			rowsAffected = 1
		}
		pc.captureMetric(ctx, sql, rowsAffected, start)
	})
}

// Exec executes a query that doesn't return rows.
func (pc *ProjectConn) Exec(ctx context.Context, sql string, args ...any) error {
	start := time.Now()
	tag, err := pc.conn.Exec(ctx, sql, args...)
	rowsAffected := int64(0)
	if err == nil {
		rowsAffected = tag.RowsAffected()
	}
	pc.captureMetric(ctx, sql, rowsAffected, start)
	return err
}

func (pc *ProjectConn) captureMetric(ctx context.Context, sql string, rowsAffected int64, startedAt time.Time) {
	if pc == nil || pc.recorder == nil || pc.ProjectID <= 0 {
		return
	}
	pc.recorder.Record(ctx, dbmetrics.Record{
		ProjectID:    pc.ProjectID,
		Query:        sql,
		RowsAffected: rowsAffected,
		Duration:     time.Since(startedAt),
	})
}

// AcquireProjectConn looks up the schema for a project, acquires a pooled
// connection, and sets search_path. Returns nil if the project doesn't exist.
func (s *Store) AcquireProjectConn(ctx context.Context, projectID int) (*ProjectConn, error) {
	var schemaName string
	err := s.pool.QueryRow(ctx,
		`SELECT schema_name FROM skaftin_system_projects WHERE id = $1`,
		projectID,
	).Scan(&schemaName)
	if err != nil {
		return nil, fmt.Errorf("project lookup: %w", err)
	}

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquire connection: %w", err)
	}

	_, err = conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schemaName))
	if err != nil {
		conn.Release()
		return nil, fmt.Errorf("set search_path: %w", err)
	}

	return &ProjectConn{
		conn:       conn,
		ProjectID:  projectID,
		SchemaName: schemaName,
		recorder:   s.recorder,
	}, nil
}

// ListTables returns all base tables in the project schema.
func (s *Store) ListTables(ctx context.Context, pc *ProjectConn, includeSystemTables bool) ([]map[string]any, error) {
	query := `
		SELECT table_name, table_schema, table_type
		FROM information_schema.tables
		WHERE table_schema = current_schema()
		  AND table_type = 'BASE TABLE'
	`
	if !includeSystemTables {
		query += ` AND table_name NOT LIKE 'skaftin_system_%'`
	}
	query += ` ORDER BY table_name`

	rows, err := pc.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]map[string]any, 0)
	for rows.Next() {
		var name, schema, tableType string
		if err := rows.Scan(&name, &schema, &tableType); err != nil {
			return nil, err
		}
		tables = append(tables, map[string]any{
			"table_name":   name,
			"table_schema": schema,
			"table_type":   tableType,
		})
	}
	return tables, rows.Err()
}

// TableColumn represents a column in a table schema.
type TableColumn struct {
	ColumnName             string  `json:"column_name"`
	DataType               string  `json:"data_type"`
	CharacterMaximumLength *int    `json:"character_maximum_length"`
	IsNullable             bool    `json:"is_nullable"`
	ColumnDefault          *string `json:"column_default"`
	OrdinalPosition        int     `json:"ordinal_position"`
	IsPrimaryKey           bool    `json:"is_primary_key"`
}

// GetTableSchema returns column definitions for a table including primary key info.
func (s *Store) GetTableSchema(ctx context.Context, pc *ProjectConn, tableName string) ([]TableColumn, error) {
	rows, err := pc.Query(ctx, `
		SELECT
			column_name,
			data_type,
			character_maximum_length,
			is_nullable,
			column_default,
			ordinal_position
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = $1
		ORDER BY ordinal_position
	`, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]TableColumn, 0)
	for rows.Next() {
		var c TableColumn
		var nullable string
		if err := rows.Scan(&c.ColumnName, &c.DataType, &c.CharacterMaximumLength, &nullable, &c.ColumnDefault, &c.OrdinalPosition); err != nil {
			return nil, err
		}
		c.IsNullable = nullable == "YES"
		columns = append(columns, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(columns) == 0 {
		return nil, nil
	}

	// Fetch primary key columns
	pkRows, err := pc.Query(ctx, `
		SELECT a.attname as column_name
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE i.indrelid = $1::regclass AND i.indisprimary = true
	`, tableName)
	if err != nil {
		return columns, nil
	}
	defer pkRows.Close()

	pkSet := make(map[string]bool)
	for pkRows.Next() {
		var col string
		if err := pkRows.Scan(&col); err == nil {
			pkSet[col] = true
		}
	}

	for i := range columns {
		columns[i].IsPrimaryKey = pkSet[columns[i].ColumnName]
	}

	return columns, nil
}
