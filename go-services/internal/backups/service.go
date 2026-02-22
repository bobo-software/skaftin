package backups

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/storage"
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

func (s *Service) ListBackups(ctx context.Context, projectID int) ([]BackupMetadata, error) {
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
		if _, err := conn.Exec(ctx, stmt); err != nil {
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

func (s *Service) RestoreFullBackup(ctx context.Context, backupID, newProjectName string, organizationID int, userID string) (map[string]any, error) {
	rc, err := s.s3.GetObject(ctx, s.bucket, backupID)
	if err != nil {
		return nil, fmt.Errorf("backup not found: %w", err)
	}
	defer rc.Close()

	zipData, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("read backup: %w", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	files := make(map[string][]byte)
	for _, f := range zr.File {
		fr, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("open zip entry %s: %w", f.Name, err)
		}
		data, err := io.ReadAll(fr)
		fr.Close()
		if err != nil {
			return nil, fmt.Errorf("read zip entry %s: %w", f.Name, err)
		}
		files[f.Name] = data
	}

	var manifest fullBackupManifest
	if md, ok := files["metadata.json"]; ok {
		if err := json.Unmarshal(md, &manifest); err != nil {
			return nil, fmt.Errorf("parse metadata: %w", err)
		}
	} else {
		return nil, fmt.Errorf("metadata.json not found in backup")
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

	if projectSQL, ok := files["project_data.sql"]; ok && len(projectSQL) > 0 {
		sql := string(projectSQL)
		sql = strings.ReplaceAll(sql, manifest.SchemaName, newSchema)
		if _, err := conn.Exec(ctx, sql); err != nil {
			slog.Warn("project data restore had errors", "error", err)
		}
		slog.Info("project data restored")
	}

	if systemSQL, ok := files["system_settings.sql"]; ok && len(systemSQL) > 0 {
		sql := string(systemSQL)
		sql = strings.ReplaceAll(sql, fmt.Sprintf("project_id = %d", manifest.ProjectID), fmt.Sprintf("project_id = %d", newProject.ID))
		sql = strings.ReplaceAll(sql, fmt.Sprintf("'%d'", manifest.ProjectID), fmt.Sprintf("'%d'", newProject.ID))
		sql = strings.ReplaceAll(sql, manifest.SchemaName, newSchema)
		if _, err := conn.Exec(ctx, sql); err != nil {
			slog.Warn("system settings restore had errors", "error", err)
		}
		slog.Info("system settings restored")
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
		for _, fk := range foreignKeys {
			sql.WriteString(fmt.Sprintf("ALTER TABLE \"%s\".\"%s\" ADD CONSTRAINT \"%s\" FOREIGN KEY (\"%s\") REFERENCES \"%s\".\"%s\" (\"%s\");\n",
				schemaName, fk.tableName, fk.constraintName, fk.column, fk.foreignSchema, fk.foreignTable, fk.foreignColumn))
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
	default:
		return fmt.Sprintf("%v", val)
	}
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
