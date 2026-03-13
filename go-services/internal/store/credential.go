package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/dbmetrics"
	"github.com/skaftin/go-services/internal/model"
)

// VerifyCredential looks up a token in the credentials table and validates it.
func VerifyCredential(ctx context.Context, pool *pgxpool.Pool, token string) (*model.Credential, error) {
	query := `
		SELECT id, project_id, name, credential_type, permissions, is_active, expires_at
		FROM skaftin_system_api_credentials
		WHERE token = $1
	`

	var cred model.Credential
	recorder := dbmetrics.NewRecorder(pool)
	start := time.Now()
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
	recorder.Record(ctx, dbmetrics.Record{
		ProjectID:    cred.ProjectID,
		Query:        query,
		RowsAffected: 1,
		Duration:     time.Since(start),
	})

	if !cred.IsActive {
		return nil, model.ErrCredentialInactive
	}

	if cred.ExpiresAt != nil && cred.ExpiresAt.Before(time.Now()) {
		return nil, model.ErrCredentialExpired
	}

	return &cred, nil
}

// UpdateLastUsed updates the last_used_at timestamp for a credential.
func UpdateLastUsed(ctx context.Context, pool *pgxpool.Pool, token string) {
	query := `UPDATE skaftin_system_api_credentials SET last_used_at = NOW() WHERE token = $1`
	go func() {
		_, _ = pool.Exec(context.Background(), query, token)
	}()
}
