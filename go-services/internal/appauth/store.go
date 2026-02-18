package appauth

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles app user DB operations.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new appauth Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
