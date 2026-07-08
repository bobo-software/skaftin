package backups

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/storage"
)

// ErrFullRestoreRequiresZip is returned when POST /api/backups/restore is called with a non-.zip key.
var ErrFullRestoreRequiresZip = errors.New("full restore requires a .zip backup; for .sql database backups use POST /api/backups/{projectId}/{filename}/restore")

// ErrImportEmpty / ErrImportBadType are returned by ImportBackup for invalid uploads.
var (
	ErrImportEmpty   = errors.New("file is empty")
	ErrImportBadType = errors.New("only .sql or .zip files are allowed")
)

// BackupMetadata is the API representation of a backup file.
type BackupMetadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ProjectID   int    `json:"projectId"`
	CreatedAt   string `json:"createdAt"`
	Size        int64  `json:"size"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

// fullBackupManifest is serialised into metadata.json inside a full-backup ZIP.
type fullBackupManifest struct {
	Version            string   `json:"version"`
	BackupName         string   `json:"backupName"`
	Description        string   `json:"description"`
	ProjectID          int      `json:"projectId"`
	ProjectName        string   `json:"projectName"`
	ProjectDescription string   `json:"projectDescription"`
	SchemaName         string   `json:"schemaName"`
	Timestamp          string   `json:"timestamp"`
	BackupType         string   `json:"backupType"`
	Files              []string `json:"files"`
}

// Service contains business logic for backup operations.
type Service struct {
	store         *Store
	pool          *pgxpool.Pool
	s3            *storage.S3Client
	bucket        string
	projectsStore *projects.Store
	scheduler     *Scheduler
}

// NewService creates a new backups Service.
func NewService(pool *pgxpool.Pool, s3 *storage.S3Client, bucket string, projectsStore *projects.Store) *Service {
	return &Service{
		store:         NewStore(pool),
		pool:          pool,
		s3:            s3,
		bucket:        bucket,
		projectsStore: projectsStore,
	}
}

func (s *Service) ensureBackupBucket(ctx context.Context) error {
	return s.s3.EnsureBucket(ctx, s.bucket)
}

// ---------------------------------------------------------------------------
// Database backup
// ---------------------------------------------------------------------------

func (s *Service) CreateBackup(ctx context.Context, projectID int, name, description, backupType string) (*BackupMetadata, error) {
	schema, err := s.store.GetProjectSchema(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	ts := time.Now().UTC().Format("2006-01-02T15-04-05")
	if name == "" {
		name = fmt.Sprintf("backup-%s", ts)
	}
	fileName := name + ".sql"
	key := fmt.Sprintf("backups/%d/%s", projectID, fileName)

	sqlContent, err := s.generateSQLDump(ctx, schema, true)
	if err != nil {
		return nil, fmt.Errorf("generate dump: %w", err)
	}

	reader := strings.NewReader(sqlContent)
	metadata := map[string]string{
		"projectId":  fmt.Sprintf("%d", projectID),
		"schemaName": schema,
		"backupName": name,
		"type":       backupType,
		"createdAt":  time.Now().UTC().Format(time.RFC3339),
	}
	if description != "" {
		metadata["description"] = description
	}

	if err := s.ensureBackupBucket(ctx); err != nil {
		return nil, fmt.Errorf("ensure backup bucket: %w", err)
	}
	if err := s.s3.PutObject(ctx, s.bucket, key, reader, int64(len(sqlContent)), "application/octet-stream", metadata); err != nil {
		return nil, fmt.Errorf("upload backup: %w", err)
	}

	slog.Info("backup created", "key", key, "projectId", projectID)

	return &BackupMetadata{
		ID:          key,
		Name:        name,
		ProjectID:   projectID,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		Size:        int64(len(sqlContent)),
		Type:        backupType,
		Description: description,
	}, nil
}

// ImportBackup stores an uploaded .sql or .zip from another environment into this deployment's
// object storage under backups/{projectId}/..., so it appears in the list and can be restored like any other backup.
func (s *Service) ImportBackup(ctx context.Context, projectID int, originalFilename string, data []byte) (*BackupMetadata, error) {
	if _, err := s.store.GetProjectSchema(ctx, projectID); err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	if len(data) == 0 {
		return nil, ErrImportEmpty
	}

	base := filepath.Base(originalFilename)
	ext := strings.ToLower(filepath.Ext(base))
	if ext != ".sql" && ext != ".zip" {
		return nil, ErrImportBadType
	}

	stem := sanitizeImportedBackupStem(strings.TrimSuffix(base, ext))
	ts := time.Now().UTC().Format("20060102-150405")
	fileName := fmt.Sprintf("%s-imported-%s%s", stem, ts, ext)
	key := fmt.Sprintf("backups/%d/%s", projectID, fileName)

	backupType := "database"
	contentType := "application/octet-stream"
	if ext == ".zip" {
		backupType = "full"
		contentType = "application/zip"
	}

	metadata := map[string]string{
		"projectId":  fmt.Sprintf("%d", projectID),
		"backupName": strings.TrimSuffix(fileName, ext),
		"type":       backupType,
		"createdAt":  time.Now().UTC().Format(time.RFC3339),
		"imported":   "true",
	}

	if err := s.ensureBackupBucket(ctx); err != nil {
		return nil, fmt.Errorf("ensure backup bucket: %w", err)
	}
	if err := s.s3.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)), contentType, metadata); err != nil {
		return nil, fmt.Errorf("upload imported backup: %w", err)
	}

	slog.Info("backup imported", "key", key, "projectId", projectID, "size", len(data))

	return &BackupMetadata{
		ID:        key,
		Name:      strings.TrimSuffix(fileName, ext),
		ProjectID: projectID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Size:      int64(len(data)),
		Type:      backupType,
	}, nil
}

func sanitizeImportedBackupStem(stem string) string {
	stem = strings.TrimSpace(stem)
	var b strings.Builder
	for _, r := range strings.ToLower(stem) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
			b.WriteRune(r)
		case r == ' ', r == '.':
			b.WriteRune('_')
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		return "backup"
	}
	if len(out) > 80 {
		out = out[:80]
	}
	return out
}

func (s *Service) ListBackups(ctx context.Context, projectID int) ([]BackupMetadata, error) {
	// Treat a missing bucket as "no backups yet" rather than a hard error.
	exists, err := s.s3.BucketExists(ctx, s.bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []BackupMetadata{}, nil
	}

	prefix := fmt.Sprintf("backups/%d/", projectID)
	objects, err := s.s3.ListObjects(ctx, s.bucket, prefix, 0)
	if err != nil {
		return nil, err
	}

	result := make([]BackupMetadata, 0, len(objects))
	for _, obj := range objects {
		fileName := obj.Key[strings.LastIndex(obj.Key, "/")+1:]
		bName := fileName
		bType := "database"
		if strings.HasSuffix(fileName, ".zip") {
			bName = strings.TrimSuffix(fileName, ".zip")
			bType = "full"
		} else if strings.HasSuffix(fileName, ".sql") {
			bName = strings.TrimSuffix(fileName, ".sql")
		}
		result = append(result, BackupMetadata{
			ID:        obj.Key,
			Name:      bName,
			ProjectID: projectID,
			CreatedAt: obj.LastModified.Format(time.RFC3339),
			Size:      obj.Size,
			Type:      bType,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt > result[j].CreatedAt
	})
	return result, nil
}

func (s *Service) DownloadBackup(ctx context.Context, projectID int, filename string) (io.ReadCloser, string, error) {
	key := fmt.Sprintf("backups/%d/%s", projectID, filename)
	rc, err := s.s3.GetObject(ctx, s.bucket, key)
	if err != nil {
		return nil, "", fmt.Errorf("backup not found: %w", err)
	}
	return rc, filename, nil
}

func (s *Service) RestoreBackup(ctx context.Context, projectID int, filename string, dropExisting bool) error {
	if strings.HasSuffix(strings.ToLower(filename), ".zip") {
		return s.restoreFullZipIntoProject(ctx, projectID, filename, dropExisting)
	}

	schema, err := s.store.GetProjectSchema(ctx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	key := fmt.Sprintf("backups/%d/%s", projectID, filename)
	rc, err := s.s3.GetObject(ctx, s.bucket, key)
	if err != nil {
		return fmt.Errorf("backup not found: %w", err)
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return fmt.Errorf("read backup: %w", err)
	}
	sqlContent := string(data)

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schema)); err != nil {
		return fmt.Errorf("set search_path: %w", err)
	}

	if dropExisting {
		rows, err := conn.Query(ctx, `
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, schema)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var t string
				rows.Scan(&t)
				conn.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"."%s" CASCADE`, schema, t))
			}
		}
	}

	statements := splitSQLStatements(sqlContent)
	conn.Exec(ctx, "BEGIN")
	for i, stmt := range statements {
		sp := fmt.Sprintf("sp_%d", i)
		conn.Exec(ctx, fmt.Sprintf("SAVEPOINT %s", sp))
		if err := execSQLStatement(ctx, conn, stmt); err != nil {
			conn.Exec(ctx, fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", sp))
			slog.Warn("restore statement failed", "stmt", i+1, "error", err)
		} else {
			conn.Exec(ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", sp))
		}
	}
	conn.Exec(ctx, "COMMIT")

	slog.Info("backup restored", "key", key, "projectId", projectID)
	return nil
}

func (s *Service) DeleteBackup(ctx context.Context, projectID int, filename string) error {
	key := fmt.Sprintf("backups/%d/%s", projectID, filename)
	if err := s.s3.RemoveObject(ctx, s.bucket, key); err != nil {
		return err
	}
	slog.Info("backup deleted", "key", key)
	return nil
}

// ---------------------------------------------------------------------------
// Full backup (ZIP)
// ---------------------------------------------------------------------------

func (s *Service) CreateFullBackup(ctx context.Context, projectID int, name, description string) (*BackupMetadata, error) {
	proj, err := s.store.GetProjectInfo(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	ts := time.Now().UTC().Format("2006-01-02T15-04-05")
	if name == "" {
		name = fmt.Sprintf("full-backup-%s", ts)
	}
	fileName := name + ".zip"
	key := fmt.Sprintf("backups/%d/%s", projectID, fileName)

	projectSQL, err := s.generateSQLDump(ctx, proj.SchemaName, false)
	if err != nil {
		return nil, fmt.Errorf("generate project dump: %w", err)
	}

	systemSQL, err := s.generateSystemSettingsDump(ctx, projectID, proj.SchemaName)
	if err != nil {
		return nil, fmt.Errorf("generate system settings dump: %w", err)
	}

	manifest := fullBackupManifest{
		Version:            "1.0.0",
		BackupName:         name,
		Description:        description,
		ProjectID:          projectID,
		ProjectName:        proj.Name,
		ProjectDescription: proj.Description,
		SchemaName:         proj.SchemaName,
		Timestamp:          time.Now().UTC().Format(time.RFC3339),
		BackupType:         "full",
		Files:              []string{"project_data.sql", "system_settings.sql", "metadata.json"},
	}
	metadataJSON, _ := json.MarshalIndent(manifest, "", "  ")

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, entry := range []struct {
		name string
		data []byte
	}{
		{"project_data.sql", []byte(projectSQL)},
		{"system_settings.sql", []byte(systemSQL)},
		{"metadata.json", metadataJSON},
	} {
		fw, err := zw.Create(entry.name)
		if err != nil {
			return nil, fmt.Errorf("zip create %s: %w", entry.name, err)
		}
		if _, err := fw.Write(entry.data); err != nil {
			return nil, fmt.Errorf("zip write %s: %w", entry.name, err)
		}
	}
	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("zip close: %w", err)
	}

	zipBytes := buf.Bytes()
	s3Meta := map[string]string{
		"projectId":   fmt.Sprintf("%d", projectID),
		"projectName": proj.Name,
		"backupName":  name,
		"type":        "full",
		"createdAt":   time.Now().UTC().Format(time.RFC3339),
	}
	if description != "" {
		s3Meta["description"] = description
	}

	if err := s.ensureBackupBucket(ctx); err != nil {
		return nil, fmt.Errorf("ensure backup bucket: %w", err)
	}
	if err := s.s3.PutObject(ctx, s.bucket, key, bytes.NewReader(zipBytes), int64(len(zipBytes)), "application/zip", s3Meta); err != nil {
		return nil, fmt.Errorf("upload full backup: %w", err)
	}

	slog.Info("full backup created", "key", key, "projectId", projectID)

	return &BackupMetadata{
		ID:          key,
		Name:        name,
		ProjectID:   projectID,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		Size:        int64(len(zipBytes)),
		Type:        "full",
		Description: description,
	}, nil
}

// quotedProjectSchemaRE matches quoted per-project schema names in backup SQL.
var quotedProjectSchemaRE = regexp.MustCompile(`"project_[a-z0-9_]+"`)

// remapFullBackupSQL rewrites schema and project_id references from the backup manifest
// (source project / schema) onto the restore target.
func remapFullBackupSQL(sql string, manifest fullBackupManifest, targetSchema string, targetProjectID int) string {
	targetQuoted := fmt.Sprintf(`"%s"`, targetSchema)
	sql = quotedProjectSchemaRE.ReplaceAllString(sql, targetQuoted)
	if manifest.ProjectID != targetProjectID {
		oldPID, newPID := manifest.ProjectID, targetProjectID
		sql = strings.ReplaceAll(sql, fmt.Sprintf("project_id = %d", oldPID), fmt.Sprintf("project_id = %d", newPID))
		sql = strings.ReplaceAll(sql, fmt.Sprintf("'%d'", oldPID), fmt.Sprintf("'%d'", newPID))
	}
	return sql
}

func truncateForLog(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

// execSQLStatement runs one restore statement, including constraint drop-before-add handling.
func execSQLStatement(ctx context.Context, q interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}, stmt string) error {
	stmt = prepareSQLStatement(stmt)
	if dropSQL, addSQL, ok := constraintDropBeforeAdd(stmt); ok {
		if _, err := q.Exec(ctx, dropSQL); err != nil {
			return err
		}
		stmt = addSQL
	}
	_, err := q.Exec(ctx, stmt)
	return err
}

// execSQLStatementsList runs prepared statements in order.
func execSQLStatementsList(ctx context.Context, tx pgx.Tx, statements []string, label string) error {
	if label == "" {
		label = "statement"
	}
	stmtNum := 0
	for _, st := range statements {
		st = strings.TrimSpace(st)
		if st == "" {
			continue
		}
		stmtNum++
		if err := execSQLStatement(ctx, tx, st); err != nil {
			return fmt.Errorf("%s %d: %w\n-- %s", label, stmtNum, err, truncateForLog(st, 500))
		}
	}
	return nil
}

// partitionSQLStatements splits dump SQL into data DDL/DML and deferred FK constraint statements.
func partitionSQLStatements(sqlContent string) (main, fkConstraints []string) {
	for _, st := range splitSQLStatements(sqlContent) {
		st = strings.TrimSpace(st)
		if st == "" {
			continue
		}
		if _, _, ok := constraintDropBeforeAdd(st); ok {
			fkConstraints = append(fkConstraints, st)
			continue
		}
		main = append(main, st)
	}
	return main, fkConstraints
}

// execFullBackupSQLInTx applies project_data.sql, then system_settings.sql, then deferred FK constraints.
// Full backups omit skaftin_system_* tables from project_data.sql but still emit FKs to them at the end.
func execFullBackupSQLInTx(ctx context.Context, tx pgx.Tx, projectSQL, systemSQL string) error {
	projectSQL = strings.TrimSpace(projectSQL)
	systemSQL = strings.TrimSpace(systemSQL)

	if projectSQL != "" {
		main, deferredFK := partitionSQLStatements(projectSQL)
		if err := execSQLStatementsList(ctx, tx, main, "statement"); err != nil {
			return fmt.Errorf("project_data.sql: %w", err)
		}
		if systemSQL != "" {
			if err := execSQLStatementsInTx(ctx, tx, systemSQL); err != nil {
				return fmt.Errorf("system_settings.sql: %w", err)
			}
		}
		if err := execSQLStatementsList(ctx, tx, deferredFK, "foreign key statement"); err != nil {
			return fmt.Errorf("project_data.sql (foreign keys): %w", err)
		}
		return nil
	}
	if systemSQL != "" {
		if err := execSQLStatementsInTx(ctx, tx, systemSQL); err != nil {
			return fmt.Errorf("system_settings.sql: %w", err)
		}
	}
	return nil
}

// execSQLStatementsInTx runs split statements against an open transaction (no BEGIN/COMMIT).
func execSQLStatementsInTx(ctx context.Context, tx pgx.Tx, sqlContent string) error {
	sqlContent = strings.TrimSpace(sqlContent)
	if sqlContent == "" {
		return nil
	}
	return execSQLStatementsList(ctx, tx, splitSQLStatements(sqlContent), "statement")
}

func (s *Service) readFullBackupZipFromObject(ctx context.Context, objectKey string) (map[string][]byte, fullBackupManifest, error) {
	if !strings.HasSuffix(strings.ToLower(objectKey), ".zip") {
		return nil, fullBackupManifest{}, fmt.Errorf("full backup object must be a .zip")
	}
	rc, err := s.s3.GetObject(ctx, s.bucket, objectKey)
	if err != nil {
		return nil, fullBackupManifest{}, fmt.Errorf("backup not found: %w", err)
	}
	defer rc.Close()

	zipData, err := io.ReadAll(rc)
	if err != nil {
		return nil, fullBackupManifest{}, fmt.Errorf("read backup: %w", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fullBackupManifest{}, fmt.Errorf("open zip: %w", err)
	}

	files := make(map[string][]byte)
	for _, f := range zr.File {
		fr, err := f.Open()
		if err != nil {
			return nil, fullBackupManifest{}, fmt.Errorf("open zip entry %s: %w", f.Name, err)
		}
		data, err := io.ReadAll(fr)
		fr.Close()
		if err != nil {
			return nil, fullBackupManifest{}, fmt.Errorf("read zip entry %s: %w", f.Name, err)
		}
		files[f.Name] = data
		// Allow nested zip paths (e.g. folder/project_data.sql) to resolve as project_data.sql
		if base := filepath.Base(f.Name); base != "" && base != "." && base != f.Name {
			if _, exists := files[base]; !exists {
				files[base] = data
			}
		}
	}

	var manifest fullBackupManifest
	if md, ok := files["metadata.json"]; ok {
		if err := json.Unmarshal(md, &manifest); err != nil {
			return nil, fullBackupManifest{}, fmt.Errorf("parse metadata: %w", err)
		}
	} else {
		return nil, fullBackupManifest{}, fmt.Errorf("metadata.json not found in backup")
	}
	return files, manifest, nil
}

// restoreFullZipIntoProject applies a full-backup .zip from this project's backup prefix onto the
// same project (schema + system rows remapped to the current project id).
func (s *Service) restoreFullZipIntoProject(ctx context.Context, projectID int, filename string, dropExisting bool) error {
	key := fmt.Sprintf("backups/%d/%s", projectID, filename)
	files, manifest, err := s.readFullBackupZipFromObject(ctx, key)
	if err != nil {
		return err
	}

	targetSchema, err := s.store.GetProjectSchema(ctx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if dropExisting {
		rows, err := conn.Query(ctx, `
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, targetSchema)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var t string
				rows.Scan(&t)
				conn.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"."%s" CASCADE`, targetSchema, t))
			}
		}
		if err := s.projectsStore.InitializeProjectAuthTables(ctx, targetSchema); err != nil {
			slog.Warn("init auth tables before restore", "error", err, "schema", targetSchema)
		}
	}

	projectSQL, ok := files["project_data.sql"]
	if !ok || len(projectSQL) == 0 {
		return fmt.Errorf("zip missing or empty project_data.sql (from metadata backup %q / schema %q)",
			manifest.BackupName, manifest.SchemaName)
	}
	sqlProject := remapFullBackupSQL(string(projectSQL), manifest, targetSchema, projectID)
	sqlSys := ""
	if systemSQL, ok := files["system_settings.sql"]; ok && len(systemSQL) > 0 {
		sqlSys = remapFullBackupSQL(string(systemSQL), manifest, targetSchema, projectID)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := execFullBackupSQLInTx(ctx, tx, sqlProject, sqlSys); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	slog.Info("project data restored into existing project", "projectId", projectID, "sourceSchema", manifest.SchemaName, "targetSchema", targetSchema)
	if sqlSys != "" {
		slog.Info("system settings restored into existing project", "projectId", projectID)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit full restore: %w", err)
	}
	slog.Info("full backup restored into project", "key", key, "projectId", projectID)
	return nil
}

func (s *Service) RestoreFullBackup(ctx context.Context, backupID, newProjectName string, organizationID int, userID string) (map[string]any, error) {
	if !strings.HasSuffix(strings.ToLower(backupID), ".zip") {
		return nil, ErrFullRestoreRequiresZip
	}

	files, manifest, err := s.readFullBackupZipFromObject(ctx, backupID)
	if err != nil {
		return nil, err
	}

	sanitized := strings.ToLower(newProjectName)
	sanitized = sanitizeSchemaName(sanitized)
	newSchema := fmt.Sprintf("project_%s_%d", sanitized, time.Now().UnixMilli())

	desc := fmt.Sprintf("Restored from backup: %s", manifest.ProjectName)
	newProject, err := s.projectsStore.CreateProject(ctx, newProjectName, desc, organizationID, userID, newSchema)
	if err != nil {
		return nil, fmt.Errorf("create project: %w", err)
	}

	if err := s.projectsStore.CreateSchema(ctx, newSchema); err != nil {
		slog.Error("failed to create schema", "error", err, "schema", newSchema)
	}
	if err := s.projectsStore.InitializeProjectAuthTables(ctx, newSchema); err != nil {
		slog.Error("failed to init auth tables", "error", err, "schema", newSchema)
	}
	if err := s.projectsStore.CreateDefaultAuthSettings(ctx, newProject.ID); err != nil {
		slog.Error("failed to create default auth settings", "error", err, "projectId", newProject.ID)
	}

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	sqlProject := ""
	if projectSQL, ok := files["project_data.sql"]; ok && len(projectSQL) > 0 {
		sqlProject = remapFullBackupSQL(string(projectSQL), manifest, newSchema, newProject.ID)
	}
	sqlSys := ""
	if systemSQL, ok := files["system_settings.sql"]; ok && len(systemSQL) > 0 {
		sqlSys = remapFullBackupSQL(string(systemSQL), manifest, newSchema, newProject.ID)
	}
	if err := execFullBackupSQLInTx(ctx, tx, sqlProject, sqlSys); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	if sqlProject != "" {
		slog.Info("project data restored")
	}
	if sqlSys != "" {
		slog.Info("system settings restored")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit full restore: %w", err)
	}

	return map[string]any{
		"projectId":   newProject.ID,
		"projectName": newProject.Name,
		"schemaName":  newSchema,
		"backupId":    backupID,
	}, nil
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

func (s *Service) CleanupOldBackups(ctx context.Context, projectID int, retentionPolicy string, retentionValue int) (map[string]any, error) {
	prefix := fmt.Sprintf("backups/%d/", projectID)
	objects, err := s.s3.ListObjects(ctx, s.bucket, prefix, 0)
	if err != nil {
		return nil, err
	}
	if len(objects) == 0 {
		return map[string]any{"deletedCount": 0, "totalBackups": 0, "remainingBackups": 0}, nil
	}

	sort.Slice(objects, func(i, j int) bool {
		return objects[i].LastModified.After(objects[j].LastModified)
	})

	var toDelete []string
	switch retentionPolicy {
	case "keep_count":
		if len(objects) > retentionValue {
			for _, obj := range objects[retentionValue:] {
				toDelete = append(toDelete, obj.Key)
			}
		}
	case "keep_days":
		cutoff := time.Now().UTC().AddDate(0, 0, -retentionValue)
		for _, obj := range objects {
			if obj.LastModified.Before(cutoff) {
				toDelete = append(toDelete, obj.Key)
			}
		}
	}

	deleted := 0
	for _, key := range toDelete {
		if err := s.s3.RemoveObject(ctx, s.bucket, key); err != nil {
			slog.Error("failed to delete old backup", "key", key, "error", err)
		} else {
			deleted++
			slog.Info("deleted old backup", "key", key)
		}
	}

	return map[string]any{
		"deletedCount":     deleted,
		"totalBackups":     len(objects),
		"remainingBackups": len(objects) - deleted,
	}, nil
}

// ---------------------------------------------------------------------------
// SQL dump generation (ported from dbproxy ExportDatabaseDump pattern)
// ---------------------------------------------------------------------------

// generateSQLDump produces a complete SQL dump of a project schema.
// If includeAllTables is true, system tables are included; if false, they are excluded.
func (s *Service) generateSQLDump(ctx context.Context, schemaName string, includeAllTables bool) (string, error) {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return "", fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schemaName)); err != nil {
		return "", fmt.Errorf("set search_path: %w", err)
	}

	var sql strings.Builder
	sql.WriteString(fmt.Sprintf("-- PostgreSQL database dump\n-- Schema: %s\n-- Dumped at: %s\n\n",
		schemaName, time.Now().UTC().Format(time.RFC3339)))
	sql.WriteString(fmt.Sprintf("SET search_path TO %s, public;\n\n", schemaName))

	tableQuery := `SELECT table_name FROM information_schema.tables
		WHERE table_schema = $1 AND table_type = 'BASE TABLE'`
	if !includeAllTables {
		tableQuery += ` AND table_name NOT LIKE 'skaftin_system_%'`
	}
	tableQuery += ` ORDER BY table_name`

	tableRows, err := conn.Query(ctx, tableQuery, schemaName)
	if err != nil {
		return "", fmt.Errorf("list tables: %w", err)
	}
	var tables []string
	for tableRows.Next() {
		var t string
		tableRows.Scan(&t)
		tables = append(tables, t)
	}
	tableRows.Close()

	if len(tables) == 0 {
		sql.WriteString(fmt.Sprintf("-- No tables found in schema %s\n", schemaName))
		return sql.String(), nil
	}

	type fkInfo struct {
		tableName, constraintName, column, foreignSchema, foreignTable, foreignColumn string
	}
	var foreignKeys []fkInfo

	for _, tableName := range tables {
		pkRows, _ := conn.Query(ctx, `
			SELECT kcu.column_name, kcu.ordinal_position
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
			ORDER BY kcu.ordinal_position`, schemaName, tableName)
		var pkCols []string
		if pkRows != nil {
			for pkRows.Next() {
				var col string
				var ordinal int
				pkRows.Scan(&col, &ordinal)
				pkCols = append(pkCols, col)
			}
			pkRows.Close()
		}

		colRows, err := conn.Query(ctx, `
			SELECT column_name, data_type, udt_name, character_maximum_length,
				numeric_precision, numeric_scale, is_nullable, column_default, ordinal_position
			FROM information_schema.columns
			WHERE table_schema = $1 AND table_name = $2
			ORDER BY ordinal_position`, schemaName, tableName)
		if err != nil {
			continue
		}

		type colInfo struct {
			name, dataType, udtName       string
			charMaxLen, numPrec, numScale *int32
			isNullable, colDefault        string
		}
		var cols []colInfo
		for colRows.Next() {
			var c colInfo
			var nullable, def *string
			colRows.Scan(&c.name, &c.dataType, &c.udtName, &c.charMaxLen, &c.numPrec, &c.numScale, &nullable, &def, new(int))
			if nullable != nil {
				c.isNullable = *nullable
			}
			if def != nil {
				c.colDefault = *def
			}
			cols = append(cols, c)
		}
		colRows.Close()
		if len(cols) == 0 {
			continue
		}

		sql.WriteString(fmt.Sprintf("\n-- Table: %s\n", tableName))
		sql.WriteString(fmt.Sprintf("CREATE TABLE IF NOT EXISTS \"%s\".\"%s\" (\n", schemaName, tableName))

		var colDefs []string
		for _, c := range cols {
			isSerial := strings.Contains(c.colDefault, "nextval(")
			def := fmt.Sprintf(`  "%s" `, c.name)
			if isSerial {
				switch c.dataType {
				case "bigint":
					def += "BIGSERIAL"
				case "smallint":
					def += "SMALLSERIAL"
				default:
					def += "SERIAL"
				}
			} else if c.dataType == "USER-DEFINED" {
				def += c.udtName
			} else if c.dataType == "ARRAY" {
				def += strings.ReplaceAll(c.udtName, "_", " ") + "[]"
			} else {
				def += c.dataType
				if c.charMaxLen != nil && (c.dataType == "character varying" || c.dataType == "character") {
					def += fmt.Sprintf("(%d)", *c.charMaxLen)
				} else if c.numPrec != nil && (c.dataType == "numeric" || c.dataType == "decimal") {
					if c.numScale != nil {
						def += fmt.Sprintf("(%d,%d)", *c.numPrec, *c.numScale)
					} else {
						def += fmt.Sprintf("(%d)", *c.numPrec)
					}
				}
			}
			if c.isNullable == "NO" {
				def += " NOT NULL"
			}
			if c.colDefault != "" && !isSerial {
				def += " DEFAULT " + c.colDefault
			}
			colDefs = append(colDefs, def)
		}

		if len(pkCols) > 0 {
			seen := make(map[string]bool)
			var unique []string
			for _, col := range pkCols {
				if !seen[col] {
					seen[col] = true
					unique = append(unique, fmt.Sprintf(`"%s"`, col))
				}
			}
			colDefs = append(colDefs, fmt.Sprintf("  PRIMARY KEY (%s)", strings.Join(unique, ", ")))
		}
		sql.WriteString(strings.Join(colDefs, ",\n") + "\n);\n\n")

		dataRows, err := conn.Query(ctx, fmt.Sprintf(`SELECT * FROM "%s"."%s"`, schemaName, tableName))
		if err == nil {
			descs := dataRows.FieldDescriptions()
			sql.WriteString(fmt.Sprintf("-- Data for table: %s\n", tableName))
			for dataRows.Next() {
				vals, _ := dataRows.Values()
				colNames := make([]string, len(descs))
				valStrs := make([]string, len(vals))
				for i, fd := range descs {
					colNames[i] = fmt.Sprintf(`"%s"`, fd.Name)
					valStrs[i] = pgLiteral(vals[i])
				}
				sql.WriteString(fmt.Sprintf("INSERT INTO \"%s\".\"%s\" (%s) VALUES (%s);\n",
					schemaName, tableName, strings.Join(colNames, ", "), strings.Join(valStrs, ", ")))
			}
			dataRows.Close()
			sql.WriteString("\n")
		}

		fkRows, _ := conn.Query(ctx, `
			SELECT tc.constraint_name, kcu.column_name,
				ccu.table_schema AS foreign_table_schema,
				ccu.table_name AS foreign_table_name,
				ccu.column_name AS foreign_column_name
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
				ON tc.constraint_name = kcu.constraint_name
			JOIN information_schema.constraint_column_usage AS ccu
				ON ccu.constraint_name = tc.constraint_name
			WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = $1 AND tc.table_name = $2`, schemaName, tableName)
		if fkRows != nil {
			for fkRows.Next() {
				var fk fkInfo
				fk.tableName = tableName
				fkRows.Scan(&fk.constraintName, &fk.column, &fk.foreignSchema, &fk.foreignTable, &fk.foreignColumn)
				foreignKeys = append(foreignKeys, fk)
			}
			fkRows.Close()
		}
	}

	if len(foreignKeys) > 0 {
		sql.WriteString("\n-- Foreign Key Constraints\n\n")
		seenFK := make(map[string]bool)
		for _, fk := range foreignKeys {
			fkKey := fk.tableName + "\x00" + fk.constraintName
			if seenFK[fkKey] {
				continue
			}
			seenFK[fkKey] = true
			foreignSchema := fk.foreignSchema
			if strings.HasPrefix(foreignSchema, "project_") && foreignSchema != schemaName {
				foreignSchema = schemaName
			}
			sql.WriteString(fmt.Sprintf("ALTER TABLE \"%s\".\"%s\" ADD CONSTRAINT \"%s\" FOREIGN KEY (\"%s\") REFERENCES \"%s\".\"%s\" (\"%s\");\n",
				schemaName, fk.tableName, fk.constraintName, fk.column, foreignSchema, fk.foreignTable, fk.foreignColumn))
		}
	}

	return sql.String(), nil
}

// generateSystemSettingsDump produces SQL for system settings tables.
func (s *Service) generateSystemSettingsDump(ctx context.Context, projectID int, schemaName string) (string, error) {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return "", fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	var sql strings.Builder
	sql.WriteString(fmt.Sprintf("-- System Settings Dump for Project ID: %d\n", projectID))
	sql.WriteString(fmt.Sprintf("-- Schema: %s\n", schemaName))
	sql.WriteString(fmt.Sprintf("-- Dumped at: %s\n\n", time.Now().UTC().Format(time.RFC3339)))

	type tableSpec struct {
		schema, table, pkColumn string
		filterByProject         bool
	}

	systemTables := []tableSpec{
		{schemaName, "skaftin_system_users", "id", false},
		{schemaName, "skaftin_system_roles", "id", false},
		{schemaName, "skaftin_system_user_roles", "id", false},
		{schemaName, "skaftin_system_user_custom_fields", "id", false},
		{schemaName, "skaftin_system_otp_verifications", "id", false},
		{"public", "skaftin_system_auth_settings", "id", true},
		{"public", "skaftin_system_email_providers", "id", true},
		{"public", "sms_providers", "id", true},
		{"public", "skaftin_system_email_templates", "id", true},
		{"public", "skaftin_system_sms_templates", "id", true},
		{"public", "skaftin_system_api_credentials", "id", true},
		{"public", "skaftin_system_expo_push_settings", "id", true},
		{schemaName, "skaftin_system_expo_notifications", "id", false},
	}

	for _, t := range systemTables {
		var exists bool
		conn.QueryRow(ctx, `SELECT EXISTS (
			SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2
		)`, t.schema, t.table).Scan(&exists)

		if !exists {
			sql.WriteString(fmt.Sprintf("-- Table %s.%s does not exist, skipping\n\n", t.schema, t.table))
			continue
		}

		query := fmt.Sprintf(`SELECT * FROM "%s"."%s"`, t.schema, t.table)
		var args []any
		if t.filterByProject {
			query += " WHERE project_id = $1"
			args = append(args, projectID)
		}
		query += fmt.Sprintf(" ORDER BY %s", t.pkColumn)

		dataRows, err := conn.Query(ctx, query, args...)
		if err != nil {
			sql.WriteString(fmt.Sprintf("-- Warning: Could not backup %s: %s\n\n", t.table, err))
			continue
		}

		descs := dataRows.FieldDescriptions()
		var rowCount int
		var insertBuf strings.Builder

		for dataRows.Next() {
			vals, _ := dataRows.Values()
			colNames := make([]string, len(descs))
			valStrs := make([]string, len(vals))
			for i, fd := range descs {
				colNames[i] = fmt.Sprintf(`"%s"`, fd.Name)
				valStrs[i] = pgLiteral(vals[i])
			}
			insertBuf.WriteString(fmt.Sprintf("INSERT INTO \"%s\".\"%s\" (%s) VALUES (%s);\n",
				t.schema, t.table, strings.Join(colNames, ", "), strings.Join(valStrs, ", ")))
			rowCount++
		}
		dataRows.Close()

		if rowCount > 0 {
			sql.WriteString(fmt.Sprintf("-- Data for %s.%s\n", t.schema, t.table))
			sql.WriteString(fmt.Sprintf("DELETE FROM \"%s\".\"%s\"", t.schema, t.table))
			if t.filterByProject {
				sql.WriteString(fmt.Sprintf(" WHERE project_id = %d", projectID))
			}
			sql.WriteString(";\n")
			sql.WriteString(insertBuf.String())
			sql.WriteString("\n")
		} else {
			sql.WriteString(fmt.Sprintf("-- No data in %s.%s\n\n", t.schema, t.table))
		}
	}

	return sql.String(), nil
}

// ---------------------------------------------------------------------------
// Helpers (ported from dbproxy/handler_import_export.go)
// ---------------------------------------------------------------------------

func splitSQLStatements(input string) []string {
	lines := strings.Split(input, "\n")
	var cleaned []string
	for _, line := range lines {
		inQ := false
		for i := 0; i < len(line)-1; i++ {
			if line[i] == '\'' {
				inQ = !inQ
			}
			if !inQ && line[i] == '-' && line[i+1] == '-' {
				line = line[:i]
				break
			}
		}
		cleaned = append(cleaned, line)
	}
	joined := strings.Join(cleaned, "\n")

	var stmts []string
	var current strings.Builder
	inQuote := false
	for _, ch := range joined {
		if ch == '\'' {
			inQuote = !inQuote
		}
		if ch == ';' && !inQuote {
			s := strings.TrimSpace(current.String())
			if s != "" {
				stmts = append(stmts, s)
			}
			current.Reset()
			continue
		}
		current.WriteRune(ch)
	}
	if s := strings.TrimSpace(current.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}

func pgLiteral(v any) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("'%s'", strings.ReplaceAll(val, "'", "''"))
	case bool:
		if val {
			return "TRUE"
		}
		return "FALSE"
	case time.Time:
		return fmt.Sprintf("'%s'", val.Format(time.RFC3339Nano))
	case map[string]any, []any:
		b, _ := json.Marshal(val)
		return fmt.Sprintf("'%s'::jsonb", strings.ReplaceAll(string(b), "'", "''"))
	case pgtype.Numeric:
		return pgNumericSQLLiteral(val)
	case *pgtype.Numeric:
		if val == nil {
			return "NULL"
		}
		return pgNumericSQLLiteral(*val)
	case pgtype.Time:
		return pgTimeSQLLiteral(val)
	case *pgtype.Time:
		if val == nil {
			return "NULL"
		}
		return pgTimeSQLLiteral(*val)
	default:
		// pgx often returns NUMERIC/DECIMAL as pgtype.Numeric; fmt %v is not valid SQL.
		if valuer, ok := v.(driver.Valuer); ok {
			if s, ok := pgValuerSQLLiteral(valuer); ok {
				return s
			}
		}
		return fmt.Sprintf("%v", val)
	}
}

func pgTimeSQLLiteral(t pgtype.Time) string {
	if !t.Valid {
		return "NULL"
	}
	dv, err := t.Value()
	if err != nil || dv == nil {
		return "NULL"
	}
	s, ok := dv.(string)
	if !ok || s == "" {
		return "NULL"
	}
	return fmt.Sprintf("'%s'", s)
}

func pgNumericSQLLiteral(n pgtype.Numeric) string {
	if !n.Valid {
		return "NULL"
	}
	if n.NaN {
		return "'NaN'::numeric"
	}
	switch n.InfinityModifier {
	case pgtype.Infinity:
		return "'Infinity'::numeric"
	case pgtype.NegativeInfinity:
		return "'-Infinity'::numeric"
	}
	dv, err := n.Value()
	if err != nil || dv == nil {
		return "NULL"
	}
	s, ok := dv.(string)
	if !ok || s == "" {
		return "0"
	}
	return s
}

// pgValuerSQLLiteral handles pgtype values returned as any without a static type switch.
func pgValuerSQLLiteral(v driver.Valuer) (string, bool) {
	dv, err := v.Value()
	if err != nil {
		return "NULL", true
	}
	if dv == nil {
		return "NULL", true
	}
	s, ok := dv.(string)
	if !ok {
		return "", false
	}
	if s == "NaN" {
		return "'NaN'::numeric", true
	}
	if isPlainNumericLiteral(s) {
		return s, true
	}
	return fmt.Sprintf("'%s'", strings.ReplaceAll(s, "'", "''")), true
}

func isPlainNumericLiteral(s string) bool {
	if s == "" {
		return false
	}
	i := 0
	if s[i] == '-' || s[i] == '+' {
		i++
	}
	if i >= len(s) {
		return false
	}
	hasDigit := false
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		hasDigit = true
		i++
	}
	if i < len(s) && s[i] == '.' {
		i++
		for i < len(s) && s[i] >= '0' && s[i] <= '9' {
			hasDigit = true
			i++
		}
	}
	if i < len(s) && (s[i] == 'e' || s[i] == 'E') {
		i++
		if i < len(s) && (s[i] == '+' || s[i] == '-') {
			i++
		}
		for i < len(s) && s[i] >= '0' && s[i] <= '9' {
			i++
		}
	}
	return hasDigit && i == len(s)
}

var bareTimeLiteralRE = regexp.MustCompile(`^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?$`)

// quoteBareTimeLiterals wraps unquoted HH:MM:SS[.fraction] tokens for legacy backup dumps.
func quoteBareTimeLiterals(sql string) string {
	var out strings.Builder
	inQuote := false
	for i := 0; i < len(sql); i++ {
		c := sql[i]
		if c == '\'' {
			inQuote = !inQuote
			out.WriteByte(c)
			continue
		}
		if !inQuote && c >= '0' && c <= '9' {
			j := i
			for j < len(sql) && sql[j] != '\'' && sql[j] != ',' && sql[j] != ')' && sql[j] != ';' {
				j++
			}
			token := strings.TrimSpace(sql[i:j])
			if bareTimeLiteralRE.MatchString(token) {
				out.WriteByte('\'')
				out.WriteString(token)
				out.WriteByte('\'')
				i = j - 1
				continue
			}
		}
		out.WriteByte(c)
	}
	return out.String()
}

func prepareSQLStatement(stmt string) string {
	return quoteBareTimeLiterals(stmt)
}

// constraintDropBeforeAdd returns DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT for idempotent restore.
func constraintDropBeforeAdd(stmt string) (dropSQL, addSQL string, ok bool) {
	trimmed := strings.TrimSpace(stmt)
	trimmed = strings.TrimSuffix(trimmed, ";")
	upper := strings.ToUpper(trimmed)
	addIdx := strings.Index(upper, " ADD CONSTRAINT ")
	if !strings.HasPrefix(upper, "ALTER TABLE") || addIdx < 0 {
		return "", "", false
	}
	tablePart := strings.TrimSpace(trimmed[:addIdx])
	constraintName, _ := readDoubleQuotedSQL(strings.TrimSpace(trimmed[addIdx+len(" ADD CONSTRAINT "):]))
	if tablePart == "" || constraintName == "" {
		return "", "", false
	}
	return fmt.Sprintf(`%s DROP CONSTRAINT IF EXISTS "%s"`, tablePart, constraintName), trimmed, true
}

func readDoubleQuotedSQL(s string) (name, remainder string) {
	s = strings.TrimSpace(s)
	if s == "" || s[0] != '"' {
		return "", s
	}
	var b strings.Builder
	for i := 1; i < len(s); i++ {
		if s[i] == '"' {
			if i+1 < len(s) && s[i+1] == '"' {
				b.WriteByte('"')
				i++
				continue
			}
			return b.String(), strings.TrimSpace(s[i+1:])
		}
		b.WriteByte(s[i])
	}
	return "", s
}

func sanitizeSchemaName(name string) string {
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}
