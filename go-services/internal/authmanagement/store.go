package authmanagement

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) getUserRoleUserIDColumn(ctx context.Context, schema string) (string, error) {
	var columnName string
	err := s.pool.QueryRow(ctx, `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = $1
		  AND table_name = 'skaftin_system_user_roles'
		  AND column_name IN ('app_user_id', 'user_id')
		ORDER BY CASE WHEN column_name = 'app_user_id' THEN 0 ELSE 1 END
		LIMIT 1
	`, schema).Scan(&columnName)
	if err == pgx.ErrNoRows {
		return "", fmt.Errorf("skaftin_system_user_roles has no app_user_id/user_id column in schema %s", schema)
	}
	return columnName, err
}

func (s *Store) ensureCustomFieldsCompatibility(ctx context.Context, schema string) error {
	tableIdent := fmt.Sprintf("%s.skaftin_system_user_custom_fields", pgx.Identifier{schema}.Sanitize())
	_, err := s.pool.Exec(ctx, fmt.Sprintf(`
		ALTER TABLE %s
		ADD COLUMN IF NOT EXISTS field_label VARCHAR(255),
		ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
		ADD COLUMN IF NOT EXISTS default_value TEXT,
		ADD COLUMN IF NOT EXISTS options JSONB,
		ADD COLUMN IF NOT EXISTS reference_table VARCHAR(255),
		ADD COLUMN IF NOT EXISTS reference_column VARCHAR(255),
		ADD COLUMN IF NOT EXISTS validation_rules JSONB,
		ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
		ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
	`, tableIdent))
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, fmt.Sprintf(`
		UPDATE %s
		SET field_label = COALESCE(field_label, field_name),
		    is_active = COALESCE(is_active, true),
		    display_order = COALESCE(display_order, 0)
	`, tableIdent))
	return err
}

// ─── Schema ──────────────────────────────────────────────────────────

func (s *Store) GetProjectSchema(ctx context.Context, projectID int) (string, error) {
	var schema string
	err := s.pool.QueryRow(ctx, `SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, projectID).Scan(&schema)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return schema, err
}

// ─── Auth Settings ───────────────────────────────────────────────────

const authSettingsCols = `id, project_id, allow_duplicate_emails, require_email_verification,
	require_phone_verification, enable_password_reset, enable_mfa, registration_enabled,
	auth_enabled, default_role_id, email_provider_id, sms_provider_id,
	send_registration_email, send_verification_email, send_password_reset_email, send_welcome_email,
	settings_json, created_at, updated_at, otp_length,
	send_registration_sms, send_verification_sms, send_password_reset_sms, send_welcome_sms,
	require_email, require_otp_for_password_change, require_otp_for_account_deletion`

func scanAuthSettings(row pgx.Row) (*AuthSettings, error) {
	var as AuthSettings
	err := row.Scan(
		&as.ID, &as.ProjectID, &as.AllowDuplicateEmails, &as.RequireEmailVerification,
		&as.RequirePhoneVerification, &as.EnablePasswordReset, &as.EnableMFA, &as.RegistrationEnabled,
		&as.AuthEnabled, &as.DefaultRoleID, &as.EmailProviderID, &as.SmsProviderID,
		&as.SendRegistrationEmail, &as.SendVerificationEmail, &as.SendPasswordResetEmail, &as.SendWelcomeEmail,
		&as.SettingsJSON, &as.CreatedAt, &as.UpdatedAt, &as.OtpLength,
		&as.SendRegistrationSMS, &as.SendVerificationSMS, &as.SendPasswordResetSMS, &as.SendWelcomeSMS,
		&as.RequireEmail, &as.RequireOtpForPasswordChange, &as.RequireOtpForAccountDeletion,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &as, err
}

func (s *Store) GetAuthSettings(ctx context.Context, projectID int) (*AuthSettings, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+authSettingsCols+` FROM public.skaftin_system_auth_settings WHERE project_id = $1`, projectID)
	return scanAuthSettings(row)
}

func (s *Store) UpsertAuthSettings(ctx context.Context, projectID int) (*AuthSettings, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.skaftin_system_auth_settings (project_id) VALUES ($1)
		ON CONFLICT (project_id) DO NOTHING
		RETURNING `+authSettingsCols, projectID)

	as, err := scanAuthSettings(row)
	if err != nil {
		return nil, err
	}
	if as == nil {
		return s.GetAuthSettings(ctx, projectID)
	}
	return as, nil
}

func (s *Store) UpdateAuthSettings(ctx context.Context, projectID int, fields map[string]any) (*AuthSettings, error) {
	if len(fields) == 0 {
		return s.GetAuthSettings(ctx, projectID)
	}
	setClauses := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)
	i := 1
	for col, val := range fields {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	args = append(args, projectID)
	query := fmt.Sprintf(`UPDATE public.skaftin_system_auth_settings SET %s WHERE project_id = $%d
		RETURNING `+authSettingsCols,
		strings.Join(setClauses, ", "), i)

	return scanAuthSettings(s.pool.QueryRow(ctx, query, args...))
}

// ─── Roles ───────────────────────────────────────────────────────────

func (s *Store) ListRoles(ctx context.Context, schema string, includeUserCount bool) ([]Role, error) {
	var query string
	if includeUserCount {
		userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
		if err != nil {
			return nil, err
		}
		query = fmt.Sprintf(`
			SELECT r.id, r.role_name, r.role_key, r.description, r.permissions,
			       r.session_duration_minutes, r.is_system_role,
			       r.organisation_field_name, r.organisation_lookup_table, r.organisation_lookup_field,
			       r.created_at, r.updated_at, COUNT(DISTINCT ur.%[2]s)::int
			FROM %[1]s.skaftin_system_roles r
			LEFT JOIN %[1]s.skaftin_system_user_roles ur ON r.id = ur.role_id
			GROUP BY r.id ORDER BY r.is_system_role DESC, r.created_at ASC`,
			pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	} else {
		query = fmt.Sprintf(`
			SELECT id, role_name, role_key, description, permissions,
			       session_duration_minutes, is_system_role,
			       organisation_field_name, organisation_lookup_table, organisation_lookup_field,
			       created_at, updated_at
			FROM %s.skaftin_system_roles ORDER BY is_system_role DESC, created_at ASC`,
			pgx.Identifier{schema}.Sanitize())
	}

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Role, 0)
	for rows.Next() {
		var r Role
		if includeUserCount {
			err = rows.Scan(&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions,
				&r.SessionDurationMinutes, &r.IsSystemRole,
				&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField,
				&r.CreatedAt, &r.UpdatedAt, &r.UserCount)
		} else {
			err = rows.Scan(&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions,
				&r.SessionDurationMinutes, &r.IsSystemRole,
				&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField,
				&r.CreatedAt, &r.UpdatedAt)
		}
		if err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (s *Store) GetRole(ctx context.Context, schema string, roleID int) (*Role, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		SELECT r.id, r.role_name, r.role_key, r.description, r.permissions,
		       r.session_duration_minutes, r.is_system_role,
		       r.organisation_field_name, r.organisation_lookup_table, r.organisation_lookup_field,
		       r.created_at, r.updated_at, COUNT(DISTINCT ur.%[2]s)::int
		FROM %[1]s.skaftin_system_roles r
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON r.id = ur.role_id
		WHERE r.id = $1 GROUP BY r.id`,
		pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())

	var r Role
	err = s.pool.QueryRow(ctx, query, roleID).Scan(
		&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions,
		&r.SessionDurationMinutes, &r.IsSystemRole,
		&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField,
		&r.CreatedAt, &r.UpdatedAt, &r.UserCount)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

func (s *Store) GetRoleByKey(ctx context.Context, schema, roleKey string) (*Role, error) {
	query := fmt.Sprintf(`SELECT id FROM %s.skaftin_system_roles WHERE role_key = $1`,
		pgx.Identifier{schema}.Sanitize())
	var r Role
	err := s.pool.QueryRow(ctx, query, roleKey).Scan(&r.ID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

func (s *Store) CreateRole(ctx context.Context, schema, roleName, roleKey string, description *string, permissions json.RawMessage, sessionDuration int) (*Role, error) {
	if permissions == nil {
		permissions = json.RawMessage("[]")
	}
	if sessionDuration <= 0 {
		sessionDuration = 10080
	}

	hasRoleNameCol, err := s.ColumnExists(ctx, schema, "skaftin_system_roles", "role_name")
	if err != nil {
		return nil, err
	}
	hasLegacyNameCol, err := s.ColumnExists(ctx, schema, "skaftin_system_roles", "name")
	if err != nil {
		return nil, err
	}
	hasRoleKeyCol, err := s.ColumnExists(ctx, schema, "skaftin_system_roles", "role_key")
	if err != nil {
		return nil, err
	}
	hasLegacyKeyCol, err := s.ColumnExists(ctx, schema, "skaftin_system_roles", "key")
	if err != nil {
		return nil, err
	}

	columns := []string{"description", "permissions", "session_duration_minutes", "is_system_role"}
	values := []any{description, permissions, sessionDuration, false}
	placeholders := []string{"$1", "$2", "$3", "$4"}
	nextArg := 5

	if hasRoleNameCol {
		columns = append(columns, "role_name")
		values = append(values, roleName)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
		nextArg++
	}
	if hasLegacyNameCol {
		columns = append(columns, "name")
		values = append(values, roleName)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
		nextArg++
	}
	if hasRoleKeyCol {
		columns = append(columns, "role_key")
		values = append(values, roleKey)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
		nextArg++
	}
	if hasLegacyKeyCol {
		columns = append(columns, "key")
		values = append(values, roleKey)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
		nextArg++
	}

	// Defensive fallback: if neither modern nor legacy columns are available,
	// keep explicit modern names so DB returns a clear error.
	if !hasRoleNameCol && !hasLegacyNameCol {
		columns = append(columns, "role_name")
		values = append(values, roleName)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
		nextArg++
	}
	if !hasRoleKeyCol && !hasLegacyKeyCol {
		columns = append(columns, "role_key")
		values = append(values, roleKey)
		placeholders = append(placeholders, fmt.Sprintf("$%d", nextArg))
	}

	query := fmt.Sprintf(`
		INSERT INTO %s.skaftin_system_roles (%s)
		VALUES (%s)
		RETURNING id, role_name, role_key, description, permissions, session_duration_minutes, is_system_role,
		          organisation_field_name, organisation_lookup_table, organisation_lookup_field, created_at, updated_at`,
		pgx.Identifier{schema}.Sanitize(),
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "))
	var r Role
	err = s.pool.QueryRow(ctx, query, values...).Scan(
		&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions, &r.SessionDurationMinutes, &r.IsSystemRole,
		&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField, &r.CreatedAt, &r.UpdatedAt)
	return &r, err
}

func (s *Store) UpdateRole(ctx context.Context, schema string, roleID int, fields map[string]any) (*Role, error) {
	setClauses := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)
	i := 1
	for col, val := range fields {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, roleID)

	query := fmt.Sprintf(`UPDATE %s.skaftin_system_roles SET %s WHERE id = $%d
		RETURNING id, role_name, role_key, description, permissions, session_duration_minutes, is_system_role,
		          organisation_field_name, organisation_lookup_table, organisation_lookup_field, created_at, updated_at`,
		pgx.Identifier{schema}.Sanitize(), strings.Join(setClauses, ", "), i)
	var r Role
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions, &r.SessionDurationMinutes, &r.IsSystemRole,
		&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField, &r.CreatedAt, &r.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

func (s *Store) DeleteRole(ctx context.Context, schema string, roleID int) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		fmt.Sprintf(`DELETE FROM %s.skaftin_system_roles WHERE id = $1 AND is_system_role = false`,
			pgx.Identifier{schema}.Sanitize()), roleID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *Store) CountUsersWithRole(ctx context.Context, schema string, roleID int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s.skaftin_system_user_roles WHERE role_id = $1`,
			pgx.Identifier{schema}.Sanitize()), roleID).Scan(&count)
	return count, err
}

func (s *Store) GetRolePermissions(ctx context.Context, schema string, roleID int) (json.RawMessage, error) {
	var perms json.RawMessage
	err := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT permissions FROM %s.skaftin_system_roles WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), roleID).Scan(&perms)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return perms, err
}

func (s *Store) UpdateRolePermissions(ctx context.Context, schema string, roleID int, perms json.RawMessage) (*Role, error) {
	return s.UpdateRole(ctx, schema, roleID, map[string]any{"permissions": perms})
}

func (s *Store) UpdateSessionDuration(ctx context.Context, schema string, roleID, minutes int) (*Role, error) {
	return s.UpdateRole(ctx, schema, roleID, map[string]any{"session_duration_minutes": minutes})
}

func (s *Store) GetAllSessionDurations(ctx context.Context, schema string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(`SELECT id, role_name, role_key, session_duration_minutes FROM %s.skaftin_system_roles ORDER BY role_name`,
			pgx.Identifier{schema}.Sanitize()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]any, 0)
	for rows.Next() {
		var id, dur int
		var name, key string
		if err := rows.Scan(&id, &name, &key, &dur); err != nil {
			return nil, err
		}
		list = append(list, map[string]any{"id": id, "role_name": name, "role_key": key, "session_duration_minutes": dur})
	}
	return list, rows.Err()
}

// ─── Custom Fields ───────────────────────────────────────────────────

func (s *Store) ListCustomFields(ctx context.Context, schema string, includeInactive bool) ([]CustomField, error) {
	if err := s.ensureCustomFieldsCompatibility(ctx, schema); err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`SELECT id, field_name, field_label, field_type, is_required, default_value,
		options, reference_table, reference_column, validation_rules, display_order, is_active, created_at, updated_at
		FROM %s.skaftin_system_user_custom_fields`, pgx.Identifier{schema}.Sanitize())
	if !includeInactive {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY display_order ASC, created_at ASC`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]CustomField, 0)
	for rows.Next() {
		var f CustomField
		if err := rows.Scan(&f.ID, &f.FieldName, &f.FieldLabel, &f.FieldType, &f.IsRequired, &f.DefaultValue,
			&f.Options, &f.ReferenceTable, &f.ReferenceColumn, &f.ValidationRules, &f.DisplayOrder, &f.IsActive,
			&f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

func (s *Store) GetCustomField(ctx context.Context, schema string, fieldID int) (*CustomField, error) {
	if err := s.ensureCustomFieldsCompatibility(ctx, schema); err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`SELECT id, field_name, field_label, field_type, is_required, default_value,
		options, reference_table, reference_column, validation_rules, display_order, is_active, created_at, updated_at
		FROM %s.skaftin_system_user_custom_fields WHERE id = $1`, pgx.Identifier{schema}.Sanitize())
	var f CustomField
	err := s.pool.QueryRow(ctx, query, fieldID).Scan(
		&f.ID, &f.FieldName, &f.FieldLabel, &f.FieldType, &f.IsRequired, &f.DefaultValue,
		&f.Options, &f.ReferenceTable, &f.ReferenceColumn, &f.ValidationRules, &f.DisplayOrder, &f.IsActive,
		&f.CreatedAt, &f.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &f, err
}

func (s *Store) CustomFieldExistsByName(ctx context.Context, schema, fieldName string) (bool, error) {
	var id int
	err := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT id FROM %s.skaftin_system_user_custom_fields WHERE field_name = $1`,
			pgx.Identifier{schema}.Sanitize()), fieldName).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) CreateCustomField(ctx context.Context, schema string, f CustomField) (*CustomField, error) {
	if err := s.ensureCustomFieldsCompatibility(ctx, schema); err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`INSERT INTO %s.skaftin_system_user_custom_fields
		(field_name, field_label, field_type, is_required, default_value, options, reference_table, reference_column, validation_rules, display_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
		RETURNING id, field_name, field_label, field_type, is_required, default_value,
		          options, reference_table, reference_column, validation_rules, display_order, is_active, created_at, updated_at`,
		pgx.Identifier{schema}.Sanitize())
	var out CustomField
	err := s.pool.QueryRow(ctx, query, f.FieldName, f.FieldLabel, f.FieldType, f.IsRequired, f.DefaultValue,
		f.Options, f.ReferenceTable, f.ReferenceColumn, f.ValidationRules, f.DisplayOrder).Scan(
		&out.ID, &out.FieldName, &out.FieldLabel, &out.FieldType, &out.IsRequired, &out.DefaultValue,
		&out.Options, &out.ReferenceTable, &out.ReferenceColumn, &out.ValidationRules, &out.DisplayOrder, &out.IsActive,
		&out.CreatedAt, &out.UpdatedAt)
	return &out, err
}

func (s *Store) UpdateCustomField(ctx context.Context, schema string, fieldID int, fields map[string]any) (*CustomField, error) {
	if err := s.ensureCustomFieldsCompatibility(ctx, schema); err != nil {
		return nil, err
	}
	setClauses := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)
	i := 1
	for col, val := range fields {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, fieldID)

	query := fmt.Sprintf(`UPDATE %s.skaftin_system_user_custom_fields SET %s WHERE id = $%d
		RETURNING id, field_name, field_label, field_type, is_required, default_value,
		          options, reference_table, reference_column, validation_rules, display_order, is_active, created_at, updated_at`,
		pgx.Identifier{schema}.Sanitize(), strings.Join(setClauses, ", "), i)
	var f CustomField
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&f.ID, &f.FieldName, &f.FieldLabel, &f.FieldType, &f.IsRequired, &f.DefaultValue,
		&f.Options, &f.ReferenceTable, &f.ReferenceColumn, &f.ValidationRules, &f.DisplayOrder, &f.IsActive,
		&f.CreatedAt, &f.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &f, err
}

func (s *Store) DeleteCustomField(ctx context.Context, schema string, fieldID int, permanent bool) (*CustomField, error) {
	if err := s.ensureCustomFieldsCompatibility(ctx, schema); err != nil {
		return nil, err
	}
	if permanent {
		query := fmt.Sprintf(`DELETE FROM %s.skaftin_system_user_custom_fields WHERE id = $1
			RETURNING id, field_name, field_label, field_type, is_required, default_value,
			          options, reference_table, reference_column, validation_rules, display_order, is_active, created_at, updated_at`,
			pgx.Identifier{schema}.Sanitize())
		var f CustomField
		err := s.pool.QueryRow(ctx, query, fieldID).Scan(
			&f.ID, &f.FieldName, &f.FieldLabel, &f.FieldType, &f.IsRequired, &f.DefaultValue,
			&f.Options, &f.ReferenceTable, &f.ReferenceColumn, &f.ValidationRules, &f.DisplayOrder, &f.IsActive,
			&f.CreatedAt, &f.UpdatedAt)
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return &f, err
	}
	return s.UpdateCustomField(ctx, schema, fieldID, map[string]any{"is_active": false})
}

func (s *Store) ApplyCustomFieldColumn(ctx context.Context, schema string, fieldName, colType string, notNull bool, defaultVal *string) error {
	ddl := fmt.Sprintf(`ALTER TABLE %s.skaftin_system_users ADD COLUMN %s %s`,
		pgx.Identifier{schema}.Sanitize(), pgx.Identifier{fieldName}.Sanitize(), colType)
	if notNull && defaultVal != nil {
		ddl += fmt.Sprintf(` NOT NULL DEFAULT %s`, *defaultVal)
	} else if defaultVal != nil {
		ddl += fmt.Sprintf(` DEFAULT %s`, *defaultVal)
	}
	_, err := s.pool.Exec(ctx, ddl)
	return err
}

func (s *Store) AddForeignKey(ctx context.Context, schema, fieldName, refTable, refColumn string) error {
	ddl := fmt.Sprintf(`ALTER TABLE %s.skaftin_system_users ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s.%s(%s) ON DELETE SET NULL`,
		pgx.Identifier{schema}.Sanitize(),
		pgx.Identifier{"fk_" + fieldName}.Sanitize(),
		pgx.Identifier{fieldName}.Sanitize(),
		pgx.Identifier{schema}.Sanitize(),
		pgx.Identifier{refTable}.Sanitize(),
		pgx.Identifier{refColumn}.Sanitize())
	_, err := s.pool.Exec(ctx, ddl)
	return err
}

func (s *Store) ColumnExists(ctx context.Context, schema, table, column string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3)`,
		schema, table, column).Scan(&exists)
	return exists, err
}

func (s *Store) TableExists(ctx context.Context, schema, table string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
		schema, table).Scan(&exists)
	return exists, err
}

func (s *Store) GetAvailableTables(ctx context.Context, schema string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t.table_name,
		  (SELECT json_agg(c.column_name) FROM information_schema.columns c
		   WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
		     AND c.data_type IN ('integer','bigint','smallint')) as id_columns
		FROM information_schema.tables t
		WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE' ORDER BY t.table_name`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]any, 0)
	for rows.Next() {
		var name string
		var idCols json.RawMessage
		if err := rows.Scan(&name, &idCols); err != nil {
			return nil, err
		}
		list = append(list, map[string]any{"table_name": name, "id_columns": idCols})
	}
	return list, rows.Err()
}

// ─── Users ───────────────────────────────────────────────────────────

func (s *Store) ListUsers(ctx context.Context, schema string, filters map[string]any, limit, offset int) ([]AppUser, int, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, 0, err
	}
	baseQuery := fmt.Sprintf(`
		SELECT u.id, u.supertokens_user_id, u.name, u.last_name, u.email, u.password, u.phone,
		       u.metadata, u.organisation_id, u.is_active, u.email_verified, u.phone_verified,
		       u.deletion_requested_at, u.deletion_scheduled_at, u.deletion_reason, u.deleted_at,
		       u.created_at, u.updated_at, u.custom_field_1, u.custom_field_2,
		       COALESCE(json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key))
		         FILTER (WHERE r.id IS NOT NULL), '[]') as roles
		FROM %[1]s.skaftin_system_users u
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[2]s
		LEFT JOIN %[1]s.skaftin_system_roles r ON ur.role_id = r.id`,
		pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())

	whereClauses := []string{}
	args := []any{}
	idx := 1

	if v, ok := filters["search"]; ok && v != "" {
		whereClauses = append(whereClauses, fmt.Sprintf(
			`(u.name ILIKE $%d OR u.email ILIKE $%d OR u.phone ILIKE $%d)`, idx, idx, idx))
		args = append(args, "%"+v.(string)+"%")
		idx++
	}
	if v, ok := filters["role_id"]; ok {
		whereClauses = append(whereClauses, fmt.Sprintf(`ur.role_id = $%d`, idx))
		args = append(args, v)
		idx++
	}
	if v, ok := filters["is_active"]; ok {
		whereClauses = append(whereClauses, fmt.Sprintf(`u.is_active = $%d`, idx))
		args = append(args, v)
		idx++
	}

	where := ""
	if len(whereClauses) > 0 {
		where = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(DISTINCT u.id) FROM %[1]s.skaftin_system_users u
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[2]s %s`,
		pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize(), where)
	var total int
	if err = s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := baseQuery + where + ` GROUP BY u.id ORDER BY u.created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]AppUser, 0)
	for rows.Next() {
		var u AppUser
		if err := rows.Scan(&u.ID, &u.SupertokensUserID, &u.Name, &u.LastName, &u.Email, &u.Password, &u.Phone,
			&u.Metadata, &u.OrganisationID, &u.IsActive, &u.EmailVerified, &u.PhoneVerified,
			&u.DeletionRequestedAt, &u.DeletionScheduledAt, &u.DeletionReason, &u.DeletedAt,
			&u.CreatedAt, &u.UpdatedAt, &u.CustomField1, &u.CustomField2, &u.Roles); err != nil {
			return nil, 0, err
		}
		list = append(list, u)
	}
	return list, total, rows.Err()
}

func (s *Store) GetUser(ctx context.Context, schema string, userID int) (*AppUser, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		SELECT u.id, u.supertokens_user_id, u.name, u.last_name, u.email, u.password, u.phone,
		       u.metadata, u.organisation_id, u.is_active, u.email_verified, u.phone_verified,
		       u.deletion_requested_at, u.deletion_scheduled_at, u.deletion_reason, u.deleted_at,
		       u.created_at, u.updated_at, u.custom_field_1, u.custom_field_2,
		       COALESCE(json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key))
		         FILTER (WHERE r.id IS NOT NULL), '[]') as roles
		FROM %[1]s.skaftin_system_users u
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[2]s
		LEFT JOIN %[1]s.skaftin_system_roles r ON ur.role_id = r.id
		WHERE u.id = $1 GROUP BY u.id`, pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	var u AppUser
	err = s.pool.QueryRow(ctx, query, userID).Scan(
		&u.ID, &u.SupertokensUserID, &u.Name, &u.LastName, &u.Email, &u.Password, &u.Phone,
		&u.Metadata, &u.OrganisationID, &u.IsActive, &u.EmailVerified, &u.PhoneVerified,
		&u.DeletionRequestedAt, &u.DeletionScheduledAt, &u.DeletionReason, &u.DeletedAt,
		&u.CreatedAt, &u.UpdatedAt, &u.CustomField1, &u.CustomField2, &u.Roles)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (s *Store) GetUserByEmail(ctx context.Context, schema, email string) (*AppUser, error) {
	query := fmt.Sprintf(`SELECT id, supertokens_user_id, name, email, phone, password, metadata,
		custom_field_1, custom_field_2, is_active, email_verified, phone_verified, organisation_id
		FROM %s.skaftin_system_users WHERE email = $1`, pgx.Identifier{schema}.Sanitize())
	var u AppUser
	err := s.pool.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.SupertokensUserID, &u.Name, &u.Email, &u.Phone, &u.Password, &u.Metadata,
		&u.CustomField1, &u.CustomField2, &u.IsActive, &u.EmailVerified, &u.PhoneVerified, &u.OrganisationID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (s *Store) GetUserByPhone(ctx context.Context, schema, phone string) (*AppUser, error) {
	query := fmt.Sprintf(`SELECT id, supertokens_user_id, name, email, phone, password, metadata,
		custom_field_1, custom_field_2, is_active, email_verified, phone_verified, organisation_id
		FROM %s.skaftin_system_users WHERE phone = $1`, pgx.Identifier{schema}.Sanitize())
	var u AppUser
	err := s.pool.QueryRow(ctx, query, phone).Scan(
		&u.ID, &u.SupertokensUserID, &u.Name, &u.Email, &u.Phone, &u.Password, &u.Metadata,
		&u.CustomField1, &u.CustomField2, &u.IsActive, &u.EmailVerified, &u.PhoneVerified, &u.OrganisationID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (s *Store) GetUserByCredential(ctx context.Context, schema, method, value string) (*AppUser, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	var col string
	switch method {
	case "email":
		col = "email"
	case "phone":
		col = "phone"
	case "custom_field_1":
		col = "custom_field_1"
	case "custom_field_2":
		col = "custom_field_2"
	default:
		col = "email"
	}
	query := fmt.Sprintf(`
		SELECT u.id, u.supertokens_user_id, u.name, u.email, u.phone, u.password, u.metadata,
		       u.custom_field_1, u.custom_field_2, u.is_active, u.email_verified, u.phone_verified, u.organisation_id,
		       COALESCE(json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key,
		         'organisation_field_name', r.organisation_field_name, 'organisation_lookup_table', r.organisation_lookup_table,
		         'organisation_lookup_field', r.organisation_lookup_field, 'session_duration_minutes', r.session_duration_minutes))
		         FILTER (WHERE r.id IS NOT NULL), '[]') as roles
		FROM %[1]s.skaftin_system_users u
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[3]s
		LEFT JOIN %[1]s.skaftin_system_roles r ON ur.role_id = r.id
		WHERE u.%[2]s = $1 GROUP BY u.id`,
		pgx.Identifier{schema}.Sanitize(), pgx.Identifier{col}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	var u AppUser
	err = s.pool.QueryRow(ctx, query, value).Scan(
		&u.ID, &u.SupertokensUserID, &u.Name, &u.Email, &u.Phone, &u.Password, &u.Metadata,
		&u.CustomField1, &u.CustomField2, &u.IsActive, &u.EmailVerified, &u.PhoneVerified, &u.OrganisationID, &u.Roles)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (s *Store) GetUserBySuperTokensID(ctx context.Context, schema, stID string) (*AppUser, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		SELECT u.id, u.supertokens_user_id, u.name, u.email, u.phone, u.metadata,
		       u.custom_field_1, u.custom_field_2, u.is_active, u.email_verified, u.phone_verified, u.organisation_id,
		       COALESCE(json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key))
		         FILTER (WHERE r.id IS NOT NULL), '[]') as roles
		FROM %[1]s.skaftin_system_users u
		LEFT JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[2]s
		LEFT JOIN %[1]s.skaftin_system_roles r ON ur.role_id = r.id
		WHERE u.supertokens_user_id = $1 GROUP BY u.id`, pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	var u AppUser
	err = s.pool.QueryRow(ctx, query, stID).Scan(
		&u.ID, &u.SupertokensUserID, &u.Name, &u.Email, &u.Phone, &u.Metadata,
		&u.CustomField1, &u.CustomField2, &u.IsActive, &u.EmailVerified, &u.PhoneVerified, &u.OrganisationID, &u.Roles)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (s *Store) CreateUser(ctx context.Context, schema string, u map[string]any) (*AppUser, error) {
	cols := make([]string, 0, len(u))
	placeholders := make([]string, 0, len(u))
	args := make([]any, 0, len(u))
	i := 1
	for col, val := range u {
		cols = append(cols, col)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		args = append(args, val)
		i++
	}
	query := fmt.Sprintf(`INSERT INTO %s.skaftin_system_users (%s) VALUES (%s) RETURNING id, name, email, phone, is_active, created_at`,
		pgx.Identifier{schema}.Sanitize(), strings.Join(cols, ", "), strings.Join(placeholders, ", "))
	var out AppUser
	err := s.pool.QueryRow(ctx, query, args...).Scan(&out.ID, &out.Name, &out.Email, &out.Phone, &out.IsActive, &out.CreatedAt)
	return &out, err
}

func (s *Store) UpdateUser(ctx context.Context, schema string, userID int, fields map[string]any) error {
	setClauses := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)
	i := 1
	for col, val := range fields {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, userID)
	query := fmt.Sprintf(`UPDATE %s.skaftin_system_users SET %s WHERE id = $%d`,
		pgx.Identifier{schema}.Sanitize(), strings.Join(setClauses, ", "), i)
	_, err := s.pool.Exec(ctx, query, args...)
	return err
}

func (s *Store) SoftDeleteUser(ctx context.Context, schema string, userID int) error {
	query := fmt.Sprintf(`UPDATE %s.skaftin_system_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		pgx.Identifier{schema}.Sanitize())
	_, err := s.pool.Exec(ctx, query, userID)
	return err
}

func (s *Store) HardDeleteUser(ctx context.Context, schema string, userID int) error {
	referencingFKs, err := s.getForeignKeysReferencingUsers(ctx, schema)
	if err != nil {
		return err
	}
	for _, fk := range referencingFKs {
		// Skip self-table reference handling; user row is deleted at the end.
		if fk.TableName == "skaftin_system_users" {
			continue
		}
		if _, execErr := s.pool.Exec(
			ctx,
			fmt.Sprintf(
				`DELETE FROM %s.%s WHERE %s = $1`,
				pgx.Identifier{schema}.Sanitize(),
				pgx.Identifier{fk.TableName}.Sanitize(),
				pgx.Identifier{fk.ColumnName}.Sanitize(),
			),
			userID,
		); execErr != nil {
			return execErr
		}
	}

	userRolesExists, err := s.TableExists(ctx, schema, "skaftin_system_user_roles")
	if err != nil {
		return err
	}
	if userRolesExists {
		userRoleUserIDColumn, columnErr := s.getUserRoleUserIDColumn(ctx, schema)
		if columnErr != nil {
			return columnErr
		}
		if _, execErr := s.pool.Exec(ctx,
			fmt.Sprintf(`DELETE FROM %s.skaftin_system_user_roles WHERE %s = $1`,
				pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize()), userID); execErr != nil {
			return execErr
		}
	}

	otpVerificationsExists, err := s.TableExists(ctx, schema, "skaftin_system_otp_verifications")
	if err != nil {
		return err
	}
	if otpVerificationsExists {
		if _, execErr := s.pool.Exec(ctx,
			fmt.Sprintf(`DELETE FROM %s.skaftin_system_otp_verifications WHERE user_id = $1`,
				pgx.Identifier{schema}.Sanitize()), userID); execErr != nil {
			return execErr
		}
	}

	if _, err = s.pool.Exec(ctx,
		fmt.Sprintf(`DELETE FROM %s.skaftin_system_users WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), userID); err != nil {
		return err
	}
	return nil
}

type userReferenceForeignKey struct {
	TableName  string
	ColumnName string
}

func (s *Store) getForeignKeysReferencingUsers(ctx context.Context, schema string) ([]userReferenceForeignKey, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT kcu.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage ccu
		  ON ccu.constraint_name = tc.constraint_name
		 AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = $1
		  AND ccu.table_schema = $1
		  AND ccu.table_name = 'skaftin_system_users'
		  AND ccu.column_name = 'id'
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	refs := make([]userReferenceForeignKey, 0)
	for rows.Next() {
		var ref userReferenceForeignKey
		if scanErr := rows.Scan(&ref.TableName, &ref.ColumnName); scanErr != nil {
			return nil, scanErr
		}
		refs = append(refs, ref)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	return refs, nil
}

func (s *Store) EmailExistsInProject(ctx context.Context, schema, email string, excludeUserID *int) (bool, error) {
	query := fmt.Sprintf(`SELECT id FROM %s.skaftin_system_users WHERE email = $1`,
		pgx.Identifier{schema}.Sanitize())
	args := []any{email}
	if excludeUserID != nil {
		query += ` AND id != $2`
		args = append(args, *excludeUserID)
	}
	var id int
	err := s.pool.QueryRow(ctx, query, args...).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) GetUserPassword(ctx context.Context, schema string, userID int) (*string, error) {
	var pw *string
	err := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT password FROM %s.skaftin_system_users WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), userID).Scan(&pw)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return pw, err
}

func (s *Store) SetUserPassword(ctx context.Context, schema string, userID int, hash string) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET password = $1 WHERE id = $2`,
			pgx.Identifier{schema}.Sanitize()), hash, userID)
	return err
}

func (s *Store) ClearUserPassword(ctx context.Context, schema string, userID int) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET password = NULL WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), userID)
	return err
}

func (s *Store) SetUserSuperTokensID(ctx context.Context, schema string, userID int, stID string) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET supertokens_user_id = $1 WHERE id = $2`,
			pgx.Identifier{schema}.Sanitize()), stID, userID)
	return err
}

func (s *Store) GetUsersByRole(ctx context.Context, schema string, roleID int) ([]AppUser, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at
		FROM %[1]s.skaftin_system_users u
		INNER JOIN %[1]s.skaftin_system_user_roles ur ON u.id = ur.%[2]s
		WHERE ur.role_id = $1 ORDER BY u.created_at DESC`, pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	rows, err := s.pool.Query(ctx, query, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]AppUser, 0)
	for rows.Next() {
		var u AppUser
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Phone, &u.IsActive, &u.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}

// ─── User Roles ──────────────────────────────────────────────────────

func (s *Store) AssignRole(ctx context.Context, schema string, userID, roleID int, assignedBy string) error {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return err
	}
	var existing int
	err = s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT id FROM %s.skaftin_system_user_roles WHERE %s = $1 AND role_id = $2`,
			pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize()), userID, roleID).Scan(&existing)
	if err == nil {
		return nil
	}
	if err != pgx.ErrNoRows {
		return err
	}
	_, err = s.pool.Exec(ctx,
		fmt.Sprintf(`INSERT INTO %s.skaftin_system_user_roles (%s, role_id, assigned_by) VALUES ($1, $2, $3)`,
			pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize()), userID, roleID, assignedBy)
	return err
}

func (s *Store) RemoveRole(ctx context.Context, schema string, userID, roleID int) (bool, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return false, err
	}
	tag, err := s.pool.Exec(ctx,
		fmt.Sprintf(`DELETE FROM %s.skaftin_system_user_roles WHERE %s = $1 AND role_id = $2`,
			pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize()), userID, roleID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *Store) GetUserRoles(ctx context.Context, schema string, userID int) ([]Role, error) {
	userRoleUserIDColumn, err := s.getUserRoleUserIDColumn(ctx, schema)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		SELECT r.id, r.role_name, r.role_key, r.description, r.permissions, r.session_duration_minutes, r.is_system_role,
		       r.organisation_field_name, r.organisation_lookup_table, r.organisation_lookup_field, r.created_at, r.updated_at
		FROM %[1]s.skaftin_system_roles r
		INNER JOIN %[1]s.skaftin_system_user_roles ur ON r.id = ur.role_id
		WHERE ur.%[2]s = $1`, pgx.Identifier{schema}.Sanitize(), pgx.Identifier{userRoleUserIDColumn}.Sanitize())
	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Role, 0)
	for rows.Next() {
		var r Role
		if err := rows.Scan(&r.ID, &r.RoleName, &r.RoleKey, &r.Description, &r.Permissions, &r.SessionDurationMinutes, &r.IsSystemRole,
			&r.OrganisationFieldName, &r.OrganisationLookupTable, &r.OrganisationLookupField, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

// ─── OTP ─────────────────────────────────────────────────────────────

func (s *Store) CreateOTP(ctx context.Context, schema string, userID int, code, method, destination string, expiresAt time.Time, purpose string, metadata json.RawMessage) error {
	var purposeVal *string
	if purpose != "" {
		purposeVal = &purpose
	}
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`INSERT INTO %s.skaftin_system_otp_verifications
			(user_id, otp_code, otp_method, destination, expires_at, purpose, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			pgx.Identifier{schema}.Sanitize()),
		userID, code, method, destination, expiresAt, purposeVal, metadata)
	return err
}

func (s *Store) GetPendingOTP(ctx context.Context, schema string, userID int, purpose string) (*OTPVerification, error) {
	query := fmt.Sprintf(`SELECT id, user_id, otp_code, otp_method, destination, status, expires_at, verified_at, attempts, purpose, metadata, created_at
		FROM %s.skaftin_system_otp_verifications
		WHERE user_id = $1 AND status = 'pending'`, pgx.Identifier{schema}.Sanitize())
	args := []any{userID}
	if purpose != "" {
		query += ` AND purpose = $2`
		args = append(args, purpose)
	}
	query += ` ORDER BY created_at DESC LIMIT 1`

	var o OTPVerification
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&o.ID, &o.UserID, &o.OtpCode, &o.OtpMethod, &o.Destination, &o.Status, &o.ExpiresAt, &o.VerifiedAt, &o.Attempts, &o.Purpose, &o.Metadata, &o.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &o, err
}

func (s *Store) ExpirePendingOTPs(ctx context.Context, schema string, userID int, purpose string) error {
	query := fmt.Sprintf(`UPDATE %s.skaftin_system_otp_verifications SET status = 'expired'
		WHERE user_id = $1 AND status = 'pending'`, pgx.Identifier{schema}.Sanitize())
	args := []any{userID}
	if purpose != "" {
		query += ` AND purpose = $2`
		args = append(args, purpose)
	}
	_, err := s.pool.Exec(ctx, query, args...)
	return err
}

func (s *Store) IncrementOTPAttempts(ctx context.Context, schema string, otpID int) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), otpID)
	return err
}

func (s *Store) MarkOTPVerified(ctx context.Context, schema string, otpID int) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_otp_verifications SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), otpID)
	return err
}

func (s *Store) MarkOTPFailed(ctx context.Context, schema string, otpID int) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_otp_verifications SET status = 'failed' WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), otpID)
	return err
}

func (s *Store) GetUserOTPStatus(ctx context.Context, schema string, userID int) ([]OTPVerification, error) {
	otpVerificationsExists, err := s.TableExists(ctx, schema, "skaftin_system_otp_verifications")
	if err != nil {
		return nil, err
	}
	if !otpVerificationsExists {
		// Some project schemas may not have OTP tables yet.
		// Treat this as "no OTP history" instead of a hard failure.
		return []OTPVerification{}, nil
	}

	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(`SELECT id, user_id, otp_code, otp_method, destination, status, expires_at, verified_at, attempts, purpose, created_at
			FROM %s.skaftin_system_otp_verifications WHERE user_id = $1 ORDER BY created_at DESC`,
			pgx.Identifier{schema}.Sanitize()), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]OTPVerification, 0)
	for rows.Next() {
		var o OTPVerification
		if err := rows.Scan(&o.ID, &o.UserID, &o.OtpCode, &o.OtpMethod, &o.Destination, &o.Status, &o.ExpiresAt, &o.VerifiedAt, &o.Attempts, &o.Purpose, &o.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, rows.Err()
}

func (s *Store) ActivateUser(ctx context.Context, schema string, userID int, emailVerified, phoneVerified bool) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET is_active = true, email_verified = $1, phone_verified = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
			pgx.Identifier{schema}.Sanitize()), emailVerified, phoneVerified, userID)
	return err
}

func (s *Store) SetUserMetadata(ctx context.Context, schema string, userID int, key string, value any) error {
	val, _ := json.Marshal(value)
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET metadata = jsonb_set(COALESCE(metadata, '{}'), $1, $2::jsonb) WHERE id = $3`,
			pgx.Identifier{schema}.Sanitize()), "{"+key+"}", string(val), userID)
	return err
}

func (s *Store) RemoveUserMetadataKeys(ctx context.Context, schema string, userID int, keys []string) error {
	query := fmt.Sprintf(`UPDATE %s.skaftin_system_users SET metadata = metadata`, pgx.Identifier{schema}.Sanitize())
	for _, key := range keys {
		query += fmt.Sprintf(` - '%s'`, key)
	}
	query += ` WHERE id = $1`
	_, err := s.pool.Exec(ctx, query, userID)
	return err
}

func (s *Store) SetDeletionSchedule(ctx context.Context, schema string, userID int, reason *string, scheduledAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET deletion_requested_at = CURRENT_TIMESTAMP, deletion_scheduled_at = $1, deletion_reason = $2 WHERE id = $3`,
			pgx.Identifier{schema}.Sanitize()), scheduledAt, reason, userID)
	return err
}

func (s *Store) ClearDeletionSchedule(ctx context.Context, schema string, userID int) error {
	_, err := s.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE %s.skaftin_system_users SET deletion_requested_at = NULL, deletion_scheduled_at = NULL, deletion_reason = NULL WHERE id = $1`,
			pgx.Identifier{schema}.Sanitize()), userID)
	return err
}

// ─── Email/SMS Providers (read-only from auth perspective) ───────────

func (s *Store) GetEmailProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, provider_type, smtp_host, smtp_port, from_email, from_name, is_active, created_at
		FROM skaftin_system_email_providers WHERE project_id = $1 ORDER BY created_at DESC`, strconv.Itoa(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]map[string]any, 0)
	for rows.Next() {
		var id, port int
		var name, provType, host, fromEmail string
		var fromName *string
		var isActive bool
		var createdAt *time.Time
		if err := rows.Scan(&id, &name, &provType, &host, &port, &fromEmail, &fromName, &isActive, &createdAt); err != nil {
			return nil, err
		}
		list = append(list, map[string]any{
			"id": id, "name": name, "provider_type": provType, "smtp_host": host, "smtp_port": port,
			"from_email": fromEmail, "from_name": fromName, "is_active": isActive, "created_at": createdAt,
		})
	}
	return list, rows.Err()
}

func (s *Store) GetSmsProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, provider_type, is_active, created_at
		FROM sms_providers WHERE project_id = $1 ORDER BY created_at DESC`, strconv.Itoa(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]map[string]any, 0)
	for rows.Next() {
		var id int
		var pid, name, provType string
		var isActive bool
		var createdAt *time.Time
		if err := rows.Scan(&id, &pid, &name, &provType, &isActive, &createdAt); err != nil {
			return nil, err
		}
		list = append(list, map[string]any{
			"id": id, "project_id": pid, "name": name, "provider_type": provType, "is_active": isActive, "created_at": createdAt,
		})
	}
	return list, rows.Err()
}

func (s *Store) GetProjectName(ctx context.Context, projectID int) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx, `SELECT name FROM skaftin_system_projects WHERE id = $1`, projectID).Scan(&name)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return name, err
}
