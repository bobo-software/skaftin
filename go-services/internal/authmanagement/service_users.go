package authmanagement

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/skaftin/go-services/internal/supertokens"
	"golang.org/x/crypto/bcrypt"
)

var (
	blockCommentPattern   = regexp.MustCompile(`(?s)/\*.*?\*/`)
	userRolesInsertRE     = regexp.MustCompile(`(?i)\bINSERT\s+INTO\s+skaftin_system_user_roles\b`)
	appUserIDColumnNameRE = regexp.MustCompile(`(?i)\bapp_user_id\b`)
	userIDColumnNameRE    = regexp.MustCompile(`(?i)\buser_id\b`)
)

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
		tablesToClear := []string{
			"skaftin_system_user_roles",
			"skaftin_system_otp_verifications",
			"skaftin_system_user_custom_fields",
			"skaftin_system_roles",
			"skaftin_system_users",
		}
		for _, table := range tablesToClear {
			exists, tableErr := tableExistsInSchema(ctx, tx, schema, table)
			if tableErr != nil {
				return nil, tableErr
			}
			if !exists {
				continue
			}
			if _, execErr := tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s", pgx.Identifier{table}.Sanitize())); execErr != nil {
				return nil, execErr
			}
		}
	}

	statements := prepareImportStatements(sqlContent)
	successCount := 0
	errorCount := 0
	var errors []string

	userRoleUserIDColumn, err := resolveUserRoleUserIDColumn(ctx, tx, schema)
	if err != nil {
		return nil, err
	}

	for i, stmt := range statements {
		stmt = rewriteUserRoleInsertStatement(stmt, userRoleUserIDColumn)
		savepointName := fmt.Sprintf("import_stmt_%d", i)
		if _, err := tx.Exec(ctx, fmt.Sprintf("SAVEPOINT %s", savepointName)); err != nil {
			return nil, err
		}
		_, execErr := tx.Exec(ctx, stmt)
		if execErr != nil {
			_, _ = tx.Exec(ctx, fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", savepointName))
			_, _ = tx.Exec(ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", savepointName))
			errorCount++
			if len(errors) < 10 {
				errors = append(errors, fmt.Sprintf("statement %d: %v", i+1, execErr))
			}
			continue
		}
		if _, err := tx.Exec(ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", savepointName)); err != nil {
			return nil, err
		}
		successCount++
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	message := fmt.Sprintf("Successfully imported %d SQL statements", successCount)
	if errorCount > 0 {
		message = fmt.Sprintf("Executed %d statements, %d failed", successCount, errorCount)
	}

	return map[string]any{
		"successCount":  successCount,
		"errorCount":    errorCount,
		"success_count": successCount,
		"error_count":   errorCount,
		"errors":        errors,
		"message":       message,
	}, nil
}

func tableExistsInSchema(ctx context.Context, tx pgx.Tx, schema, table string) (bool, error) {
	var exists bool
	err := tx.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = $1 AND table_name = $2
		)`,
		schema,
		table,
	).Scan(&exists)
	return exists, err
}

func resolveUserRoleUserIDColumn(ctx context.Context, tx pgx.Tx, schema string) (string, error) {
	rows, err := tx.Query(
		ctx,
		`SELECT column_name
		 FROM information_schema.columns
		 WHERE table_schema = $1
		   AND table_name = 'skaftin_system_user_roles'
		   AND column_name IN ('app_user_id', 'user_id')`,
		schema,
	)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns := map[string]bool{}
	for rows.Next() {
		var column string
		if scanErr := rows.Scan(&column); scanErr != nil {
			return "", scanErr
		}
		columns[strings.ToLower(column)] = true
	}
	if rows.Err() != nil {
		return "", rows.Err()
	}
	if columns["app_user_id"] {
		return "app_user_id", nil
	}
	if columns["user_id"] {
		return "user_id", nil
	}
	return "", nil
}

func rewriteUserRoleInsertStatement(stmt, userRoleUserIDColumn string) string {
	if userRoleUserIDColumn == "" || !userRolesInsertRE.MatchString(stmt) {
		return stmt
	}
	if userRoleUserIDColumn == "user_id" {
		return appUserIDColumnNameRE.ReplaceAllString(stmt, "user_id")
	}
	return userIDColumnNameRE.ReplaceAllString(stmt, "app_user_id")
}

func shouldSkipImportStatement(stmt string) bool {
	normalized := strings.ToUpper(strings.Join(strings.Fields(stmt), " "))
	switch {
	case normalized == "BEGIN":
		return true
	case normalized == "COMMIT":
		return true
	case normalized == "ROLLBACK":
		return true
	case strings.HasPrefix(normalized, "SAVEPOINT "):
		return true
	case strings.HasPrefix(normalized, "RELEASE SAVEPOINT "):
		return true
	case strings.HasPrefix(normalized, "ROLLBACK TO SAVEPOINT "):
		return true
	case strings.HasPrefix(normalized, "SET SEARCH_PATH "):
		return true
	default:
		return false
	}
}

func prepareImportStatements(sqlContent string) []string {
	cleaned := stripLineCommentsOutsideQuotes(sqlContent)
	cleaned = blockCommentPattern.ReplaceAllString(cleaned, "")

	rawStatements := splitSQL(cleaned)
	statements := make([]string, 0, len(rawStatements))
	for _, stmt := range rawStatements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" || shouldSkipImportStatement(trimmed) {
			continue
		}
		statements = append(statements, trimmed)
	}

	return statements
}

func stripLineCommentsOutsideQuotes(input string) string {
	lines := strings.Split(input, "\n")
	for idx, line := range lines {
		inSingleQuote := false
		inDoubleQuote := false
		commentPos := -1
		for i := 0; i < len(line)-1; i++ {
			ch := line[i]
			next := line[i+1]
			if ch == '\'' && !inDoubleQuote {
				if inSingleQuote && next == '\'' {
					i++
					continue
				}
				inSingleQuote = !inSingleQuote
				continue
			}
			if ch == '"' && !inSingleQuote {
				inDoubleQuote = !inDoubleQuote
				continue
			}
			if ch == '-' && next == '-' && !inSingleQuote && !inDoubleQuote {
				commentPos = i
				break
			}
		}
		if commentPos >= 0 {
			lines[idx] = line[:commentPos]
		}
	}
	return strings.Join(lines, "\n")
}

func splitSQL(content string) []string {
	var stmts []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	inEscapeString := false

	for i := 0; i < len(content); i++ {
		ch := content[i]
		next := byte(0)
		if i+1 < len(content) {
			next = content[i+1]
		}

		if inEscapeString && ch == '\\' {
			current.WriteByte(ch)
			if next != 0 {
				current.WriteByte(next)
				i++
			}
			continue
		}

		if !inSingleQuote && !inDoubleQuote && ch == 'E' && next == '\'' {
			inEscapeString = true
			inSingleQuote = true
			current.WriteByte(ch)
			current.WriteByte(next)
			i++
			continue
		}

		if ch == '\'' && !inDoubleQuote {
			if inEscapeString && next == '\'' {
				inEscapeString = false
				inSingleQuote = false
				current.WriteByte(ch)
				current.WriteByte(next)
				i++
				continue
			}
			if !inEscapeString && inSingleQuote && next == '\'' {
				current.WriteByte(ch)
				current.WriteByte(next)
				i++
				continue
			}
			inSingleQuote = !inSingleQuote
			current.WriteByte(ch)
			continue
		}

		if ch == '"' && !inSingleQuote {
			inDoubleQuote = !inDoubleQuote
			current.WriteByte(ch)
			continue
		}

		if ch == ';' && !inSingleQuote && !inDoubleQuote {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				stmts = append(stmts, stmt)
			}
			current.Reset()
			continue
		}

		current.WriteByte(ch)
	}

	if stmt := strings.TrimSpace(current.String()); stmt != "" {
		stmts = append(stmts, stmt)
	}
	return stmts
}
