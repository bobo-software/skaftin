package models

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Credential struct {
	ID             int
	ProjectID      int
	Name           string
	CredentialType string // "api_key", "access_token", "mcp_key"
	Permissions    []string
	IsActive       bool
	ExpiresAt      *time.Time
}

type AuthContext struct {
	Credential *Credential
	ProjectID  int
	SchemaName string
}

// VerifyCredential looks up a token in the credentials table and validates it.
func VerifyCredential(ctx context.Context, pool *pgxpool.Pool, token string) (*Credential, error) {
	query := `
		SELECT id, project_id, name, credential_type, permissions, is_active, expires_at
		FROM skaftin_system_api_credentials
		WHERE token = $1
	`

	var cred Credential
	err := pool.QueryRow(ctx, query, token).Scan(
		&cred.ID,
		&cred.ProjectID,
		&cred.Name,
		&cred.CredentialType,
		&cred.Permissions,
		&cred.IsActive,
		&cred.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}

	if !cred.IsActive {
		return nil, ErrCredentialInactive
	}

	if cred.ExpiresAt != nil && cred.ExpiresAt.Before(time.Now()) {
		return nil, ErrCredentialExpired
	}

	return &cred, nil
}

// UpdateLastUsed updates the last_used_at timestamp for a credential.
func UpdateLastUsed(ctx context.Context, pool *pgxpool.Pool, token string) {
	query := `UPDATE skaftin_system_api_credentials SET last_used_at = NOW() WHERE token = $1`
	// Fire and forget -- don't block the request on this
	go func() {
		_, _ = pool.Exec(context.Background(), query, token)
	}()
}
