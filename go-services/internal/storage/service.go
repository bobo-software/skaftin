package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/config"
)

const presignExpiry = 1 * time.Hour

// BucketInfo is the API representation of a bucket, optionally with stats.
type BucketInfo struct {
	ID           int        `json:"id"`
	Name         string     `json:"name"`
	Description  *string    `json:"description"`
	CreationDate time.Time  `json:"creationDate"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	FileCount    *int       `json:"fileCount,omitempty"`
	TotalSize    *int64     `json:"totalSize,omitempty"`
}

// FileListResult is the response shape for list/search operations.
type FileListResult struct {
	Files  []ObjectInfo `json:"files"`
	Count  int          `json:"count"`
	Bucket string       `json:"bucket"`
}

// UploadResult is the response shape for upload operations.
type UploadResult struct {
	FilePath     string `json:"filePath"`
	OriginalName string `json:"originalName,omitempty"`
	FileName     string `json:"fileName,omitempty"`
	Size         int64  `json:"size"`
	ContentType  string `json:"contentType"`
	Bucket       string `json:"bucket"`
}

// FileMetadataResult is the response shape for the metadata endpoint.
type FileMetadataResult struct {
	FilePath     string            `json:"filePath"`
	Size         int64             `json:"size"`
	ContentType  string            `json:"contentType"`
	LastModified time.Time         `json:"lastModified"`
	ETag         string            `json:"etag"`
	Metadata     map[string]string `json:"metadata"`
	Bucket       string            `json:"bucket"`
}

// FolderResult is the response shape for folder rename/delete.
type FolderResult struct {
	OldPath      string `json:"oldPath,omitempty"`
	NewPath      string `json:"newPath,omitempty"`
	FolderPath   string `json:"folderPath,omitempty"`
	FilesRenamed int    `json:"filesRenamed,omitempty"`
	FilesDeleted int    `json:"filesDeleted,omitempty"`
}

// SearchParams holds search filter options.
type SearchParams struct {
	Query     string     `json:"query"`
	FileType  string     `json:"fileType"`
	DateRange *DateRange `json:"dateRange"`
}

// DateRange represents a time window for filtering.
type DateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// Service contains business logic for storage operations.
type Service struct {
	store *Store
	s3    *S3Client
}

// NewService creates a new storage Service.
func NewService(pool *pgxpool.Pool, minioCfg config.MinIOConfig) (*Service, error) {
	s3, err := NewS3Client(minioCfg)
	if err != nil {
		return nil, err
	}
	return &Service{
		store: NewStore(pool),
		s3:    s3,
	}, nil
}

// ValidateBucket ensures the bucket belongs to the project. Returns a
// user-facing error string if invalid, or empty string if OK.
func (s *Service) ValidateBucket(ctx context.Context, projectID int, bucketName string) (string, error) {
	if bucketName == "" {
		return "Bucket name is required", nil
	}
	ok, err := s.store.ValidateBucketForProject(ctx, projectID, bucketName)
	if err != nil {
		return "", err
	}
	if !ok {
		return "Bucket not found or does not belong to this project", nil
	}
	return "", nil
}

// ListBuckets returns all buckets for a project, optionally with file stats.
func (s *Service) ListBuckets(ctx context.Context, projectID int, includeStats bool) ([]BucketInfo, error) {
	buckets, err := s.store.ListProjectBuckets(ctx, projectID)
	if err != nil {
		return nil, err
	}

	result := make([]BucketInfo, 0, len(buckets))
	for _, b := range buckets {
		info := BucketInfo{
			ID:           b.ID,
			Name:         b.BucketName,
			Description:  b.Description,
			CreationDate: b.CreatedAt,
			UpdatedAt:    b.UpdatedAt,
		}

		if includeStats && b.BucketName != "" {
			objects, listErr := s.s3.ListObjects(ctx, b.BucketName, "", 1000)
			if listErr == nil {
				count := len(objects)
				var totalSize int64
				for _, obj := range objects {
					totalSize += obj.Size
				}
				info.FileCount = &count
				info.TotalSize = &totalSize
			} else {
				zero := 0
				var zeroSize int64
				info.FileCount = &zero
				info.TotalSize = &zeroSize
			}
		}

		result = append(result, info)
	}
	return result, nil
}

// ListFiles lists objects in a bucket with an optional prefix.
func (s *Service) ListFiles(ctx context.Context, bucket, prefix string, maxKeys int) (*FileListResult, error) {
	if maxKeys <= 0 {
		maxKeys = 1000
	}
	objects, err := s.s3.ListObjects(ctx, bucket, prefix, maxKeys)
	if err != nil {
		return nil, err
	}
	if objects == nil {
		objects = []ObjectInfo{}
	}
	return &FileListResult{
		Files:  objects,
		Count:  len(objects),
		Bucket: bucket,
	}, nil
}

// SearchFiles searches objects in a bucket by name query, file type, and date range.
func (s *Service) SearchFiles(ctx context.Context, bucket string, params SearchParams) (*FileListResult, error) {
	objects, err := s.s3.ListObjects(ctx, bucket, "", 1000)
	if err != nil {
		return nil, err
	}

	query := strings.ToLower(params.Query)
	var filtered []ObjectInfo

	for _, obj := range objects {
		if !strings.Contains(strings.ToLower(obj.Key), query) {
			continue
		}
		if params.FileType != "" && !strings.HasSuffix(obj.Key, params.FileType) {
			continue
		}
		if params.DateRange != nil && params.DateRange.Start != "" && params.DateRange.End != "" {
			start, errS := time.Parse(time.RFC3339, params.DateRange.Start)
			end, errE := time.Parse(time.RFC3339, params.DateRange.End)
			if errS == nil && errE == nil {
				if obj.LastModified.Before(start) || obj.LastModified.After(end) {
					continue
				}
			}
		}
		filtered = append(filtered, obj)
	}

	if filtered == nil {
		filtered = []ObjectInfo{}
	}
	return &FileListResult{
		Files:  filtered,
		Count:  len(filtered),
		Bucket: bucket,
	}, nil
}

// Upload uploads a file from a reader to MinIO.
func (s *Service) Upload(ctx context.Context, bucket, key string, reader io.Reader, size int64, contentType string, metadata map[string]string) error {
	return s.s3.PutObject(ctx, bucket, key, reader, size, contentType, metadata)
}

// DownloadURL generates a presigned download URL for a file.
func (s *Service) DownloadURL(ctx context.Context, bucket, key string) (*url.URL, error) {
	_, err := s.s3.StatObject(ctx, bucket, key)
	if err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}
	return s.s3.PresignedGetObject(ctx, bucket, key, presignExpiry)
}

// DeleteFile removes a single file from a bucket.
func (s *Service) DeleteFile(ctx context.Context, bucket, key string) error {
	return s.s3.RemoveObject(ctx, bucket, key)
}

// GetFileMetadata returns metadata for a single file.
func (s *Service) GetFileMetadata(ctx context.Context, bucket, key string) (*FileMetadataResult, error) {
	info, err := s.s3.StatObject(ctx, bucket, key)
	if err != nil {
		return nil, err
	}
	return &FileMetadataResult{
		FilePath:     key,
		Size:         info.Size,
		ContentType:  info.ContentType,
		LastModified: info.LastModified,
		ETag:         info.ETag,
		Metadata:     info.Metadata,
		Bucket:       bucket,
	}, nil
}

// RenameFolder copies all objects under oldPrefix to newPrefix then deletes the originals.
func (s *Service) RenameFolder(ctx context.Context, bucket, oldPath, newPath string) (*FolderResult, error) {
	oldPrefix := ensureTrailingSlash(oldPath)
	newPrefix := ensureTrailingSlash(newPath)

	objects, err := s.s3.ListObjects(ctx, bucket, oldPrefix, 0)
	if err != nil {
		return nil, err
	}
	if len(objects) == 0 {
		return nil, fmt.Errorf("folder not found or is empty")
	}

	for _, obj := range objects {
		newKey := strings.Replace(obj.Key, oldPrefix, newPrefix, 1)
		if err := s.s3.CopyObject(ctx, bucket, obj.Key, newKey); err != nil {
			return nil, fmt.Errorf("copy %s -> %s: %w", obj.Key, newKey, err)
		}
	}

	keys := make([]string, len(objects))
	for i, obj := range objects {
		keys[i] = obj.Key
	}
	if _, err := s.s3.RemoveObjects(ctx, bucket, keys); err != nil {
		return nil, fmt.Errorf("cleanup old objects: %w", err)
	}

	return &FolderResult{
		OldPath:      oldPath,
		NewPath:      newPath,
		FilesRenamed: len(objects),
	}, nil
}

// DeleteFolder removes all objects under the given prefix.
func (s *Service) DeleteFolder(ctx context.Context, bucket, folderPath string) (*FolderResult, error) {
	prefix := ensureTrailingSlash(folderPath)

	objects, err := s.s3.ListObjects(ctx, bucket, prefix, 0)
	if err != nil {
		return nil, err
	}
	if len(objects) == 0 {
		return nil, fmt.Errorf("folder not found or is empty")
	}

	keys := make([]string, len(objects))
	for i, obj := range objects {
		keys[i] = obj.Key
	}
	deleted, err := s.s3.RemoveObjects(ctx, bucket, keys)
	if err != nil {
		return nil, err
	}

	return &FolderResult{
		FolderPath:   folderPath,
		FilesDeleted: deleted,
	}, nil
}

func ensureTrailingSlash(s string) string {
	if !strings.HasSuffix(s, "/") {
		return s + "/"
	}
	return s
}
