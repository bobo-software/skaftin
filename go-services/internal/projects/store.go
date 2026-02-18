package projects

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles project DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new projects Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
