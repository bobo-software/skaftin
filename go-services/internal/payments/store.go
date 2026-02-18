package payments

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles transaction DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new payments Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
