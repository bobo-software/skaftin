package organizations

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for organization management.
type Service struct {
	store *Store
}

// NewService creates a new organizations Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
