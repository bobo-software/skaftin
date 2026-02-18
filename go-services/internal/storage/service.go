package storage

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for project object storage operations.
type Service struct {
	store *Store
}

// NewService creates a new storage Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
