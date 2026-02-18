package analytics

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles analytics DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new analytics Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
