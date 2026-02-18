package backups

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for backup orchestration.
type Service struct {
	store *Store
}

// NewService creates a new backups Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
