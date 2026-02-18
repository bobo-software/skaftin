package workflows

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for workflow execution, scheduling, and variable resolution.
type Service struct {
	store *Store
}

// NewService creates a new workflows Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
