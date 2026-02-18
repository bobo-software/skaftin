package communications

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for email/SMS dispatch and template rendering.
type Service struct {
	store *Store
}

// NewService creates a new communications Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
