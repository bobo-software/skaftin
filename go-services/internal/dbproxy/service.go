package dbproxy

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Service contains business logic for project database operations.
type Service struct {
	store *Store
}

// NewService creates a new dbproxy Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

// AcquireConn acquires a project-scoped database connection.
func (s *Service) AcquireConn(ctx context.Context, projectID int) (*ProjectConn, error) {
	return s.store.AcquireProjectConn(ctx, projectID)
}

// ListTables returns all tables in the project schema.
func (s *Service) ListTables(ctx context.Context, pc *ProjectConn, includeSystemTables bool) ([]map[string]any, error) {
	return s.store.ListTables(ctx, pc, includeSystemTables)
}

// GetTableSchema returns column definitions for a table.
func (s *Service) GetTableSchema(ctx context.Context, pc *ProjectConn, tableName string) ([]TableColumn, error) {
	return s.store.GetTableSchema(ctx, pc, tableName)
}
