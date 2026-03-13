package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/dbmetrics"
)

// LookupSchemaName retrieves the schema_name for a project by its ID.
func LookupSchemaName(ctx context.Context, pool *pgxpool.Pool, projectID int) (string, error) {
	var schemaName string
	query := `SELECT schema_name FROM skaftin_system_projects WHERE id = $1 AND deletion_scheduled_at IS NULL AND deleted_at IS NULL`
	start := time.Now()
	err := pool.QueryRow(
		ctx,
		query,
		projectID,
	).Scan(&schemaName)
	if err != nil {
		return "", err
	}

	dbmetrics.NewRecorder(pool).Record(ctx, dbmetrics.Record{
		ProjectID:    projectID,
		Query:        query,
		RowsAffected: 1,
		Duration:     time.Since(start),
	})
	return schemaName, nil
}
