package authmanagement

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/supertokens"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	store *Store
	pool  *pgxpool.Pool
	st    *supertokens.Client
	comms *communications.Service
}

func NewService(pool *pgxpool.Pool, st *supertokens.Client, comms *communications.Service) *Service {
	return &Service{store: NewStore(pool), pool: pool, st: st, comms: comms}
}

func (s *Service) resolveSchema(ctx context.Context, projectID int) (string, error) {
	schema, err := s.store.GetProjectSchema(ctx, projectID)
	if err != nil {
		return "", fmt.Errorf("failed to resolve schema: %w", err)
	}
	if schema == "" {
		return "", fmt.Errorf("project not found")
	}
	return schema, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ─── Auth Settings ───────────────────────────────────────────────────

func (s *Service) GetAuthSettings(ctx context.Context, projectID int) (*AuthSettings, error) {
	as, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if as == nil {
		return s.store.UpsertAuthSettings(ctx, projectID)
	}
	return as, nil
}

func (s *Service) UpdateAuthSettings(ctx context.Context, projectID int, fields map[string]any) (*AuthSettings, error) {
	allowed := map[string]bool{
		"auth_enabled": true, "registration_enabled": true, "email_provider_id": true,
		"sms_provider_id": true, "send_registration_otp": true, "send_welcome_email": true,
		"require_email": true, "require_email_verification": true, "otp_length": true,
		"default_role_id": true, "enable_password_reset": true, "require_otp_for_password_change": true,
		"require_otp_for_account_deletion": true, "allow_duplicate_emails": true,
	}
	filtered := make(map[string]any)
	for k, v := range fields {
		if allowed[k] {
			filtered[k] = v
		}
	}
	return s.store.UpdateAuthSettings(ctx, projectID, filtered)
}

func (s *Service) GetEmailProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	return s.store.GetEmailProviders(ctx, projectID)
}

func (s *Service) GetSmsProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	return s.store.GetSmsProviders(ctx, projectID)
}

func (s *Service) GetAllSessionDurations(ctx context.Context, projectID int) ([]map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetAllSessionDurations(ctx, schema)
}

func (s *Service) GetSessionConfig(ctx context.Context, projectID, roleID int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRole(ctx, schema, roleID)
}

func (s *Service) TestEmailProvider(ctx context.Context, projectID, providerID int, testEmail string) error {
	if s.comms == nil {
		return fmt.Errorf("communications service not available")
	}
	_, err := s.comms.SendEmail(ctx, projectID, providerID, []string{testEmail}, nil, nil,
		"Test Email", "This is a test email from Skaftin", "<p>This is a test email from Skaftin</p>", nil)
	return err
}

func (s *Service) SendVerificationEmail(ctx context.Context, projectID int, schema string, userIDOrEmail string) error {
	return fmt.Errorf("not yet implemented via Go; use Node proxy")
}

func (s *Service) SendPasswordResetEmail(ctx context.Context, projectID int, schema string, userIDOrEmail string) error {
	return fmt.Errorf("not yet implemented via Go; use Node proxy")
}

func (s *Service) VerifyOTPForSettings(ctx context.Context, projectID int, userID int, code string) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	otp, err := s.store.GetPendingOTP(ctx, schema, userID, "")
	if err != nil {
		return err
	}
	if otp == nil {
		return fmt.Errorf("no pending OTP found")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP has expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP code")
	}
	if err := s.store.MarkOTPVerified(ctx, schema, otp.ID); err != nil {
		return err
	}
	return s.store.ActivateUser(ctx, schema, userID, true, true)
}

func (s *Service) TestSmsProvider(ctx context.Context, projectID int, providerID int, phone, message string) error {
	if s.comms == nil {
		return fmt.Errorf("communications service not available")
	}
	_, err := s.comms.SendSMS(ctx, projectID, []communications.SmsMessage{{Content: message, Destination: phone}})
	return err
}

// ─── Roles ───────────────────────────────────────────────────────────

func (s *Service) ListRoles(ctx context.Context, projectID int, includeUserCount bool) ([]Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	roles, err := s.store.ListRoles(ctx, schema, includeUserCount)
	if err != nil {
		return nil, err
	}
	if roles == nil {
		roles = []Role{}
	}
	return roles, nil
}

func (s *Service) GetRole(ctx context.Context, projectID, roleID int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRole(ctx, schema, roleID)
}

func (s *Service) CreateRole(ctx context.Context, projectID int, roleName, roleKey string, description *string, permissions json.RawMessage, sessionDuration int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	existing, err := s.store.GetRoleByKey(ctx, schema, roleKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("role with this key already exists")
	}
	return s.store.CreateRole(ctx, schema, roleName, roleKey, description, permissions, sessionDuration)
}

func (s *Service) UpdateRole(ctx context.Context, projectID, roleID int, fields map[string]any) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("role not found")
	}
	if role.IsSystemRole {
		delete(fields, "role_name")
		delete(fields, "description")
	}
	if len(fields) == 0 {
		return role, nil
	}
	return s.store.UpdateRole(ctx, schema, roleID, fields)
}

func (s *Service) DeleteRole(ctx context.Context, projectID, roleID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return fmt.Errorf("role not found")
	}
	if role.IsSystemRole {
		return fmt.Errorf("cannot delete system role")
	}
	count, err := s.store.CountUsersWithRole(ctx, schema, roleID)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("cannot delete role with %d assigned users", count)
	}
	ok, err := s.store.DeleteRole(ctx, schema, roleID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("role not found")
	}
	return nil
}

func (s *Service) GetRolePermissions(ctx context.Context, projectID, roleID int) (json.RawMessage, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRolePermissions(ctx, schema, roleID)
}

func (s *Service) UpdateRolePermissions(ctx context.Context, projectID, roleID int, perms json.RawMessage) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateRolePermissions(ctx, schema, roleID, perms)
}

func (s *Service) UpdateSessionDuration(ctx context.Context, projectID, roleID, minutes int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateSessionDuration(ctx, schema, roleID, minutes)
}

func (s *Service) VerifyOrgContext(ctx context.Context, projectID, roleID int) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("role not found")
	}

	result := map[string]any{
		"role": map[string]any{
			"id": role.ID, "role_name": role.RoleName, "role_key": role.RoleKey,
			"organisation_field_name": role.OrganisationFieldName,
			"organisation_lookup_table": role.OrganisationLookupTable,
			"organisation_lookup_field": role.OrganisationLookupField,
		},
		"configuration": map[string]any{},
		"status":        "valid",
		"issues":        []string{},
		"scenarios":     []map[string]any{},
	}

	if role.OrganisationFieldName == nil || *role.OrganisationFieldName == "" {
		result["status"] = "incomplete"
		result["issues"] = []string{"No organisation_field_name configured"}
		return result, nil
	}

	fieldName := *role.OrganisationFieldName
	if fieldName == "user_id" {
		result["scenarios"] = []map[string]any{{"type": "user_scoped", "description": "Each user is their own organisation"}}
		return result, nil
	}

	if role.OrganisationLookupTable != nil && *role.OrganisationLookupTable != "" {
		table := *role.OrganisationLookupTable
		exists, _ := s.store.TableExists(ctx, schema, table)
		if !exists {
			result["status"] = "error"
			result["issues"] = []string{fmt.Sprintf("Lookup table %s does not exist", table)}
			return result, nil
		}
		colExists, _ := s.store.ColumnExists(ctx, schema, table, fieldName)
		if !colExists {
			result["status"] = "error"
			result["issues"] = []string{fmt.Sprintf("Column %s not found in table %s", fieldName, table)}
			return result, nil
		}
		result["scenarios"] = []map[string]any{{"type": "junction_table", "table": table, "column": fieldName}}
	} else {
		result["scenarios"] = []map[string]any{{"type": "direct_assignment", "field": fieldName}}
	}

	return result, nil
}

// ─── Custom Fields ───────────────────────────────────────────────────

func (s *Service) ListCustomFields(ctx context.Context, projectID int, includeInactive bool) ([]CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	fields, err := s.store.ListCustomFields(ctx, schema, includeInactive)
	if err != nil {
		return nil, err
	}
	if fields == nil {
		fields = []CustomField{}
	}
	return fields, nil
}

func (s *Service) GetCustomField(ctx context.Context, projectID, fieldID int) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetCustomField(ctx, schema, fieldID)
}

func (s *Service) CreateCustomField(ctx context.Context, projectID int, f CustomField) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	exists, err := s.store.CustomFieldExistsByName(ctx, schema, f.FieldName)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("field with this name already exists")
	}
	if f.FieldType == "reference" && f.ReferenceTable != nil {
		tExists, _ := s.store.TableExists(ctx, schema, *f.ReferenceTable)
		if !tExists {
			return nil, fmt.Errorf("reference table does not exist")
		}
	}
	return s.store.CreateCustomField(ctx, schema, f)
}

func (s *Service) UpdateCustomField(ctx context.Context, projectID, fieldID int, fields map[string]any) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateCustomField(ctx, schema, fieldID, fields)
}

func (s *Service) DeleteCustomField(ctx context.Context, projectID, fieldID int, permanent bool) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.DeleteCustomField(ctx, schema, fieldID, permanent)
}

func (s *Service) ApplyCustomField(ctx context.Context, projectID, fieldID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	field, err := s.store.GetCustomField(ctx, schema, fieldID)
	if err != nil || field == nil {
		return fmt.Errorf("custom field not found")
	}

	colType := "TEXT"
	var defaultVal *string
	switch field.FieldType {
	case "number":
		colType = "NUMERIC"
	case "boolean":
		colType = "BOOLEAN"
		d := "false"
		defaultVal = &d
	case "date":
		colType = "TIMESTAMP"
	case "reference":
		colType = "INTEGER"
	}

	exists, _ := s.store.ColumnExists(ctx, schema, "skaftin_system_users", field.FieldName)
	if exists {
		return fmt.Errorf("column %s already exists on users table", field.FieldName)
	}

	if err := s.store.ApplyCustomFieldColumn(ctx, schema, field.FieldName, colType, field.IsRequired, defaultVal); err != nil {
		return fmt.Errorf("failed to add column: %w", err)
	}

	if field.FieldType == "reference" && field.ReferenceTable != nil && field.ReferenceColumn != nil {
		if err := s.store.AddForeignKey(ctx, schema, field.FieldName, *field.ReferenceTable, *field.ReferenceColumn); err != nil {
			slog.Warn("failed to add FK constraint (non-fatal)", "error", err)
		}
	}

	return nil
}

func (s *Service) GetAvailableTables(ctx context.Context, projectID int) ([]map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetAvailableTables(ctx, schema)
}

// ─── Users ───────────────────────────────────────────────────────────

func (s *Service) ListUsers(ctx context.Context, projectID int, filters map[string]any, limit, offset int) ([]AppUser, int, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, 0, err
	}
	return s.store.ListUsers(ctx, schema, filters, limit, offset)
}

func (s *Service) GetUser(ctx context.Context, projectID, userID int) (*AppUser, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetUser(ctx, schema, userID)
}

func (s *Service) GetUsersByRole(ctx context.Context, projectID, roleID int) ([]AppUser, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetUsersByRole(ctx, schema, roleID)
}

func (s *Service) GetUserPassword(ctx context.Context, projectID, userID int) (*string, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetUserPassword(ctx, schema, userID)
}

func (s *Service) SetUserPassword(ctx context.Context, projectID, userID int, password string) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	if err := s.store.SetUserPassword(ctx, schema, userID, string(hash)); err != nil {
		return err
	}
	user, err := s.store.GetUser(ctx, schema, userID)
	if err != nil || user == nil {
		return err
	}
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		_, _ = s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: *user.SupertokensUserID, Password: password,
		})
	} else if user.Email != nil && *user.Email != "" {
		stEmail := supertokens.CreateProjectScopedEmail(*user.Email, projectID)
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			_, _ = s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
				RecipeUserID: users[0].ID, Password: password,
			})
			_ = s.store.SetUserSuperTokensID(ctx, schema, userID, users[0].ID)
		} else {
			resp, _ := s.st.SignUp(ctx, "public", stEmail, password)
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				_ = s.store.SetUserSuperTokensID(ctx, schema, userID, resp.User.ID)
			}
		}
	}
	return nil
}

func (s *Service) CreateUserAdmin(ctx context.Context, projectID int, data map[string]any) (*AppUser, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.CreateUser(ctx, schema, data)
}

func (s *Service) UpdateUser(ctx context.Context, projectID, userID int, fields map[string]any) (*AppUser, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdateUser(ctx, schema, userID, fields); err != nil {
		return nil, err
	}
	return s.store.GetUser(ctx, schema, userID)
}

func (s *Service) DeleteUser(ctx context.Context, projectID, userID int, permanent bool) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	user, err := s.store.GetUser(ctx, schema, userID)
	if err != nil || user == nil {
		return fmt.Errorf("user not found")
	}
	if permanent {
		if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
			_ = s.st.DeleteUser(ctx, *user.SupertokensUserID)
		}
		return s.store.HardDeleteUser(ctx, schema, userID)
	}
	return s.store.SoftDeleteUser(ctx, schema, userID)
}

func (s *Service) AssignRole(ctx context.Context, projectID, userID, roleID int, assignedBy string) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return fmt.Errorf("role not found")
	}
	return s.store.AssignRole(ctx, schema, userID, roleID, assignedBy)
}

func (s *Service) RemoveRole(ctx context.Context, projectID, userID, roleID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	ok, err := s.store.RemoveRole(ctx, schema, userID, roleID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("role assignment not found")
	}
	return nil
}

func (s *Service) GetUserOTPStatus(ctx context.Context, projectID, userID int) ([]OTPVerification, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetUserOTPStatus(ctx, schema, userID)
}

func (s *Service) ResendOTP(ctx context.Context, projectID, userID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	user, err := s.store.GetUser(ctx, schema, userID)
	if err != nil || user == nil {
		return fmt.Errorf("user not found")
	}
	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return err
	}
	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, userID, "")
	code, err := GenerateOTP(otpLen)
	if err != nil {
		return err
	}
	var method, destination string
	if user.Email != nil && *user.Email != "" {
		method = "email"
		destination = *user.Email
	} else if user.Phone != nil && *user.Phone != "" {
		method = "sms"
		destination = *user.Phone
	} else {
		return fmt.Errorf("user has no email or phone")
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	return s.store.CreateOTP(ctx, schema, userID, code, method, destination, expiresAt, "", nil)
}

func (s *Service) ManuallyVerifyUser(ctx context.Context, projectID, userID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, userID, "")
	return s.store.ActivateUser(ctx, schema, userID, true, true)
}

func (s *Service) ExportUsers(ctx context.Context, projectID int) (string, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return "", err
	}
	tables := []string{"skaftin_system_users", "skaftin_system_roles", "skaftin_system_user_roles", "skaftin_system_user_custom_fields", "skaftin_system_otp_verifications"}
	var sb strings.Builder
	sb.WriteString("-- Skaftin User Export\n")
	sb.WriteString(fmt.Sprintf("-- Schema: %s\n", schema))
	sb.WriteString(fmt.Sprintf("-- Date: %s\n\n", time.Now().Format(time.RFC3339)))

	for _, table := range tables {
		exists, _ := s.store.TableExists(ctx, schema, table)
		if !exists {
			continue
		}
		query := fmt.Sprintf(`SELECT * FROM %s.%s`, pgx.Identifier{schema}.Sanitize(), pgx.Identifier{table}.Sanitize())
		rows, err := s.pool.Query(ctx, query)
		if err != nil {
			continue
		}

		descs := rows.FieldDescriptions()
		colNames := make([]string, len(descs))
		for i, d := range descs {
			colNames[i] = string(d.Name)
		}

		sb.WriteString(fmt.Sprintf("DELETE FROM %s;\n", table))

		for rows.Next() {
			vals, err := rows.Values()
			if err != nil {
				continue
			}
			valStrs := make([]string, len(vals))
			for i, v := range vals {
				if v == nil {
					valStrs[i] = "NULL"
				} else {
					switch vt := v.(type) {
					case bool:
						valStrs[i] = fmt.Sprintf("%t", vt)
					case time.Time:
						valStrs[i] = fmt.Sprintf("'%s'", vt.Format("2006-01-02 15:04:05"))
					case json.RawMessage:
						valStrs[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(string(vt), "'", "''"))
					case map[string]any, []any:
						b, _ := json.Marshal(vt)
						valStrs[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(string(b), "'", "''"))
					default:
						str := fmt.Sprintf("%v", v)
						valStrs[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(str, "'", "''"))
					}
				}
			}
			sb.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s);\n",
				table, strings.Join(colNames, ", "), strings.Join(valStrs, ", ")))
		}
		rows.Close()
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

func (s *Service) ImportUsers(ctx context.Context, projectID int, sqlContent string, clearExisting bool) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", pgx.Identifier{schema}.Sanitize()))
	if err != nil {
		return nil, err
	}

	if clearExisting {
		tx.Exec(ctx, "DELETE FROM skaftin_system_user_roles")
		tx.Exec(ctx, "DELETE FROM skaftin_system_otp_verifications")
		tx.Exec(ctx, "DELETE FROM skaftin_system_users")
	}

	statements := splitSQL(sqlContent)
	successCount := 0
	errorCount := 0
	var errors []string

	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}
		_, err := tx.Exec(ctx, stmt)
		if err != nil {
			errorCount++
			if len(errors) < 10 {
				errors = append(errors, err.Error())
			}
		} else {
			successCount++
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return map[string]any{
		"success_count": successCount,
		"error_count":   errorCount,
		"errors":        errors,
	}, nil
}

func splitSQL(content string) []string {
	var stmts []string
	var current strings.Builder
	inQuote := false
	var quoteChar rune

	for _, ch := range content {
		if inQuote {
			current.WriteRune(ch)
			if ch == quoteChar {
				inQuote = false
			}
			continue
		}
		if ch == '\'' || ch == '"' {
			inQuote = true
			quoteChar = ch
			current.WriteRune(ch)
			continue
		}
		if ch == ';' {
			stmts = append(stmts, current.String())
			current.Reset()
			continue
		}
		current.WriteRune(ch)
	}
	if s := current.String(); strings.TrimSpace(s) != "" {
		stmts = append(stmts, s)
	}
	return stmts
}

// ─── App Auth ────────────────────────────────────────────────────────

func (s *Service) Register(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if settings != nil && !settings.RegistrationEnabled {
		return nil, fmt.Errorf("registration is disabled")
	}
	if settings != nil && !settings.AuthEnabled {
		return nil, fmt.Errorf("authentication is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	name, _ := body["name"].(string)
	password, _ := body["password"].(string)

	if email == "" && phone == "" {
		return nil, fmt.Errorf("email or phone is required")
	}
	if password == "" {
		return nil, fmt.Errorf("password is required")
	}

	if email != "" {
		existing, _ := s.store.GetUserByEmail(ctx, schema, email)
		if existing != nil {
			return nil, fmt.Errorf("email already registered")
		}
	}

	var stEmail string
	if email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(email, projectID)
	} else {
		stEmail = supertokens.CreatePhoneScopedEmail(phone, projectID)
	}

	signUpResp, err := s.st.SignUp(ctx, "public", stEmail, password)
	if err != nil {
		return nil, fmt.Errorf("SuperTokens signup failed: %w", err)
	}
	if signUpResp.Status == "EMAIL_ALREADY_EXISTS_ERROR" {
		return nil, fmt.Errorf("email already registered in authentication system")
	}
	if signUpResp.Status != "OK" || signUpResp.User == nil {
		return nil, fmt.Errorf("signup failed: %s", signUpResp.Status)
	}

	userData := map[string]any{
		"supertokens_user_id": signUpResp.User.ID,
		"name":                name,
		"email":               nilIfEmpty(email),
		"phone":               nilIfEmpty(phone),
		"is_active":           true,
	}
	if v, ok := body["metadata"]; ok {
		b, _ := json.Marshal(v)
		userData["metadata"] = string(b)
	}
	if v, ok := body["custom_field_1"]; ok {
		userData["custom_field_1"] = v
	}
	if v, ok := body["custom_field_2"]; ok {
		userData["custom_field_2"] = v
	}

	user, err := s.store.CreateUser(ctx, schema, userData)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign default role
	if settings != nil && settings.DefaultRoleID != nil {
		_ = s.store.AssignRole(ctx, schema, user.ID, *settings.DefaultRoleID, "system")
	}
	if roleID, ok := body["role_id"]; ok {
		if rid, ok := roleID.(float64); ok {
			_ = s.store.AssignRole(ctx, schema, user.ID, int(rid), "system")
		}
	}

	// OTP if configured
	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	if settings != nil && (settings.SendRegistrationEmail || settings.SendRegistrationSMS) {
		code, _ := GenerateOTP(otpLen)
		var method, dest string
		if email != "" {
			method = "email"
			dest = email
		} else {
			method = "sms"
			dest = phone
		}
		expiresAt := time.Now().Add(10 * time.Minute)
		_ = s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "", nil)
		userData["is_active"] = false
		_ = s.store.UpdateUser(ctx, schema, user.ID, map[string]any{"is_active": false})
	}

	// Create session
	roles, _ := s.store.GetUserRoles(ctx, schema, user.ID)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, roles)
	rolesJSON, _ := json.Marshal(roles)

	payload := SessionPayload{
		ProjectID:        projectID,
		AppUserID:        user.ID,
		Email:            user.Email,
		Roles:            rolesJSON,
		OrganisationName: orgCtx.OrganisationName,
		OrganisationID:   orgCtx.OrganisationID,
		IsAdmin:          orgCtx.IsAdmin,
	}

	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID:                signUpResp.User.ID,
		UserDataInAccessToken: payload,
	})
	if err != nil {
		slog.Warn("failed to create session", "error", err)
	}

	result := map[string]any{
		"user":    user,
		"message": "User registered successfully",
	}
	if sessionResp != nil {
		result["accessToken"] = sessionResp.AccessToken.Token
	}
	return result, nil
}

func (s *Service) Login(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if settings != nil && !settings.AuthEnabled {
		return nil, fmt.Errorf("authentication is disabled")
	}

	method, _ := body["method"].(string)
	if method == "" {
		method = "email"
	}
	credential, _ := body["email"].(string)
	if credential == "" {
		credential, _ = body["phone"].(string)
	}
	if credential == "" {
		credential, _ = body["credential"].(string)
	}
	password, _ := body["password"].(string)

	if credential == "" || password == "" {
		return nil, fmt.Errorf("credentials are required")
	}

	user, err := s.store.GetUserByCredential(ctx, schema, method, credential)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	signInResp, err := s.st.SignIn(ctx, "public", stEmail, password)
	if err != nil || signInResp.Status == "WRONG_CREDENTIALS_ERROR" {
		// Try legacy bcrypt fallback
		if user.Password != nil && *user.Password != "" {
			if bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(password)) == nil {
				resp, _ := s.st.SignUp(ctx, "public", stEmail, password)
				if resp != nil && resp.Status == "OK" && resp.User != nil {
					_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
					_ = s.store.ClearUserPassword(ctx, schema, user.ID)
					signInResp, _ = s.st.SignIn(ctx, "public", stEmail, password)
				}
			}
		}
		if signInResp == nil || signInResp.Status != "OK" {
			return nil, fmt.Errorf("invalid credentials")
		}
	}

	if signInResp.User != nil {
		stID := signInResp.User.ID
		if user.SupertokensUserID == nil || *user.SupertokensUserID != stID {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stID)
		}
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)

	payload := SessionPayload{
		ProjectID:        projectID,
		AppUserID:        user.ID,
		Email:            user.Email,
		Roles:            user.Roles,
		OrganisationName: orgCtx.OrganisationName,
		OrganisationID:   orgCtx.OrganisationID,
		IsAdmin:          orgCtx.IsAdmin,
	}

	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID:                signInResp.User.ID,
		UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	result := map[string]any{
		"user":        user,
		"accessToken": sessionResp.AccessToken.Token,
		"message":     "Login successful",
	}
	return result, nil
}

func (s *Service) SingleCredentialLogin(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	method, _ := body["method"].(string)
	if method == "" {
		method = "email"
	}
	credential, _ := body["credential"].(string)
	if credential == "" {
		credential, _ = body["email"].(string)
	}
	if credential == "" {
		return nil, fmt.Errorf("credential is required")
	}

	user, err := s.store.GetUserByCredential(ctx, schema, method, credential)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	var stUserID string
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		stUserID = *user.SupertokensUserID
	} else {
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			stUserID = users[0].ID
		} else {
			pw := randomHex(32)
			resp, _ := s.st.SignUp(ctx, "public", stEmail, pw)
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				stUserID = resp.User.ID
			}
		}
		if stUserID != "" {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stUserID)
		}
	}

	if stUserID == "" {
		return nil, fmt.Errorf("failed to resolve authentication identity")
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)
	payload := SessionPayload{
		ProjectID: projectID, AppUserID: user.ID, Email: user.Email,
		Roles: user.Roles, OrganisationName: orgCtx.OrganisationName,
		OrganisationID: orgCtx.OrganisationID, IsAdmin: orgCtx.IsAdmin,
	}
	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID: stUserID, UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	return map[string]any{"user": user, "accessToken": sessionResp.AccessToken.Token, "message": "Login successful"}, nil
}

func (s *Service) RequestOTPLogin(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return err
	}
	if settings != nil && !settings.AuthEnabled {
		return fmt.Errorf("authentication is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil // Don't reveal if user exists
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "otp_login")
	code, _ := GenerateOTP(otpLen)
	var method, dest string
	if email != "" {
		method = "email"
		dest = email
	} else {
		method = "sms"
		dest = phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	return s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "otp_login", nil)
}

func (s *Service) VerifyOTPLogin(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByCredential(ctx, schema, "email", email)
	} else if phone != "" {
		user, _ = s.store.GetUserByCredential(ctx, schema, "phone", phone)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	otp, err := s.store.GetPendingOTP(ctx, schema, user.ID, "otp_login")
	if err != nil || otp == nil {
		return nil, fmt.Errorf("no pending OTP found")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("OTP has expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return nil, fmt.Errorf("invalid OTP code")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	var stUserID string
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		stUserID = *user.SupertokensUserID
	} else {
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			stUserID = users[0].ID
		} else {
			resp, _ := s.st.SignUp(ctx, "public", stEmail, randomHex(32))
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				stUserID = resp.User.ID
			}
		}
		if stUserID != "" {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stUserID)
		}
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)
	payload := SessionPayload{
		ProjectID: projectID, AppUserID: user.ID, Email: user.Email,
		Roles: user.Roles, OrganisationName: orgCtx.OrganisationName,
		OrganisationID: orgCtx.OrganisationID, IsAdmin: orgCtx.IsAdmin,
	}
	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID: stUserID, UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	return map[string]any{"user": user, "accessToken": sessionResp.AccessToken.Token, "message": "OTP verified successfully"}, nil
}

func (s *Service) Verify(ctx context.Context, projectID int, accessToken string) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	sessionResp, err := s.st.GetSession(ctx, accessToken)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired session")
	}
	stUserID := sessionResp.Session.UserID
	user, err := s.store.GetUserBySuperTokensID(ctx, schema, stUserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}
	return map[string]any{"user": user, "message": "Token is valid"}, nil
}

func (s *Service) Logout(ctx context.Context, accessToken string) error {
	sessionResp, err := s.st.GetSession(ctx, accessToken)
	if err != nil {
		return nil
	}
	return s.st.RevokeSession(ctx, sessionResp.Session.Handle)
}

func (s *Service) VerifyOTP(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	userIDRaw, _ := body["user_id"].(float64)
	userID := int(userIDRaw)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}
	if userID == 0 || code == "" {
		return fmt.Errorf("user_id and otp are required")
	}

	otp, err := s.store.GetPendingOTP(ctx, schema, userID, "")
	if err != nil || otp == nil {
		return fmt.Errorf("no pending OTP found")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP has expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP code")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)
	return s.store.ActivateUser(ctx, schema, userID, true, true)
}

func (s *Service) SendForgotPasswordOTP(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)
	if settings != nil && !settings.EnablePasswordReset {
		return fmt.Errorf("password reset is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil // Don't reveal
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_reset")
	code, _ := GenerateOTP(otpLen)
	var method, dest string
	if email != "" {
		method = "email"
		dest = email
	} else {
		method = "sms"
		dest = phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	return s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "password_reset", nil)
}

func (s *Service) VerifyForgotPasswordOTP(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, user.ID, "password_reset")
	if otp == nil {
		return nil, fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("OTP expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return nil, fmt.Errorf("invalid OTP")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	resetToken := randomHex(32)
	expiresAt := time.Now().Add(15 * time.Minute).Format(time.RFC3339)
	_ = s.store.SetUserMetadata(ctx, schema, user.ID, "password_reset_token", resetToken)
	_ = s.store.SetUserMetadata(ctx, schema, user.ID, "password_reset_expires_at", expiresAt)

	return map[string]any{"reset_token": resetToken, "expires_in_minutes": 15}, nil
}

func (s *Service) ResetPassword(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	resetToken, _ := body["reset_token"].(string)
	newPassword, _ := body["new_password"].(string)

	if resetToken == "" || newPassword == "" {
		return fmt.Errorf("reset_token and new_password are required")
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	var metadata map[string]any
	if user.Metadata != nil {
		_ = json.Unmarshal(user.Metadata, &metadata)
	}
	storedToken, _ := metadata["password_reset_token"].(string)
	storedExpiry, _ := metadata["password_reset_expires_at"].(string)
	if storedToken == "" || storedToken != resetToken {
		return fmt.Errorf("invalid reset token")
	}
	expiryTime, _ := time.Parse(time.RFC3339, storedExpiry)
	if time.Now().After(expiryTime) {
		return fmt.Errorf("reset token expired")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		_ = s.st.DeleteUser(ctx, *user.SupertokensUserID)
	}

	resp, _ := s.st.SignUp(ctx, "public", stEmail, newPassword)
	if resp != nil && resp.Status == "OK" && resp.User != nil {
		_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
	}

	_ = s.store.RemoveUserMetadataKeys(ctx, schema, user.ID, []string{"password_reset_token", "password_reset_expires_at"})
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_reset")
	return nil
}

func (s *Service) ChangePasswordRequest(ctx context.Context, projectID, appUserID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)

	oldPassword, _ := body["old_password"].(string)
	newPassword, _ := body["new_password"].(string)
	if oldPassword == "" || newPassword == "" {
		return nil, fmt.Errorf("old_password and new_password are required")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	signInResp, err := s.st.SignIn(ctx, "public", stEmail, oldPassword)
	if err != nil || signInResp.Status != "OK" {
		return nil, fmt.Errorf("current password is incorrect")
	}

	requireOTP := settings != nil && settings.RequireOtpForPasswordChange
	if !requireOTP {
		_, err := s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: signInResp.User.ID, Password: newPassword,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to update password: %w", err)
		}
		return map[string]any{"message": "Password changed successfully"}, nil
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_change")
	code, _ := GenerateOTP(otpLen)
	metadata, _ := json.Marshal(map[string]string{"new_password": newPassword})
	var method, dest string
	if user.Email != nil && *user.Email != "" {
		method = "email"
		dest = *user.Email
	} else if user.Phone != nil && *user.Phone != "" {
		method = "sms"
		dest = *user.Phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	_ = s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "password_change", metadata)
	return map[string]any{"message": "OTP sent for password change verification", "requires_otp": true}, nil
}

func (s *Service) VerifyPasswordChangeOTP(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return fmt.Errorf("user not found")
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, appUserID, "password_change")
	if otp == nil {
		return fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) || otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP expired or too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP")
	}

	var meta map[string]string
	_ = json.Unmarshal(otp.Metadata, &meta)
	newPw := meta["new_password"]
	if newPw == "" {
		return fmt.Errorf("new password not found in OTP metadata")
	}

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		_, err := s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: *user.SupertokensUserID, Password: newPw,
		})
		if err != nil {
			return fmt.Errorf("failed to update password: %w", err)
		}
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "password_change")
	return nil
}

func (s *Service) RequestAccountDeletion(ctx context.Context, projectID, appUserID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)

	password, _ := body["password"].(string)
	reason, _ := body["reason"].(string)

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" && password != "" {
		var stEmail string
		if user.Email != nil && *user.Email != "" {
			stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
		} else if user.Phone != nil && *user.Phone != "" {
			stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
		}
		resp, _ := s.st.SignIn(ctx, "public", stEmail, password)
		if resp == nil || resp.Status != "OK" {
			return nil, fmt.Errorf("incorrect password")
		}
	}

	deletionDate := time.Now().AddDate(0, 0, 7)
	requireOTP := settings != nil && settings.RequireOtpForAccountDeletion

	if !requireOTP {
		_ = s.store.SetDeletionSchedule(ctx, schema, appUserID, &reason, deletionDate)
		return map[string]any{"message": "Account deletion scheduled", "deletion_date": deletionDate}, nil
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "account_deletion")
	code, _ := GenerateOTP(otpLen)
	meta, _ := json.Marshal(map[string]any{"reason": reason, "deletion_date": deletionDate})
	var method, dest string
	if user.Email != nil && *user.Email != "" {
		method = "email"
		dest = *user.Email
	} else if user.Phone != nil && *user.Phone != "" {
		method = "sms"
		dest = *user.Phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	_ = s.store.CreateOTP(ctx, schema, appUserID, code, method, dest, expiresAt, "account_deletion", meta)
	return map[string]any{"message": "OTP sent for account deletion verification", "requires_otp": true}, nil
}

func (s *Service) VerifyAccountDeletionOTP(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, appUserID, "account_deletion")
	if otp == nil {
		return fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) || otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP expired or too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	var meta map[string]any
	_ = json.Unmarshal(otp.Metadata, &meta)
	reason, _ := meta["reason"].(string)
	deletionDate := time.Now().AddDate(0, 0, 7)

	_ = s.store.SetDeletionSchedule(ctx, schema, appUserID, &reason, deletionDate)
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "account_deletion")
	return nil
}

func (s *Service) CancelAccountDeletion(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return fmt.Errorf("user not found")
	}
	if user.DeletionScheduledAt == nil {
		return fmt.Errorf("no deletion scheduled")
	}

	password, _ := body["password"].(string)
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" && password != "" {
		var stEmail string
		if user.Email != nil && *user.Email != "" {
			stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
		} else if user.Phone != nil && *user.Phone != "" {
			stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
		}
		resp, _ := s.st.SignIn(ctx, "public", stEmail, password)
		if resp == nil || resp.Status != "OK" {
			return fmt.Errorf("incorrect password")
		}
	}

	return s.store.ClearDeletionSchedule(ctx, schema, appUserID)
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
