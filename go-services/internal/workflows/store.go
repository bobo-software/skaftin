package workflows

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles workflow DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new workflows Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
