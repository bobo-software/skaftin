package appauth

import "github.com/jackc/pgx/v5/pgxpool"

// Service contains business logic for app-user authentication.
type Service struct {
	store *Store
}

// NewService creates a new appauth Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}
