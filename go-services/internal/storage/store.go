package storage

import "github.com/jackc/pgx/v5/pgxpool"

// Store handles MinIO client operations for project storage.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new storage Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
