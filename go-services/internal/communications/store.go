package communications

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles provider and template DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new communications Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
