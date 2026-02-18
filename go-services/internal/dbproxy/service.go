package dbproxy

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for project database operations.
type Service struct {
	store *Store
}

// NewService creates a new dbproxy Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
