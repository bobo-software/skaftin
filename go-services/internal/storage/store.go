package storage

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Bucket represents a project bucket row from the database.
type Bucket struct {
	ID          int       `json:"id"`
	BucketName  string    `json:"bucket_name"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Store handles database operations for storage.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new storage Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// ValidateBucketForProject checks whether a bucket belongs to the given project.
func (s *Store) ValidateBucketForProject(ctx context.Context, projectID int, bucketName string) (bool, error) {
	var id int
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM skaftin_system_project_buckets WHERE project_id = $1 AND bucket_name = $2`,
		projectID, bucketName,
	).Scan(&id)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ListProjectBuckets returns all buckets belonging to a project.
func (s *Store) ListProjectBuckets(ctx context.Context, projectID int) ([]Bucket, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, bucket_name, description, created_at, updated_at
		 FROM skaftin_system_project_buckets
		 WHERE project_id = $1
		 ORDER BY created_at`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	buckets := make([]Bucket, 0)
	for rows.Next() {
		var b Bucket
		if err := rows.Scan(&b.ID, &b.BucketName, &b.Description, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		buckets = append(buckets, b)
	}
	return buckets, rows.Err()
}
