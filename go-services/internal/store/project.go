package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LookupSchemaName retrieves the schema_name for a project by its ID.
func LookupSchemaName(ctx context.Context, pool *pgxpool.Pool, projectID int) (string, error) {
	var schemaName string
	err := pool.QueryRow(
		ctx,
		`SELECT schema_name FROM skaftin_system_projects WHERE id = $1 AND deletion_scheduled_at IS NULL AND deleted_at IS NULL`,
		projectID,
	).Scan(&schemaName)
	if err != nil {
		return "", err
	}
	return schemaName, nil
}
