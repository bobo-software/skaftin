package projects

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for project management.
type Service struct {
	store *Store
}

// NewService creates a new projects Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
