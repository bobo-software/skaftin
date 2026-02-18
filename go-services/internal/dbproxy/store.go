package dbproxy

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles dynamic SQL against project schemas.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new dbproxy Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
