package organizations

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles organization DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new organizations Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
