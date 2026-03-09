package projects

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/skaftin/go-services/internal/config"
)

// S3Client wraps the MinIO client for bucket operations.
type S3Client struct {
	client *minio.Client
}

// NewS3Client creates a MinIO client from the application config.
func NewS3Client(cfg config.MinIOConfig) (*S3Client, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}
	return &S3Client{client: client}, nil
}

// BucketObjectStats holds aggregate stats for objects in a bucket.
type BucketObjectStats struct {
	FileCount   int       `json:"fileCount"`
	TotalSize   int64     `json:"totalSize"`
	LargestFile *FileInfo `json:"largestFile"`
	OldestFile  *FileInfo `json:"oldestFile"`
	NewestFile  *FileInfo `json:"newestFile"`
}

// FileInfo describes a single object.
type FileInfo struct {
	Key          string     `json:"key"`
	Size         int64      `json:"size,omitempty"`
	LastModified *time.Time `json:"lastModified,omitempty"`
}

// CountObjects returns the total number of objects in a bucket.
func (s *S3Client) CountObjects(ctx context.Context, bucketName string) (int, error) {
	count := 0
	for obj := range s.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{Recursive: true}) {
		if obj.Err != nil {
			return 0, obj.Err
		}
		count++
	}
	return count, nil
}

// GetBucketStats returns detailed stats about objects in a bucket.
func (s *S3Client) GetBucketStats(ctx context.Context, bucketName string) BucketObjectStats {
	stats := BucketObjectStats{}
	for obj := range s.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{Recursive: true, MaxKeys: 1000}) {
		if obj.Err != nil {
			break
		}
		stats.FileCount++
		stats.TotalSize += obj.Size

		if stats.LargestFile == nil || obj.Size > stats.LargestFile.Size {
			stats.LargestFile = &FileInfo{Key: obj.Key, Size: obj.Size}
		}
		mod := obj.LastModified
		if stats.OldestFile == nil || mod.Before(*stats.OldestFile.LastModified) {
			stats.OldestFile = &FileInfo{Key: obj.Key, LastModified: &mod}
		}
		if stats.NewestFile == nil || mod.After(*stats.NewestFile.LastModified) {
			stats.NewestFile = &FileInfo{Key: obj.Key, LastModified: &mod}
		}
	}
	return stats
}

// GetBucketSummary returns file count and total size for a bucket.
func (s *S3Client) GetBucketSummary(ctx context.Context, bucketName string) (fileCount int, totalSize int64) {
	for obj := range s.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{Recursive: true, MaxKeys: 1000}) {
		if obj.Err != nil {
			break
		}
		fileCount++
		totalSize += obj.Size
	}
	return
}

// EnsureBucket creates a bucket if it doesn't exist.
func (s *S3Client) EnsureBucket(ctx context.Context, bucketName string) error {
	exists, err := s.client.BucketExists(ctx, bucketName)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return s.client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
}

// BucketHasObjects checks if a bucket has at least one object.
func (s *S3Client) BucketHasObjects(ctx context.Context, bucketName string) (bool, error) {
	objCh := s.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{MaxKeys: 1})
	obj, ok := <-objCh
	if !ok {
		return false, nil
	}
	if obj.Err != nil {
		return false, obj.Err
	}
	return true, nil
}

// RemoveAllObjects deletes all objects in a bucket, returning the count of deleted objects.
func (s *S3Client) RemoveAllObjects(ctx context.Context, bucketName string) (int, error) {
	deleted := 0
	objectsCh := s.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{Recursive: true})
	for obj := range objectsCh {
		if obj.Err != nil {
			return deleted, obj.Err
		}
		if err := s.client.RemoveObject(ctx, bucketName, obj.Key, minio.RemoveObjectOptions{}); err != nil {
			return deleted, err
		}
		deleted++
	}
	return deleted, nil
}

// RemoveBucket deletes an empty bucket.
func (s *S3Client) RemoveBucket(ctx context.Context, bucketName string) error {
	return s.client.RemoveBucket(ctx, bucketName)
}

// SetBucketPolicy sets a bucket to public-read or private.
func (s *S3Client) SetBucketPolicy(ctx context.Context, bucketName, policy string) error {
	if policy == "public" {
		policyJSON := publicReadPolicy(bucketName)
		return s.client.SetBucketPolicy(ctx, bucketName, policyJSON)
	}
	// Private: remove any policy
	return s.client.SetBucketPolicy(ctx, bucketName, "")
}

// GetBucketPolicy returns "public" or "private" based on the current MinIO policy.
func (s *S3Client) GetBucketPolicy(ctx context.Context, bucketName string) string {
	policyStr, err := s.client.GetBucketPolicy(ctx, bucketName)
	if err != nil || policyStr == "" {
		return "private"
	}
	var pol map[string]any
	if err := json.Unmarshal([]byte(policyStr), &pol); err != nil {
		return "private"
	}
	stmts, ok := pol["Statement"].([]any)
	if !ok || len(stmts) == 0 {
		return "private"
	}
	for _, stmt := range stmts {
		s, ok := stmt.(map[string]any)
		if !ok {
			continue
		}
		if s["Effect"] == "Allow" {
			if principal, ok := s["Principal"].(string); ok && principal == "*" {
				return "public"
			}
			if principal, ok := s["Principal"].(map[string]any); ok {
				if aws, ok := principal["AWS"].(string); ok && aws == "*" {
					return "public"
				}
			}
		}
	}
	return "private"
}

func publicReadPolicy(bucketName string) string {
	policy := map[string]any{
		"Version": "2012-10-17",
		"Statement": []map[string]any{
			{
				"Effect":    "Allow",
				"Principal": map[string]any{"AWS": []string{"*"}},
				"Action":    []string{"s3:GetObject"},
				"Resource":  []string{fmt.Sprintf("arn:aws:s3:::%s/*", bucketName)},
			},
		},
	}
	b, err := json.Marshal(policy)
	if err != nil {
		slog.Error("failed to marshal bucket policy", "error", err)
		return ""
	}
	return string(b)
}
