package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/skaftin/go-services/internal/config"
)

// ObjectInfo represents a single S3 object.
type ObjectInfo struct {
	Key          string     `json:"key"`
	Size         int64      `json:"size"`
	LastModified time.Time  `json:"lastModified"`
	ETag         string     `json:"etag"`
	ContentType  string     `json:"contentType,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// S3Client wraps the MinIO client for file-level storage operations.
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

// ListObjects lists objects in a bucket with an optional prefix and max key limit.
func (s *S3Client) ListObjects(ctx context.Context, bucket, prefix string, maxKeys int) ([]ObjectInfo, error) {
	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
		MaxKeys:   maxKeys,
	}

	var objects []ObjectInfo
	for obj := range s.client.ListObjects(ctx, bucket, opts) {
		if obj.Err != nil {
			return nil, obj.Err
		}
		objects = append(objects, ObjectInfo{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
			ETag:         obj.ETag,
		})
	}
	return objects, nil
}

// PutObject uploads an object to a bucket.
func (s *S3Client) PutObject(ctx context.Context, bucket, key string, reader io.Reader, size int64, contentType string, metadata map[string]string) error {
	opts := minio.PutObjectOptions{
		ContentType:  contentType,
		UserMetadata: metadata,
	}
	_, err := s.client.PutObject(ctx, bucket, key, reader, size, opts)
	return err
}

// PresignedGetObject generates a presigned download URL valid for the given duration.
func (s *S3Client) PresignedGetObject(ctx context.Context, bucket, key string, expiry time.Duration) (*url.URL, error) {
	reqParams := make(url.Values)
	return s.client.PresignedGetObject(ctx, bucket, key, expiry, reqParams)
}

// StatObject returns metadata for a single object.
func (s *S3Client) StatObject(ctx context.Context, bucket, key string) (ObjectInfo, error) {
	info, err := s.client.StatObject(ctx, bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return ObjectInfo{}, err
	}
	return ObjectInfo{
		Key:          info.Key,
		Size:         info.Size,
		LastModified: info.LastModified,
		ETag:         info.ETag,
		ContentType:  info.ContentType,
		Metadata:     info.UserMetadata,
	}, nil
}

// RemoveObject deletes a single object from a bucket.
func (s *S3Client) RemoveObject(ctx context.Context, bucket, key string) error {
	return s.client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{})
}

// RemoveObjects deletes multiple objects from a bucket, returning the count of deleted objects.
func (s *S3Client) RemoveObjects(ctx context.Context, bucket string, keys []string) (int, error) {
	objectsCh := make(chan minio.ObjectInfo, len(keys))
	for _, key := range keys {
		objectsCh <- minio.ObjectInfo{Key: key}
	}
	close(objectsCh)

	deleted := 0
	for err := range s.client.RemoveObjects(ctx, bucket, objectsCh, minio.RemoveObjectsOptions{}) {
		if err.Err != nil {
			return deleted, fmt.Errorf("failed to delete %s: %w", err.ObjectName, err.Err)
		}
		deleted++
	}
	return len(keys), nil
}

// GetObject returns the object body as an io.ReadCloser. The caller must close it.
func (s *S3Client) GetObject(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	return obj, nil
}

// CopyObject copies an object within the same bucket.
func (s *S3Client) CopyObject(ctx context.Context, bucket, srcKey, dstKey string) error {
	src := minio.CopySrcOptions{Bucket: bucket, Object: srcKey}
	dst := minio.CopyDestOptions{Bucket: bucket, Object: dstKey}
	_, err := s.client.CopyObject(ctx, dst, src)
	return err
}
