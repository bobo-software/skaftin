package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerStorageTools(srv toolRegistrar, pool *pgxpool.Pool) {
	reg := &storageTools{pool: pool}

	srv.AddTool(makeTool("list_project_buckets", "List all buckets for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.listProjectBuckets)

	srv.AddTool(makeTool("list_buckets", "List available MinIO buckets (deprecated - use list_project_buckets)", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.listProjectBuckets)

	srv.AddTool(makeTool("create_project_bucket", "Create a new bucket for a project", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"bucketName":  {Type: "string", Desc: "Name of the bucket to create"},
		"description": {Type: "string", Desc: "Optional bucket description"},
	}, []string{"projectId", "bucketName"}), reg.createProjectBucket)

	srv.AddTool(makeTool("create_bucket", "Create new MinIO bucket (deprecated - use create_project_bucket)", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"bucketName": {Type: "string", Desc: "Name of the bucket to create"},
	}, []string{"projectId", "bucketName"}), reg.createProjectBucket)

	srv.AddTool(makeTool("delete_bucket", "Delete a MinIO bucket", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"bucketName": {Type: "string", Desc: "Name of the bucket to delete"},
		"force":      {Type: "boolean", Desc: "Force deletion even if bucket contains files (default: false)"},
	}, []string{"projectId", "bucketName"}), reg.deleteBucket)

	srv.AddTool(makeTool("list_files", "List files in a bucket", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"bucketName": {Type: "string", Desc: "Bucket name"},
		"prefix":     {Type: "string", Desc: "Prefix to filter files"},
		"maxKeys":    {Type: "number", Desc: "Maximum number of files to return (default: 1000)"},
	}, []string{"projectId", "bucketName"}), reg.listFiles)

	srv.AddTool(makeTool("search_bucket", "Search files in MinIO buckets", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"bucketName": {Type: "string", Desc: "Bucket name"},
		"query":      {Type: "string", Desc: "Search query string"},
		"fileType":   {Type: "string", Desc: "Filter by file extension (e.g. .txt, .json)"},
	}, []string{"projectId", "bucketName", "query"}), reg.searchBucket)

	srv.AddTool(makeTool("upload_file", "Upload files to MinIO", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"bucketName":  {Type: "string", Desc: "Bucket name"},
		"filePath":    {Type: "string", Desc: "Path where the file should be stored"},
		"fileContent": {Type: "string", Desc: "Base64 encoded file content"},
		"contentType": {Type: "string", Desc: "MIME type of the file"},
	}, []string{"projectId", "bucketName", "filePath", "fileContent"}), reg.uploadFile)

	srv.AddTool(makeTool("download_file", "Download files from MinIO", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"bucketName": {Type: "string", Desc: "Bucket name"},
		"filePath":   {Type: "string", Desc: "Path to the file to download"},
	}, []string{"projectId", "bucketName", "filePath"}), reg.downloadFile)

	srv.AddTool(makeTool("set_bucket_public_policy", "Set public read policy on a MinIO bucket", map[string]prop{
		"bucketName": {Type: "string", Desc: "Name of the bucket to make public"},
	}, []string{"bucketName"}), reg.setBucketPublicPolicy)
}

type storageTools struct {
	pool *pgxpool.Pool
}

func (s *storageTools) listProjectBuckets(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}

	rows, err := s.pool.Query(ctx, `SELECT id, bucket_name, description, access_policy, created_at, updated_at FROM skaftin_system_project_buckets WHERE project_id = $1 ORDER BY created_at`, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list buckets: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (s *storageTools) createProjectBucket(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	bucketName := getString(args, "bucketName")
	if bucketName == "" {
		return errorResult("bucketName is required")
	}

	description := getString(args, "description")
	var descPtr *string
	if description != "" {
		descPtr = &description
	}

	row := s.pool.QueryRow(ctx, `INSERT INTO skaftin_system_project_buckets (project_id, bucket_name, description) VALUES ($1, $2, $3) RETURNING id, bucket_name, description, created_at`, pid, bucketName, descPtr)
	var id int
	var name string
	var desc *string
	var createdAt interface{}
	if err := row.Scan(&id, &name, &desc, &createdAt); err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			return errorResult("Bucket name already exists")
		}
		return errorResult(fmt.Sprintf("Failed to create bucket: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": "Bucket created (note: MinIO bucket must be created separately via the API)", "id": id, "bucket_name": name, "description": desc})
}

func (s *storageTools) deleteBucket(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	bucketName := getString(args, "bucketName")
	if bucketName == "" {
		return errorResult("bucketName is required")
	}

	tag, err := s.pool.Exec(ctx, `DELETE FROM skaftin_system_project_buckets WHERE project_id = $1 AND bucket_name = $2`, pid, bucketName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to delete bucket: %v", err))
	}
	if tag.RowsAffected() == 0 {
		return errorResult("Bucket not found")
	}
	return textResult(map[string]any{"success": true, "message": "Bucket record deleted (note: MinIO bucket must be removed separately)"})
}

func (s *storageTools) listFiles(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "File listing requires S3/MinIO client. Use the HTTP API at /api/storage/:projectId/buckets/:bucketName/files"})
}

func (s *storageTools) searchBucket(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "File search requires S3/MinIO client. Use the HTTP API at /api/storage/:projectId/buckets/:bucketName/search"})
}

func (s *storageTools) uploadFile(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "File upload requires S3/MinIO client. Use the HTTP API at /api/storage/:projectId/upload"})
}

func (s *storageTools) downloadFile(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "File download requires S3/MinIO client. Use the HTTP API at /api/storage/:projectId/download"})
}

func (s *storageTools) setBucketPublicPolicy(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Setting bucket policy requires S3/MinIO client. Use the HTTP API at /api/storage/buckets/:bucketName/policy"})
}
