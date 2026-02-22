package credentials

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CredentialRecord represents a full row from skaftin_system_api_credentials.
type CredentialRecord struct {
	ID             int        `json:"id"`
	ProjectID      int        `json:"project_id"`
	Name           string     `json:"name"`
	CredentialType string     `json:"credential_type"`
	Token          string     `json:"token"`
	Permissions    []string   `json:"permissions"`
	IsActive       bool       `json:"is_active"`
	LastUsedAt     *time.Time `json:"last_used_at"`
	CreatedBy      string     `json:"created_by"`
	CreatedAt      *time.Time `json:"created_at"`
	ExpiresAt      *time.Time `json:"expires_at"`
}

// Store handles credential DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new credentials Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const credentialColumns = `id, project_id, name, credential_type, token, permissions,
	is_active, last_used_at, created_by, created_at, expires_at`

func scanCredential(row interface{ Scan(dest ...any) error }) (*CredentialRecord, error) {
	var c CredentialRecord
	err := row.Scan(
		&c.ID, &c.ProjectID, &c.Name, &c.CredentialType, &c.Token,
		&c.Permissions, &c.IsActive, &c.LastUsedAt, &c.CreatedBy,
		&c.CreatedAt, &c.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) ListByProject(ctx context.Context, projectID int) ([]CredentialRecord, error) {
	query := fmt.Sprintf(`SELECT %s FROM skaftin_system_api_credentials
		WHERE project_id = $1 ORDER BY created_at DESC`, credentialColumns)

	rows, err := s.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	creds := make([]CredentialRecord, 0)
	for rows.Next() {
		c, err := scanCredential(rows)
		if err != nil {
			return nil, err
		}
		creds = append(creds, *c)
	}
	return creds, rows.Err()
}

func (s *Store) Create(ctx context.Context, projectID int, name, credType, token, createdBy string, permissions []string, expiresAt *time.Time) (*CredentialRecord, error) {
	query := fmt.Sprintf(`INSERT INTO skaftin_system_api_credentials
		(project_id, name, credential_type, token, permissions, created_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING %s`, credentialColumns)

	row := s.pool.QueryRow(ctx, query, projectID, name, credType, token, permissions, createdBy, expiresAt)
	return scanCredential(row)
}

func (s *Store) Update(ctx context.Context, credentialID, projectID int, updates map[string]any) (*CredentialRecord, error) {
	setClauses := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)+2)
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}

	args = append(args, credentialID, projectID)

	query := fmt.Sprintf(`UPDATE skaftin_system_api_credentials
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING %s`,
		strings.Join(setClauses, ", "), i, i+1, credentialColumns)

	row := s.pool.QueryRow(ctx, query, args...)
	return scanCredential(row)
}

func (s *Store) Delete(ctx context.Context, credentialID, projectID int) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_api_credentials WHERE id = $1 AND project_id = $2`,
		credentialID, projectID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *Store) GetMcpKey(ctx context.Context, projectID int) (*CredentialRecord, error) {
	query := fmt.Sprintf(`SELECT %s FROM skaftin_system_api_credentials
		WHERE project_id = $1 AND credential_type = 'mcp_key'`, credentialColumns)

	row := s.pool.QueryRow(ctx, query, projectID)
	return scanCredential(row)
}

func (s *Store) CountByTypeAndProject(ctx context.Context, projectID int, credType string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM skaftin_system_api_credentials WHERE project_id = $1 AND credential_type = $2`,
		projectID, credType).Scan(&count)
	return count, err
}

func (s *Store) RegenerateMcpKey(ctx context.Context, projectID int, newToken string) (*CredentialRecord, error) {
	query := fmt.Sprintf(`UPDATE skaftin_system_api_credentials
		SET token = $1, created_at = CURRENT_TIMESTAMP, last_used_at = NULL
		WHERE project_id = $2 AND credential_type = 'mcp_key'
		RETURNING %s`, credentialColumns)

	row := s.pool.QueryRow(ctx, query, newToken, projectID)
	return scanCredential(row)
}

func (s *Store) CreateMcpKey(ctx context.Context, projectID int, token, createdBy string) (*CredentialRecord, error) {
	return s.Create(ctx, projectID, "MCP Integration Key", "mcp_key", token, createdBy, []string{"mcp:full_access"}, nil)
}
