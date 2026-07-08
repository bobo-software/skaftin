package pushnotifications

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles push notification DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a push notifications Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) ProjectSchema(ctx context.Context, projectID int) (string, error) {
	var schema string
	err := s.pool.QueryRow(ctx, "SELECT schema_name FROM skaftin_system_projects WHERE id = $1", projectID).Scan(&schema)
	if err != nil {
		return "", err
	}
	if err := s.EnsureExpoNotificationsTable(ctx, schema); err != nil {
		return "", err
	}
	return schema, nil
}

func schemaAdvisoryLockKey(schema string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte("expo_notifications:" + schema))
	// PostgreSQL advisory locks take int64; keep positive to avoid sign surprises.
	return int64(h.Sum64() & 0x7fffffffffffffff)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func expoNotificationsTableExists(ctx context.Context, tx pgx.Tx, schema string) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = $1 AND table_name = 'skaftin_system_expo_notifications'
		)
	`, schema).Scan(&exists)
	return exists, err
}

// EnsureExpoNotificationsTable creates the per-project device token table if missing.
// Concurrent callers (e.g. settings + tokens loaded in parallel) are serialized with an
// advisory lock; CREATE TABLE IF NOT EXISTS alone can still race on SERIAL/type catalog.
func (s *Store) EnsureExpoNotificationsTable(ctx context.Context, schema string) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		lockKey := schemaAdvisoryLockKey(schema)
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockKey); err != nil {
			return err
		}

		exists, err := expoNotificationsTableExists(ctx, tx, schema)
		if err != nil {
			return err
		}
		if exists {
			_, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_expo_notifications_user_id ON skaftin_system_expo_notifications(user_id)`)
			return err
		}

		_, err = tx.Exec(ctx, `
			CREATE TABLE skaftin_system_expo_notifications (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL,
				platform VARCHAR(16) NOT NULL CHECK (platform IN ('ios', 'android')),
				expo_push_token TEXT NOT NULL,
				device_name TEXT,
				last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				UNIQUE (expo_push_token)
			)
		`)
		if err != nil {
			if isUniqueViolation(err) {
				// Another session won the race before our lock / or leftover type; treat as ok if present.
				exists, existsErr := expoNotificationsTableExists(ctx, tx, schema)
				if existsErr != nil {
					return existsErr
				}
				if exists {
					_, idxErr := tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_expo_notifications_user_id ON skaftin_system_expo_notifications(user_id)`)
					return idxErr
				}
			}
			return err
		}
		_, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_expo_notifications_user_id ON skaftin_system_expo_notifications(user_id)`)
		return err
	})
}

func (s *Store) withSchema(ctx context.Context, schema string, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	ident := pgx.Identifier{schema}.Sanitize()
	if _, err := tx.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", ident)); err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetOrCreateSettings returns existing settings or inserts a paused default row.
func (s *Store) GetOrCreateSettings(ctx context.Context, projectID int) (*PushSettings, error) {
	settings, err := s.GetSettings(ctx, projectID)
	if err == nil {
		return settings, nil
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO public.skaftin_system_expo_push_settings (project_id, is_active)
		VALUES ($1, false)
		ON CONFLICT (project_id) DO NOTHING
	`, projectID)
	if err != nil {
		return nil, err
	}
	return s.GetSettings(ctx, projectID)
}

func (s *Store) GetSettings(ctx context.Context, projectID int) (*PushSettings, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, project_id, is_active, created_at, updated_at
		FROM public.skaftin_system_expo_push_settings
		WHERE project_id = $1
	`, projectID)
	var out PushSettings
	if err := row.Scan(&out.ID, &out.ProjectID, &out.IsActive, &out.CreatedAt, &out.UpdatedAt); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) UpdateSettings(ctx context.Context, projectID int, isActive bool) (*PushSettings, error) {
	if _, err := s.GetOrCreateSettings(ctx, projectID); err != nil {
		return nil, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE public.skaftin_system_expo_push_settings
		SET is_active = $2, updated_at = CURRENT_TIMESTAMP
		WHERE project_id = $1
		RETURNING id, project_id, is_active, created_at, updated_at
	`, projectID, isActive)
	var out PushSettings
	if err := row.Scan(&out.ID, &out.ProjectID, &out.IsActive, &out.CreatedAt, &out.UpdatedAt); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) UpsertToken(ctx context.Context, schema string, userID int, platform, token string, deviceName *string) (*DeviceToken, error) {
	var out DeviceToken
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO skaftin_system_expo_notifications
				(user_id, platform, expo_push_token, device_name, last_seen_at, updated_at)
			VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT (expo_push_token) DO UPDATE SET
				user_id = EXCLUDED.user_id,
				platform = EXCLUDED.platform,
				device_name = COALESCE(EXCLUDED.device_name, skaftin_system_expo_notifications.device_name),
				last_seen_at = CURRENT_TIMESTAMP,
				updated_at = CURRENT_TIMESTAMP
			RETURNING id, user_id, platform, expo_push_token, device_name, last_seen_at, created_at, updated_at
		`, userID, platform, token, deviceName)
		return row.Scan(
			&out.ID, &out.UserID, &out.Platform, &out.ExpoPushToken,
			&out.DeviceName, &out.LastSeenAt, &out.CreatedAt, &out.UpdatedAt,
		)
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) DeleteTokenByValue(ctx context.Context, schema, token string) (bool, error) {
	var deleted bool
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		cmd, err := tx.Exec(ctx, `DELETE FROM skaftin_system_expo_notifications WHERE expo_push_token = $1`, token)
		if err != nil {
			return err
		}
		deleted = cmd.RowsAffected() > 0
		return nil
	})
	return deleted, err
}

func (s *Store) DeleteTokenByID(ctx context.Context, schema string, tokenID int) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM skaftin_system_expo_notifications WHERE id = $1`, tokenID)
		return err
	})
}

func (s *Store) ListTokens(ctx context.Context, schema string) ([]DeviceToken, error) {
	var tokens []DeviceToken
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, user_id, platform, expo_push_token, device_name, last_seen_at, created_at, updated_at
			FROM skaftin_system_expo_notifications
			ORDER BY last_seen_at DESC, id DESC
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var t DeviceToken
			if err := rows.Scan(
				&t.ID, &t.UserID, &t.Platform, &t.ExpoPushToken,
				&t.DeviceName, &t.LastSeenAt, &t.CreatedAt, &t.UpdatedAt,
			); err != nil {
				return err
			}
			tokens = append(tokens, t)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	if tokens == nil {
		tokens = []DeviceToken{}
	}
	return tokens, nil
}

func (s *Store) GetTokenByID(ctx context.Context, schema string, tokenID int) (*DeviceToken, error) {
	var out DeviceToken
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id, user_id, platform, expo_push_token, device_name, last_seen_at, created_at, updated_at
			FROM skaftin_system_expo_notifications
			WHERE id = $1
		`, tokenID)
		return row.Scan(
			&out.ID, &out.UserID, &out.Platform, &out.ExpoPushToken,
			&out.DeviceName, &out.LastSeenAt, &out.CreatedAt, &out.UpdatedAt,
		)
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) ListTokensForUser(ctx context.Context, schema string, userID int) ([]DeviceToken, error) {
	var tokens []DeviceToken
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, user_id, platform, expo_push_token, device_name, last_seen_at, created_at, updated_at
			FROM skaftin_system_expo_notifications
			WHERE user_id = $1
			ORDER BY last_seen_at DESC
		`, userID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var t DeviceToken
			if err := rows.Scan(
				&t.ID, &t.UserID, &t.Platform, &t.ExpoPushToken,
				&t.DeviceName, &t.LastSeenAt, &t.CreatedAt, &t.UpdatedAt,
			); err != nil {
				return err
			}
			tokens = append(tokens, t)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	if tokens == nil {
		tokens = []DeviceToken{}
	}
	return tokens, nil
}

func truncateToken(token string) string {
	const keep = 12
	if len(token) <= keep*2 {
		return token
	}
	return token[:keep] + "…" + token[len(token)-keep:]
}

func toListItem(t DeviceToken) DeviceTokenListItem {
	return DeviceTokenListItem{
		ID:            t.ID,
		UserID:        t.UserID,
		Platform:      t.Platform,
		ExpoPushToken: t.ExpoPushToken,
		TokenPreview:  truncateToken(t.ExpoPushToken),
		DeviceName:    t.DeviceName,
		LastSeenAt:    t.LastSeenAt,
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
	}
}

func normalizePlatform(platform string) (string, error) {
	p := strings.ToLower(strings.TrimSpace(platform))
	switch p {
	case "ios", "android":
		return p, nil
	default:
		return "", fmt.Errorf("platform must be ios or android")
	}
}

func isValidExpoToken(token string) bool {
	t := strings.TrimSpace(token)
	return strings.HasPrefix(t, "ExponentPushToken[") || strings.HasPrefix(t, "ExpoPushToken[")
}
