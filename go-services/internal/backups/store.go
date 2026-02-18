package backups

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles backup schedule DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new backups Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
