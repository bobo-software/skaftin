package projects

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/config"
)

// Service contains business logic for project operations.
type Service struct {
	store *Store
	s3    *S3Client
}

// NewService creates a new projects Service.
func NewService(pool *pgxpool.Pool, cfg config.MinIOConfig) (*Service, error) {
	s3, err := NewS3Client(cfg)
	if err != nil {
		return nil, err
	}
	return &Service{
		store: NewStore(pool),
		s3:    s3,
	}, nil
}

// --- Project access ---

func (svc *Service) CheckProjectAccess(ctx context.Context, projectID int, userID string) (*AccessResult, error) {
	return svc.store.CheckProjectAccess(ctx, projectID, userID)
}

func (svc *Service) CheckProjectAccessIncludingDeleted(ctx context.Context, projectID int, userID string) (*AccessResult, error) {
	return svc.store.CheckProjectAccessIncludingDeleted(ctx, projectID, userID)
}

// --- Project CRUD ---

func (svc *Service) ListUserProjects(ctx context.Context, userID string) ([]Project, error) {
	return svc.store.ListUserProjects(ctx, userID)
}

func (svc *Service) GetProject(ctx context.Context, id int) (*Project, error) {
	return svc.store.GetProjectByID(ctx, id)
}

func (svc *Service) GetProjectIncludingDeleted(ctx context.Context, id int) (*Project, error) {
	return svc.store.GetProjectByIDIncludingDeleted(ctx, id)
}

func (svc *Service) CreateProject(ctx context.Context, name, description string, orgID int, userID string) (*Project, error) {
	role, err := svc.store.GetUserOrgMembership(ctx, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("not a member of this organization")
	}
	if role != "owner" && role != "admin" && role != "dev" {
		return nil, fmt.Errorf("you do not have permission to create projects in this organization")
	}

	sanitized := regexp.MustCompile(`[^a-z0-9]`).ReplaceAllString(strings.ToLower(name), "_")
	schemaName := fmt.Sprintf("project_%s_%d", sanitized, time.Now().UnixMilli())

	project, err := svc.store.CreateProject(ctx, strings.TrimSpace(name), strings.TrimSpace(description), orgID, userID, schemaName)
	if err != nil {
		return nil, err
	}

	if err := svc.store.CreateSchema(ctx, schemaName); err != nil {
		slog.Error("failed to create schema", "error", err, "schema", schemaName)
	}

	if err := svc.store.InitializeProjectAuthTables(ctx, schemaName); err != nil {
		slog.Error("failed to init auth tables", "error", err, "schema", schemaName)
	}

	if err := svc.store.CreateDefaultAuthSettings(ctx, project.ID); err != nil {
		slog.Error("failed to create default auth settings", "error", err, "projectId", project.ID)
	}

	return project, nil
}

func (svc *Service) UpdateProject(ctx context.Context, id int, name, description *string, fieldEncryptionKey *string, clearEncKey bool) (*Project, error) {
	return svc.store.UpdateProject(ctx, id, name, description, fieldEncryptionKey, clearEncKey)
}

func (svc *Service) DeleteProject(ctx context.Context, id int) (*Project, error) {
	scheduledAt := time.Now().Add(48 * time.Hour)
	return svc.store.ScheduleProjectDeletion(ctx, id, scheduledAt)
}

func (svc *Service) RestoreProject(ctx context.Context, id int) (*Project, error) {
	return svc.store.RestoreProject(ctx, id)
}

func (svc *Service) ListDeletedProjects(ctx context.Context, userID string) ([]Project, error) {
	return svc.store.ListDeletedProjectsForUser(ctx, userID)
}

// --- Project stats ---

// DashboardStats holds aggregated stats across all user projects.
type DashboardStats struct {
	TotalProjects int `json:"totalProjects"`
	TotalTables   int `json:"totalTables"`
	TotalFiles    int `json:"totalFiles"`
	TotalAPICalls int `json:"totalApiCalls"`
}

func (svc *Service) GetDashboardStats(ctx context.Context, userID string) (*DashboardStats, error) {
	projects, err := svc.store.ListAllUserProjects(ctx, userID)
	if err != nil {
		return nil, err
	}

	stats := &DashboardStats{TotalProjects: len(projects)}
	for _, p := range projects {
		tc, err := svc.store.GetTableCount(ctx, p.SchemaName, true)
		if err == nil {
			stats.TotalTables += tc
		}

		bucketNames, err := svc.store.ListBucketNames(ctx, p.ID)
		if err == nil {
			for _, bn := range bucketNames {
				count, _ := svc.s3.CountObjects(ctx, bn)
				stats.TotalFiles += count
			}
		}

		apiCount, err := svc.store.GetAPICallCount(ctx, p.ID)
		if err == nil {
			stats.TotalAPICalls += apiCount
		}
	}
	return stats, nil
}

// ProjectStats holds stats for a single project.
type ProjectStats struct {
	ProjectID   int       `json:"projectId"`
	ProjectName string    `json:"projectName"`
	TableCount  int       `json:"tableCount"`
	FileCount   int       `json:"fileCount"`
	APICalls    int       `json:"apiCalls"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (svc *Service) GetProjectStats(ctx context.Context, project *Project) (*ProjectStats, error) {
	stats := &ProjectStats{
		ProjectID:   project.ID,
		ProjectName: project.Name,
		CreatedAt:   project.CreatedAt,
	}

	tc, err := svc.store.GetTableCount(ctx, project.SchemaName, false)
	if err == nil {
		stats.TableCount = tc
	}

	bucketNames, err := svc.store.ListBucketNames(ctx, project.ID)
	if err == nil {
		for _, bn := range bucketNames {
			count, _ := svc.s3.CountObjects(ctx, bn)
			stats.FileCount += count
		}
	}

	apiCount, err := svc.store.GetAPICallCount(ctx, project.ID)
	if err == nil {
		stats.APICalls = apiCount
	}

	return stats, nil
}

// --- Project reset ---

// ResetResult summarises what happened during a project reset.
type ResetResult struct {
	DroppedTables int      `json:"droppedTables"`
	DeletedFiles  int      `json:"deletedFiles"`
	ErrorCount    int      `json:"errorCount"`
	Errors        []string `json:"errors"`
}

func (svc *Service) ResetProject(ctx context.Context, project *Project) (*ResetResult, error) {
	result := &ResetResult{}

	// Drop all tables in the schema
	tables, err := svc.store.ListTableNamesInSchema(ctx, project.SchemaName)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Database reset error: %s", err))
	} else {
		for _, t := range tables {
			if err := svc.store.DropTable(ctx, project.SchemaName, t); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to drop table %s: %s", t, err))
			} else {
				result.DroppedTables++
			}
		}
	}

	// Clear all objects in all project buckets
	bucketNames, err := svc.store.ListBucketNames(ctx, project.ID)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Storage reset error: %s", err))
	} else {
		for _, bn := range bucketNames {
			deleted, err := svc.s3.RemoveAllObjects(ctx, bn)
			result.DeletedFiles += deleted
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Storage reset error for bucket %s: %s", bn, err))
			}
		}
	}

	result.ErrorCount = len(result.Errors)
	if len(result.Errors) > 10 {
		result.Errors = result.Errors[:10]
	}
	return result, nil
}

// --- Bucket operations ---

func (svc *Service) ListBuckets(ctx context.Context, projectID int) ([]map[string]any, error) {
	buckets, err := svc.store.ListBuckets(ctx, projectID)
	if err != nil {
		return nil, err
	}

	out := make([]map[string]any, 0, len(buckets))
	for _, b := range buckets {
		fc, ts := svc.s3.GetBucketSummary(ctx, b.BucketName)
		out = append(out, map[string]any{
			"id":            b.ID,
			"project_id":    b.ProjectID,
			"bucket_name":   b.BucketName,
			"description":   b.Description,
			"access_policy": b.AccessPolicy,
			"created_at":    b.CreatedAt,
			"updated_at":    b.UpdatedAt,
			"fileCount":     fc,
			"totalSize":     ts,
		})
	}
	return out, nil
}

func (svc *Service) GetBucket(ctx context.Context, projectID, bucketID int) (*Bucket, error) {
	return svc.store.GetBucket(ctx, projectID, bucketID)
}

func (svc *Service) GetBucketWithStats(ctx context.Context, projectID, bucketID int) (map[string]any, error) {
	b, err := svc.store.GetBucket(ctx, projectID, bucketID)
	if err != nil {
		return nil, err
	}

	fc, ts := svc.s3.GetBucketSummary(ctx, b.BucketName)
	actualPolicy := svc.s3.GetBucketPolicy(ctx, b.BucketName)

	return map[string]any{
		"id":            b.ID,
		"project_id":    b.ProjectID,
		"bucket_name":   b.BucketName,
		"description":   b.Description,
		"access_policy": b.AccessPolicy,
		"created_at":    b.CreatedAt,
		"updated_at":    b.UpdatedAt,
		"stats":         map[string]any{"fileCount": fc, "totalSize": ts},
		"actualPolicy":  actualPolicy,
	}, nil
}

func (svc *Service) CreateBucket(ctx context.Context, projectID int, bucketName string, description *string, accessPolicy string) (*Bucket, error) {
	exists, err := svc.store.BucketNameExists(ctx, bucketName)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("bucket name already exists")
	}

	if err := svc.s3.EnsureBucket(ctx, bucketName); err != nil {
		return nil, fmt.Errorf("failed to create bucket in storage: %w", err)
	}

	if err := svc.s3.SetBucketPolicy(ctx, bucketName, accessPolicy); err != nil {
		slog.Warn("could not set access policy", "bucket", bucketName, "error", err)
	}

	return svc.store.CreateBucket(ctx, projectID, bucketName, description, accessPolicy)
}

func (svc *Service) UpdateBucket(ctx context.Context, projectID, bucketID int, bucketName, description, accessPolicy *string, currentBucketName string) (*Bucket, error) {
	if accessPolicy != nil {
		if err := svc.s3.SetBucketPolicy(ctx, currentBucketName, *accessPolicy); err != nil {
			slog.Warn("could not update access policy", "bucket", currentBucketName, "error", err)
		}
	}
	return svc.store.UpdateBucket(ctx, projectID, bucketID, bucketName, description, accessPolicy)
}

func (svc *Service) DeleteBucket(ctx context.Context, projectID, bucketID int, bucketName string, force bool) error {
	hasObjects, err := svc.s3.BucketHasObjects(ctx, bucketName)
	if err != nil {
		slog.Warn("error checking bucket contents", "bucket", bucketName, "error", err)
	} else if hasObjects && !force {
		return fmt.Errorf("bucket is not empty. Use force=true to delete all files")
	}

	if force {
		if _, err := svc.s3.RemoveAllObjects(ctx, bucketName); err != nil {
			slog.Warn("error deleting bucket objects", "bucket", bucketName, "error", err)
		}
	}

	return svc.store.DeleteBucket(ctx, projectID, bucketID)
}

func (svc *Service) GetBucketDetailedStats(ctx context.Context, bucketName string) BucketObjectStats {
	return svc.s3.GetBucketStats(ctx, bucketName)
}

func (svc *Service) GetBucketPolicyInfo(ctx context.Context, projectID, bucketID int) (map[string]any, error) {
	b, err := svc.store.GetBucket(ctx, projectID, bucketID)
	if err != nil {
		return nil, err
	}
	actualPolicy := svc.s3.GetBucketPolicy(ctx, b.BucketName)
	return map[string]any{
		"bucketId":     bucketID,
		"bucketName":   b.BucketName,
		"storedPolicy": b.AccessPolicy,
		"actualPolicy": actualPolicy,
	}, nil
}

func (svc *Service) SetBucketPolicy(ctx context.Context, projectID, bucketID int, policy string) (*Bucket, error) {
	b, err := svc.store.GetBucket(ctx, projectID, bucketID)
	if err != nil {
		return nil, err
	}
	if err := svc.s3.SetBucketPolicy(ctx, b.BucketName, policy); err != nil {
		return nil, fmt.Errorf("failed to set bucket policy: %w", err)
	}
	return svc.store.UpdateBucketPolicy(ctx, projectID, bucketID, policy)
}

func (svc *Service) BucketNameExists(ctx context.Context, name string) (bool, error) {
	return svc.store.BucketNameExists(ctx, name)
}
