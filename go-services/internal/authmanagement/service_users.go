package authmanagement

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/skaftin/go-services/internal/supertokens"
	"golang.org/x/crypto/bcrypt"
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
