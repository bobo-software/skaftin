package analytics

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for metric aggregation.
type Service struct {
	store *Store
}

// NewService creates a new analytics Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
