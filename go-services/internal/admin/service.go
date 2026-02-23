package admin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/supertokens"
)

var ErrUserNotFound = errors.New("user not found")

type Service struct {
	pool *pgxpool.Pool
	st   *supertokens.Client
}

func NewService(pool *pgxpool.Pool, st *supertokens.Client) *Service {
	return &Service{pool: pool, st: st}
}

func (s *Service) SearchUsersByEmail(ctx context.Context, email string) ([]supertokens.CoreUser, error) {
	return s.st.ListUsersByAccountInfo(ctx, "public", email)
}

func (s *Service) DeleteUserByID(ctx context.Context, userID string) error {
	return s.st.DeleteUser(ctx, userID)
}

func (s *Service) DeleteUsersByEmail(ctx context.Context, email string) ([]string, error) {
	users, err := s.st.ListUsersByAccountInfo(ctx, "public", email)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, ErrUserNotFound
	}

	deleted := make([]string, 0, len(users))
	for _, u := range users {
		if err := s.st.DeleteUser(ctx, u.ID); err != nil {
			return nil, err
		}
		deleted = append(deleted, u.ID)
	}

	return deleted, nil
}

func (s *Service) CheckEmail(ctx context.Context, email string) (bool, map[string]any, error) {
	users, err := s.st.ListUsersByAccountInfo(ctx, "public", email)
	if err != nil {
		return false, nil, err
	}
	if len(users) == 0 {
		return false, nil, nil
	}

	user := users[0]
	result := map[string]any{
		"id":         user.ID,
		"email":      email,
		"timeJoined": toISOTime(user.TimeJoined),
	}
	if len(user.Emails) > 0 && user.Emails[0] != "" {
		result["email"] = user.Emails[0]
	}

	return true, result, nil
}

func (s *Service) CompleteUserCleanup(ctx context.Context, email string, projectID *int) CleanupResult {
	result := CleanupResult{
		Success:                true,
		DeletedFromSuperTokens: false,
		DeletedFromAppUsers:    false,
		DeletedRoleAssignments: 0,
		Errors:                 []string{},
	}

	users, err := s.st.ListUsersByAccountInfo(ctx, "public", email)
	if err != nil {
		result.Success = false
		result.Errors = append(result.Errors, fmt.Sprintf("cleanup failed: %v", err))
		return result
	}

	for _, u := range users {
		if err := s.st.DeleteUser(ctx, u.ID); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to delete SuperTokens user %s: %v", u.ID, err))
			result.Success = false
			continue
		}
		result.DeletedFromSuperTokens = true
	}

	schemas, err := s.resolveSchemas(ctx, projectID)
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
		result.Success = false
		return result
	}

	for _, schema := range schemas {
		deletedUser, deletedRoles, delErr := s.deleteUserFromProjectSchema(ctx, schema, email)
		if deletedUser {
			result.DeletedFromAppUsers = true
		}
		result.DeletedRoleAssignments += deletedRoles
		if delErr != nil {
			result.Errors = append(result.Errors, delErr.Error())
		}
	}

	if len(result.Errors) > 0 {
		result.Success = false
	}
	return result
}

func (s *Service) resolveSchemas(ctx context.Context, projectID *int) ([]string, error) {
	if projectID != nil {
		var schema string
		if err := s.pool.QueryRow(ctx, "SELECT schema_name FROM skaftin_system_projects WHERE id = $1", *projectID).Scan(&schema); err != nil {
			return nil, fmt.Errorf("failed to resolve schema for project %d: %w", *projectID, err)
		}
		return []string{schema}, nil
	}

	rows, err := s.pool.Query(ctx, `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'project_%'`)
	if err != nil {
		return nil, fmt.Errorf("failed to list project schemas: %w", err)
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var schema string
		if err := rows.Scan(&schema); err != nil {
			return nil, fmt.Errorf("failed to scan project schema: %w", err)
		}
		schemas = append(schemas, schema)
	}
	return schemas, rows.Err()
}

func (s *Service) deleteUserFromProjectSchema(ctx context.Context, schemaName, email string) (bool, int, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, 0, fmt.Errorf("failed to start transaction for %s: %w", schemaName, err)
	}
	defer tx.Rollback(ctx)

	usersTable := pgx.Identifier{schemaName, "skaftin_system_users"}.Sanitize()
	rolesTable := pgx.Identifier{schemaName, "skaftin_system_user_roles"}.Sanitize()

	var userID int
	if err := tx.QueryRow(ctx, fmt.Sprintf("SELECT id FROM %s WHERE email = $1", usersTable), email).Scan(&userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if err := tx.Commit(ctx); err != nil {
				return false, 0, fmt.Errorf("failed to commit no-op transaction for %s: %w", schemaName, err)
			}
			return false, 0, nil
		}
		return false, 0, fmt.Errorf("failed to query user in %s: %w", schemaName, err)
	}

	roleRes, err := tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE app_user_id = $1", rolesTable), userID)
	if err != nil {
		return false, 0, fmt.Errorf("failed to delete role assignments in %s: %w", schemaName, err)
	}
	_, err = tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE id = $1", usersTable), userID)
	if err != nil {
		return false, 0, fmt.Errorf("failed to delete user in %s: %w", schemaName, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, 0, fmt.Errorf("failed to commit deletion in %s: %w", schemaName, err)
	}

	return true, int(roleRes.RowsAffected()), nil
}

func toISOTime(epoch int64) string {
	// SuperTokens can return ms precision timestamps.
	if epoch > 1_000_000_000_000 {
		return time.UnixMilli(epoch).UTC().Format(time.RFC3339)
	}
	return time.Unix(epoch, 0).UTC().Format(time.RFC3339)
}
