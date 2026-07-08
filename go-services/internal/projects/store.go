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
	DeletionRequestedAt *time.Time `json:"deletion_requested_at"`
	DeletionScheduledAt *time.Time `json:"deletion_scheduled_at"`
	DeletedAt           *time.Time `json:"deleted_at"`
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
		&p.CreatedAt, &p.UpdatedAt, &p.DeletionRequestedAt, &p.DeletionScheduledAt, &p.DeletedAt,
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
			&p.CreatedAt, &p.UpdatedAt, &p.DeletionRequestedAt, &p.DeletionScheduledAt, &p.DeletedAt,
		); err != nil {
			return nil, err
		}
		p.FieldEncryptionSet = encKey != nil && *encKey != ""
		out = append(out, p)
	}
	return out, rows.Err()
}

const projectColumns = `id, name, description, organization_id, user_id, schema_name, field_encryption_key, created_at, updated_at, deletion_requested_at, deletion_scheduled_at, deleted_at`
const qualifiedProjectColumns = `p.id, p.name, p.description, p.organization_id, p.user_id, p.schema_name, p.field_encryption_key, p.created_at, p.updated_at, p.deletion_requested_at, p.deletion_scheduled_at, p.deleted_at`

// GetProjectByID fetches a single project.
func (s *Store) GetProjectByID(ctx context.Context, id int) (*Project, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+projectColumns+` FROM skaftin_system_projects WHERE id = $1 AND deletion_scheduled_at IS NULL AND deleted_at IS NULL`, id)
	return scanProject(row)
}

// GetProjectByIDIncludingDeleted fetches a single project regardless of deletion state.
func (s *Store) GetProjectByIDIncludingDeleted(ctx context.Context, id int) (*Project, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+projectColumns+` FROM skaftin_system_projects WHERE id = $1`, id)
	return scanProject(row)
}

// CheckProjectAccess checks if a user has access to a project through org membership.
func (s *Store) CheckProjectAccess(ctx context.Context, projectID int, userID string) (*AccessResult, error) {
	var orgID *int
	var ownerUserID string
	var deletionScheduledAt *time.Time
	var deletedAt *time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT organization_id, user_id, deletion_scheduled_at, deleted_at FROM skaftin_system_projects WHERE id = $1`, projectID,
	).Scan(&orgID, &ownerUserID, &deletionScheduledAt, &deletedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &AccessResult{HasAccess: false}, nil
		}
		return nil, err
	}
	if deletionScheduledAt != nil || deletedAt != nil {
		return &AccessResult{HasAccess: false}, nil
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

// CheckProjectAccessIncludingDeleted checks membership/ownership, regardless of deletion state.
func (s *Store) CheckProjectAccessIncludingDeleted(ctx context.Context, projectID int, userID string) (*AccessResult, error) {
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

// ListUserProjects returns all projects a user can access.
// Access includes project ownership, organization membership, or direct project membership.
func (s *Store) ListUserProjects(ctx context.Context, userID string) ([]Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT `+qualifiedProjectColumns+`
		FROM skaftin_system_projects p
		LEFT JOIN skaftin_system_organization_members om
			ON p.organization_id = om.organization_id AND om.user_id = $1
		LEFT JOIN skaftin_system_project_members pm
			ON p.id = pm.project_id AND pm.user_id = $1
		WHERE p.deletion_scheduled_at IS NULL
		  AND p.deleted_at IS NULL
		  AND (
			p.user_id = $1
			OR om.user_id IS NOT NULL
			OR pm.user_id IS NOT NULL
		  )
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
		WHERE p.deletion_scheduled_at IS NULL
		  AND p.deleted_at IS NULL
		  AND (
			p.user_id = $1
			OR om.user_id IS NOT NULL
			OR pm.user_id IS NOT NULL
		  )
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

// ScheduleProjectDeletion marks a project for permanent deletion.
func (s *Store) ScheduleProjectDeletion(ctx context.Context, id int, scheduledAt time.Time) (*Project, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE skaftin_system_projects
		SET deletion_requested_at = NOW(),
			deletion_scheduled_at = $2,
			updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NULL
		RETURNING `+projectColumns,
		id, scheduledAt,
	)
	return scanProject(row)
}

// RestoreProject clears a pending project deletion schedule.
func (s *Store) RestoreProject(ctx context.Context, id int) (*Project, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE skaftin_system_projects
		SET deletion_requested_at = NULL,
			deletion_scheduled_at = NULL,
			updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NULL
		RETURNING `+projectColumns,
		id,
	)
	return scanProject(row)
}

// ListDeletedProjectsForUser returns projects scheduled for deletion that the user can restore.
// Visibility is restricted to project owners and org admins/owners.
func (s *Store) ListDeletedProjectsForUser(ctx context.Context, userID string) ([]Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT `+qualifiedProjectColumns+`
		FROM skaftin_system_projects p
		LEFT JOIN skaftin_system_organization_members om
			ON p.organization_id = om.organization_id AND om.user_id = $1
		WHERE p.deletion_scheduled_at IS NOT NULL
		  AND p.deleted_at IS NULL
		  AND (
			p.user_id = $1
			OR om.role IN ('owner', 'admin')
		  )
		ORDER BY p.deletion_scheduled_at ASC, p.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjectRows(rows)
}

type PendingDeletionProject struct {
	ID         int
	SchemaName string
}

// ListProjectsDueForPermanentDeletion returns projects whose deletion window has elapsed.
func (s *Store) ListProjectsDueForPermanentDeletion(ctx context.Context) ([]PendingDeletionProject, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, schema_name
		FROM skaftin_system_projects
		WHERE deletion_scheduled_at IS NOT NULL
		  AND deletion_scheduled_at <= NOW()
		  AND deleted_at IS NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]PendingDeletionProject, 0)
	for rows.Next() {
		var p PendingDeletionProject
		if err := rows.Scan(&p.ID, &p.SchemaName); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PermanentlyDeleteProject removes a project row after cleanup.
func (s *Store) PermanentlyDeleteProject(ctx context.Context, id int) error {
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
			role_name VARCHAR(100) NOT NULL,
			role_key VARCHAR(100) NOT NULL,
			description TEXT,
			permissions JSONB DEFAULT '[]'::jsonb,
			session_duration_minutes INTEGER DEFAULT 10080,
			is_system_role BOOLEAN DEFAULT false,
			organisation_field_name VARCHAR(255),
			organisation_lookup_table VARCHAR(255),
			organisation_lookup_field VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(role_key)
		)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_user_roles (
			id SERIAL PRIMARY KEY,
			app_user_id INTEGER NOT NULL REFERENCES %s.skaftin_system_users(id) ON DELETE CASCADE,
			role_id INTEGER NOT NULL REFERENCES %s.skaftin_system_roles(id) ON DELETE CASCADE,
			assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			assigned_by VARCHAR(255) DEFAULT 'system',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(app_user_id, role_id)
		)`, schemaName, schemaName, schemaName),
		fmt.Sprintf(`INSERT INTO %s.skaftin_system_roles
			(role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
			SELECT 'Admin', 'admin', 'System administrator role with full access', '[]'::jsonb, 60, true
			WHERE NOT EXISTS (SELECT 1 FROM %s.skaftin_system_roles WHERE role_key = 'admin')`, schemaName, schemaName),
		fmt.Sprintf(`INSERT INTO %s.skaftin_system_roles
			(role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
			SELECT 'User', 'user', 'Default application user role', '[]'::jsonb, 10080, true
			WHERE NOT EXISTS (SELECT 1 FROM %s.skaftin_system_roles WHERE role_key = 'user')`, schemaName, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_otp_verifications (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES %s.skaftin_system_users(id) ON DELETE CASCADE,
			otp_code VARCHAR(20) NOT NULL,
			otp_method VARCHAR(20) NOT NULL,
			destination VARCHAR(255) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			expires_at TIMESTAMP NOT NULL,
			verified_at TIMESTAMP,
			attempts INTEGER NOT NULL DEFAULT 0,
			purpose VARCHAR(100),
			metadata JSONB DEFAULT '{}'::jsonb,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_otp_verifications_user_id ON %s.skaftin_system_otp_verifications(user_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_otp_verifications_status ON %s.skaftin_system_otp_verifications(status)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_skaftin_system_otp_verifications_expires_at ON %s.skaftin_system_otp_verifications(expires_at)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_payment_providers (
			id SERIAL PRIMARY KEY,
			project_id INTEGER NOT NULL,
			name VARCHAR(255) NOT NULL,
			provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('payfast', 'fnb_pay')),
			merchant_id VARCHAR(255),
			merchant_key VARCHAR(255),
			passphrase TEXT,
			api_key TEXT,
			api_secret TEXT,
			public_key TEXT,
			return_url VARCHAR(500),
			cancel_url VARCHAR(500),
			notify_url VARCHAR(500),
			sandbox_mode BOOLEAN DEFAULT true,
			is_active BOOLEAN DEFAULT true,
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(project_id, name)
		)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_providers_project_id ON %s.skaftin_system_payment_providers(project_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_providers_provider_type ON %s.skaftin_system_payment_providers(provider_type)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_providers_is_active ON %s.skaftin_system_payment_providers(is_active)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_payment_transactions (
			id SERIAL PRIMARY KEY,
			project_id INTEGER NOT NULL,
			provider_id INTEGER REFERENCES %s.skaftin_system_payment_providers(id) ON DELETE SET NULL,
			transaction_id VARCHAR(255) UNIQUE NOT NULL,
			external_payment_id VARCHAR(255),
			amount DECIMAL(12,2) NOT NULL,
			currency VARCHAR(3) DEFAULT 'ZAR',
			item_name VARCHAR(255) NOT NULL,
			item_description TEXT,
			customer_email VARCHAR(255),
			customer_name VARCHAR(255),
			customer_phone VARCHAR(50),
			payment_type VARCHAR(20) DEFAULT 'once_off' CHECK (payment_type IN ('once_off', 'subscription')),
			subscription_type INTEGER,
			frequency INTEGER,
			cycles INTEGER DEFAULT 0,
			subscription_token VARCHAR(255),
			status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'cancelled', 'refunded')),
			status_message TEXT,
			payment_url TEXT,
			return_url VARCHAR(500),
			cancel_url VARCHAR(500),
			metadata JSONB DEFAULT '{}',
			webhook_data JSONB,
			paid_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON %s.skaftin_system_payment_transactions(project_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON %s.skaftin_system_payment_transactions(provider_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON %s.skaftin_system_payment_transactions(transaction_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_payment_id ON %s.skaftin_system_payment_transactions(external_payment_id)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON %s.skaftin_system_payment_transactions(status)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_type ON %s.skaftin_system_payment_transactions(payment_type)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_email ON %s.skaftin_system_payment_transactions(customer_email)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON %s.skaftin_system_payment_transactions(created_at DESC)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_user_custom_fields (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES %s.skaftin_system_users(id) ON DELETE CASCADE,
			field_name VARCHAR(255) NOT NULL,
			field_value TEXT,
			field_type VARCHAR(50) DEFAULT 'text',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.skaftin_system_expo_notifications (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			platform VARCHAR(16) NOT NULL CHECK (platform IN ('ios', 'android')),
			expo_push_token TEXT NOT NULL,
			device_name TEXT,
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (expo_push_token)
		)`, schemaName),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_expo_notifications_user_id ON %s.skaftin_system_expo_notifications(user_id)`, schemaName),
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
	if err != nil {
		return err
	}

	var schemaName string
	if err := s.pool.QueryRow(ctx, `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, projectID).Scan(&schemaName); err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, fmt.Sprintf(`
		UPDATE public.skaftin_system_auth_settings aset
		SET default_role_id = r.id
		FROM %s.skaftin_system_roles r
		WHERE aset.project_id = $1
		  AND aset.default_role_id IS NULL
		  AND r.role_key = 'user'
	`, pgx.Identifier{schemaName}.Sanitize()), projectID)
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
