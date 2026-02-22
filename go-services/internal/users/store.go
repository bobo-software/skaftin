package users

import (
	"context"
	"fmt"
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

type User struct {
	ID        int        `json:"id"`
	Username  string     `json:"username"`
	Email     string     `json:"email"`
	FullName  *string    `json:"full_name"`
	LastName  *string    `json:"last_name"`
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

const userColumns = `id, username, email, full_name, last_name, created_at, updated_at`

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.LastName, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetByEmail(ctx context.Context, email string) (*User, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM skaftin_system_users WHERE email = $1`, email)
	u, err := scanUser(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) ListAll(ctx context.Context) ([]User, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, username, email, full_name, last_name, created_at FROM skaftin_system_users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]User, 0)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.LastName, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) Create(ctx context.Context, username, email string, fullName, lastName *string) (*User, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO skaftin_system_users (username, email, full_name, last_name)
		 VALUES ($1, $2, $3, $4) RETURNING `+userColumns,
		username, email, fullName, lastName)
	return scanUser(row)
}

func (s *Store) Update(ctx context.Context, id int, fields map[string]any) (*User, error) {
	if len(fields) == 0 {
		row := s.pool.QueryRow(ctx,
			`SELECT `+userColumns+` FROM skaftin_system_users WHERE id = $1`, id)
		return scanUser(row)
	}

	setClauses := "updated_at = NOW()"
	args := []any{}
	argIdx := 1

	for col, val := range fields {
		setClauses += fmt.Sprintf(", %s = $%d", col, argIdx)
		args = append(args, val)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(
		`UPDATE skaftin_system_users SET %s WHERE id = $%d RETURNING %s`,
		setClauses, argIdx, userColumns,
	)
	row := s.pool.QueryRow(ctx, query, args...)
	return scanUser(row)
}

func (s *Store) DeleteOrgMemberships(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_organization_members WHERE user_id = $1`, userID)
	return err
}

func (s *Store) DeleteProjectMemberships(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_project_members WHERE user_id = $1`, userID)
	return err
}
