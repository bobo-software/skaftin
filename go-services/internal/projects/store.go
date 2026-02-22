package projects

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles database queries for project and bucket management.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new projects Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Project represents a row from skaftin_system_projects.
type Project struct {
	ID                  int        `json:"id"`
	Name                string     `json:"name"`
	Description         *string    `json:"description"`
	OrganizationID      *int       `json:"organization_id"`
	UserID              string     `json:"user_id"`
	SchemaName          string     `json:"schema_name"`
	FieldEncryptionKey  *string    `json:"-"`
	FieldEncryptionSet  bool       `json:"field_encryption_key_set"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           *time.Time `json:"updated_at"`
}

// AccessResult holds the result of a project access check.
type AccessResult struct {
	HasAccess bool
	Role      string
}

// Bucket represents a row from skaftin_system_project_buckets.
type Bucket struct {
	ID           int        `json:"id"`
	ProjectID    int        `json:"project_id"`
	BucketName   string     `json:"bucket_name"`
	Description  *string    `json:"description"`
	AccessPolicy *string    `json:"access_policy"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    *time.Time `json:"updated_at"`
}

// scanProject scans a project row, stripping the encryption key and setting
// the FieldEncryptionSet boolean.
func scanProject(row pgx.Row) (*Project, error) {
	var p Project
	var encKey *string
	err := row.Scan(
		&p.ID, &p.Name, &p.Description, &p.OrganizationID,
		&p.UserID, &p.SchemaName, &encKey,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.FieldEncryptionSet = encKey != nil && *encKey != ""
	return &p, nil
}

func scanProjectRows(rows pgx.Rows) ([]Project, error) {
	out := make([]Project, 0)
	for rows.Next() {
		var p Project
		var encKey *string
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.OrganizationID,
			&p.UserID, &p.SchemaName, &encKey,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		p.FieldEncryptionSet = encKey != nil && *encKey != ""
		out = append(out, p)
	}
	return out, rows.Err()
}

const projectColumns = `id, name, description, organization_id, user_id, schema_name, field_encryption_key, created_at, updated_at`
const qualifiedProjectColumns = `p.id, p.name, p.description, p.organization_id, p.user_id, p.schema_name, p.field_encryption_key, p.created_at, p.updated_at`

// GetProjectByID fetches a single project.
func (s *Store) GetProjectByID(ctx context.Context, id int) (*Project, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+projectColumns+` FROM skaftin_system_projects WHERE id = $1`, id)
	return scanProject(row)
}

// CheckProjectAccess checks if a user has access to a project through org membership.
func (s *Store) CheckProjectAccess(ctx context.Context, projectID int, userID string) (*AccessResult, error) {
	var orgID *int
	var ownerUserID string
	err := s.pool.QueryRow(ctx,
		`SELECT organization_id, user_id FROM skaftin_system_projects WHERE id = $1`, projectID,
	).Scan(&orgID, &ownerUserID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &AccessResult{HasAccess: false}, nil
		}
		return nil, err
	}

	// Legacy project without organization
	if orgID == nil {
		return &AccessResult{
			HasAccess: ownerUserID == userID,
			Role:      "admin",
		}, nil
	}

	var role string
	err = s.pool.QueryRow(ctx,
		`SELECT role FROM skaftin_system_organization_members WHERE organization_id = $1 AND user_id = $2`,
		*orgID, userID,
	).Scan(&role)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &AccessResult{HasAccess: false}, nil
		}
		return nil, err
	}

	return &AccessResult{HasAccess: true, Role: role}, nil
}

// GetUserOrgMembership returns the org role for a user in a specific org.
func (s *Store) GetUserOrgMembership(ctx context.Context, orgID int, userID string) (string, error) {
	var role string
	err := s.pool.QueryRow(ctx,
		`SELECT role FROM skaftin_system_organization_members WHERE organization_id = $1 AND user_id = $2`,
		orgID, userID,
	).Scan(&role)
	if err != nil {
		return "", err
	}
	return role, nil
}

// ListUserProjects returns all projects a user can access (via org admin/dev + direct membership).
func (s *Store) ListUserProjects(ctx context.Context, userID string) ([]Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT `+qualifiedProjectColumns+`
		FROM skaftin_system_projects p
		LEFT JOIN skaftin_system_organization_members om
			ON p.organization_id = om.organization_id AND om.user_id = $1
		LEFT JOIN skaftin_system_project_members pm
			ON p.id = pm.project_id AND pm.user_id = $1
		WHERE (om.user_id IS NOT NULL AND om.role IN ('admin', 'dev'))
		   OR pm.user_id IS NOT NULL
		ORDER BY p.created_at
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjectRows(rows)
}

// ListAllUserProjects returns all projects a user can access (via ownership, org membership, or direct membership).
// Used for dashboard stats where we need the broadest view.
func (s *Store) ListAllUserProjects(ctx context.Context, userID string) ([]Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT `+qualifiedProjectColumns+`
		FROM skaftin_system_projects p
		LEFT JOIN skaftin_system_organization_members om
			ON p.organization_id = om.organization_id AND om.user_id = $1
		LEFT JOIN skaftin_system_project_members pm
			ON p.id = pm.project_id AND pm.user_id = $1
		WHERE p.user_id = $1
		   OR om.user_id IS NOT NULL
		   OR pm.user_id IS NOT NULL
		ORDER BY p.created_at
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjectRows(rows)
}

// CreateProject inserts a new project and returns it.
func (s *Store) CreateProject(ctx context.Context, name, description string, orgID int, userID, schemaName string) (*Project, error) {
	var descPtr *string
	if description != "" {
		descPtr = &description
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO skaftin_system_projects (name, description, organization_id, user_id, schema_name)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+projectColumns,
		name, descPtr, orgID, userID, schemaName,
	)
	return scanProject(row)
}

// UpdateProject updates a project and returns it.
func (s *Store) UpdateProject(ctx context.Context, id int, name, description *string, fieldEncryptionKey *string, clearEncKey bool) (*Project, error) {
	setClauses := "updated_at = NOW()"
	args := []any{}
	argIdx := 1

	if name != nil {
		setClauses += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, *name)
		argIdx++
	}
	if description != nil {
		setClauses += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, *description)
		argIdx++
	}
	if clearEncKey {
		setClauses += fmt.Sprintf(", field_encryption_key = $%d", argIdx)
		args = append(args, nil)
		argIdx++
	} else if fieldEncryptionKey != nil {
		setClauses += fmt.Sprintf(", field_encryption_key = $%d", argIdx)
		args = append(args, *fieldEncryptionKey)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(
		`UPDATE skaftin_system_projects SET %s WHERE id = $%d RETURNING %s`,
		setClauses, argIdx, projectColumns,
	)
	row := s.pool.QueryRow(ctx, query, args...)
	return scanProject(row)
}

// DeleteProject removes a project.
func (s *Store) DeleteProject(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM skaftin_system_projects WHERE id = $1`, id)
	return err
}

// CreateSchema creates a PostgreSQL schema.
func (s *Store) CreateSchema(ctx context.Context, schemaName string) error {
	_, err := s.pool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName))
	return err
}

// InitializeProjectAuthTables creates the base auth tables in a project schema.
func (s *Store) InitializeProjectAuthTables(ctx context.Context, schemaName string) error {
	queries := []string{
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_users (
			id SERIAL PRIMARY KEY,
			supertokens_user_id VARCHAR(255) UNIQUE,
			name VARCHAR(255) NOT NULL,
			last_name VARCHAR(255),
			email VARCHAR(255),
			password VARCHAR(255),
			phone VARCHAR(50),
			metadata JSONB DEFAULT '{}',
			organisation_id INTEGER,
			is_active BOOLEAN DEFAULT true,
			email_verified BOOLEAN DEFAULT false,
			phone_verified BOOLEAN DEFAULT false,
			custom_field_1 VARCHAR(255),
			custom_field_2 VARCHAR(255),
			deletion_requested_at TIMESTAMP,
			deletion_scheduled_at TIMESTAMP,
			deletion_reason TEXT,
			deleted_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_email ON %s.skaftin_system_users(email)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_supertokens_user_id ON %s.skaftin_system_users(supertokens_user_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_is_active ON %s.skaftin_system_users(is_active)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_organisation_id ON %s.skaftin_system_users(organisation_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_phone ON %s.skaftin_system_users(phone)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_roles (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			description TEXT,
			is_default BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name)
		)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_user_roles (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES %s.skaftin_system_users(id) ON DELETE CASCADE,
			role_id INTEGER NOT NULL REFERENCES %s.skaftin_system_roles(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, role_id)
		)`, schemaName, schemaName, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_user_custom_fields (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES %s.skaftin_system_users(id) ON DELETE CASCADE,
			field_name VARCHAR(255) NOT NULL,
			field_value TEXT,
			field_type VARCHAR(50) DEFAULT 'text',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName, schemaName),
	}
	for _, q := range queries {
		if _, err := s.pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("init auth tables: %w", err)
		}
	}
	return nil
}

// CreateDefaultAuthSettings inserts default auth settings for a project.
func (s *Store) CreateDefaultAuthSettings(ctx context.Context, projectID int) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.skaftin_system_auth_settings (project_id, allow_duplicate_emails, registration_enabled, auth_enabled)
		VALUES ($1, false, true, true)
		ON CONFLICT (project_id) DO NOTHING
	`, projectID)
	return err
}

// GetTableCount returns the number of base tables in a schema (excluding system tables).
func (s *Store) GetTableCount(ctx context.Context, schemaName string, excludeSystem bool) (int, error) {
	query := `
		SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = $1 AND table_type = 'BASE TABLE'
	`
	if excludeSystem {
		query += ` AND table_name NOT LIKE 'skaftin_system_%'`
	}
	var count int
	err := s.pool.QueryRow(ctx, query, schemaName).Scan(&count)
	return count, err
}

// GetAPICallCount returns the count of app-api metrics for a project.
func (s *Store) GetAPICallCount(ctx context.Context, projectID int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM public.skaftin_system_api_metrics
		WHERE project_id = $1 AND endpoint LIKE '/app-api/%'
	`, projectID).Scan(&count)
	return count, err
}

// ListBucketNames returns bucket names for a project.
func (s *Store) ListBucketNames(ctx context.Context, projectID int) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT bucket_name FROM skaftin_system_project_buckets WHERE project_id = $1`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// ListTableNamesInSchema returns all table names in a schema.
func (s *Store) ListTableNamesInSchema(ctx context.Context, schemaName string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = $1 AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`, schemaName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// DropTable drops a table in a schema.
func (s *Store) DropTable(ctx context.Context, schemaName, tableName string) error {
	_, err := s.pool.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s."%s" CASCADE`, schemaName, tableName))
	return err
}

// --- Bucket CRUD ---

const bucketColumns = `id, project_id, bucket_name, description, access_policy, created_at, updated_at`

func scanBucket(row pgx.Row) (*Bucket, error) {
	var b Bucket
	err := row.Scan(&b.ID, &b.ProjectID, &b.BucketName, &b.Description, &b.AccessPolicy, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func scanBucketRows(rows pgx.Rows) ([]Bucket, error) {
	out := make([]Bucket, 0)
	for rows.Next() {
		var b Bucket
		if err := rows.Scan(&b.ID, &b.ProjectID, &b.BucketName, &b.Description, &b.AccessPolicy, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ListBuckets returns all buckets for a project.
func (s *Store) ListBuckets(ctx context.Context, projectID int) ([]Bucket, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+bucketColumns+` FROM skaftin_system_project_buckets WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBucketRows(rows)
}

// GetBucket returns a single bucket by ID and project ID.
func (s *Store) GetBucket(ctx context.Context, projectID, bucketID int) (*Bucket, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+bucketColumns+` FROM skaftin_system_project_buckets WHERE id = $1 AND project_id = $2`,
		bucketID, projectID)
	return scanBucket(row)
}

// BucketNameExists checks if a bucket name is already taken.
func (s *Store) BucketNameExists(ctx context.Context, bucketName string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM skaftin_system_project_buckets WHERE bucket_name = $1)`,
		bucketName).Scan(&exists)
	return exists, err
}

// CreateBucket inserts a bucket record.
func (s *Store) CreateBucket(ctx context.Context, projectID int, bucketName string, description *string, accessPolicy string) (*Bucket, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO skaftin_system_project_buckets (project_id, bucket_name, description, access_policy)
		VALUES ($1, $2, $3, $4)
		RETURNING `+bucketColumns,
		projectID, bucketName, description, accessPolicy,
	)
	return scanBucket(row)
}

// UpdateBucket updates bucket fields. Only non-nil values are updated.
func (s *Store) UpdateBucket(ctx context.Context, projectID, bucketID int, bucketName, description, accessPolicy *string) (*Bucket, error) {
	setClauses := "updated_at = NOW()"
	args := []any{}
	argIdx := 1

	if bucketName != nil {
		setClauses += fmt.Sprintf(", bucket_name = $%d", argIdx)
		args = append(args, *bucketName)
		argIdx++
	}
	if description != nil {
		setClauses += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, *description)
		argIdx++
	}
	if accessPolicy != nil {
		setClauses += fmt.Sprintf(", access_policy = $%d", argIdx)
		args = append(args, *accessPolicy)
		argIdx++
	}

	args = append(args, bucketID, projectID)
	query := fmt.Sprintf(
		`UPDATE skaftin_system_project_buckets SET %s WHERE id = $%d AND project_id = $%d RETURNING %s`,
		setClauses, argIdx, argIdx+1, bucketColumns,
	)
	row := s.pool.QueryRow(ctx, query, args...)
	return scanBucket(row)
}

// DeleteBucket removes a bucket record.
func (s *Store) DeleteBucket(ctx context.Context, projectID, bucketID int) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_project_buckets WHERE id = $1 AND project_id = $2`,
		bucketID, projectID)
	return err
}

// UpdateBucketPolicy updates only the access_policy column.
func (s *Store) UpdateBucketPolicy(ctx context.Context, projectID, bucketID int, policy string) (*Bucket, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE skaftin_system_project_buckets SET access_policy = $1, updated_at = NOW()
		WHERE id = $2 AND project_id = $3
		RETURNING `+bucketColumns,
		policy, bucketID, projectID,
	)
	return scanBucket(row)
}
