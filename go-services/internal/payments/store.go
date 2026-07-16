package payments

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles transaction DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new payments Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) ProjectSchema(ctx context.Context, projectID int) (string, error) {
	var schema string
	err := s.pool.QueryRow(ctx, "SELECT schema_name FROM skaftin_system_projects WHERE id = $1", projectID).Scan(&schema)
	if err != nil {
		return "", err
	}
	if err := s.EnsureProjectPaymentTables(ctx, schema); err != nil {
		return "", err
	}
	return schema, nil
}

func (s *Store) EnsureProjectPaymentTables(ctx context.Context, schema string) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		queries := []string{
			`CREATE TABLE IF NOT EXISTS skaftin_system_payment_providers (
				id SERIAL PRIMARY KEY,
				project_id INTEGER NOT NULL,
				name VARCHAR(255) NOT NULL,
				provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('payfast', 'fnb_pay', 'paystack')),
				merchant_id VARCHAR(255),
				merchant_key VARCHAR(255),
				passphrase TEXT,
				api_key TEXT,
				api_secret TEXT,
				public_key TEXT,
				return_url VARCHAR(500),
				cancel_url VARCHAR(500),
				notify_url VARCHAR(500),
				sandbox_mode BOOLEAN DEFAULT true,
				is_active BOOLEAN DEFAULT true,
				metadata JSONB DEFAULT '{}',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(project_id, name)
			)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_providers_project_id ON skaftin_system_payment_providers(project_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_providers_provider_type ON skaftin_system_payment_providers(provider_type)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_providers_is_active ON skaftin_system_payment_providers(is_active)`,
			`CREATE TABLE IF NOT EXISTS skaftin_system_payment_transactions (
				id SERIAL PRIMARY KEY,
				project_id INTEGER NOT NULL,
				provider_id INTEGER REFERENCES skaftin_system_payment_providers(id) ON DELETE SET NULL,
				transaction_id VARCHAR(255) UNIQUE NOT NULL,
				external_payment_id VARCHAR(255),
				amount DECIMAL(12,2) NOT NULL,
				currency VARCHAR(3) DEFAULT 'ZAR',
				item_name VARCHAR(255) NOT NULL,
				item_description TEXT,
				customer_email VARCHAR(255),
				customer_name VARCHAR(255),
				customer_phone VARCHAR(50),
				payment_type VARCHAR(20) DEFAULT 'once_off' CHECK (payment_type IN ('once_off', 'subscription')),
				subscription_type INTEGER,
				frequency INTEGER,
				cycles INTEGER DEFAULT 0,
				subscription_token VARCHAR(255),
				status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'cancelled', 'refunded')),
				status_message TEXT,
				payment_url TEXT,
				return_url VARCHAR(500),
				cancel_url VARCHAR(500),
				metadata JSONB DEFAULT '{}',
				webhook_data JSONB,
				paid_at TIMESTAMP,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON skaftin_system_payment_transactions(project_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON skaftin_system_payment_transactions(provider_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON skaftin_system_payment_transactions(transaction_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_payment_id ON skaftin_system_payment_transactions(external_payment_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON skaftin_system_payment_transactions(status)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_type ON skaftin_system_payment_transactions(payment_type)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_email ON skaftin_system_payment_transactions(customer_email)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON skaftin_system_payment_transactions(created_at DESC)`,
			`CREATE TABLE IF NOT EXISTS skaftin_system_payment_plans (
				id SERIAL PRIMARY KEY,
				project_id INTEGER NOT NULL,
				provider_id INTEGER NOT NULL REFERENCES skaftin_system_payment_providers(id) ON DELETE CASCADE,
				plan_code VARCHAR(255) NOT NULL,
				name VARCHAR(255) NOT NULL,
				description TEXT,
				amount DECIMAL(12,2) NOT NULL,
				currency VARCHAR(3) DEFAULT 'ZAR',
				interval VARCHAR(20) NOT NULL CHECK (interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'annually')),
				is_active BOOLEAN DEFAULT true,
				metadata JSONB DEFAULT '{}',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(provider_id, plan_code)
			)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_plans_project_id ON skaftin_system_payment_plans(project_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_plans_provider_id ON skaftin_system_payment_plans(provider_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_plans_is_active ON skaftin_system_payment_plans(is_active)`,
			`ALTER TABLE skaftin_system_payment_transactions ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES skaftin_system_payment_plans(id) ON DELETE SET NULL`,
			`ALTER TABLE skaftin_system_payment_transactions ADD COLUMN IF NOT EXISTS plan_code VARCHAR(255)`,
			`ALTER TABLE skaftin_system_payment_transactions ADD COLUMN IF NOT EXISTS subscription_email_token VARCHAR(255)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_plan_id ON skaftin_system_payment_transactions(plan_id)`,
			`CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_token ON skaftin_system_payment_transactions(subscription_token)`,
		}

		for _, q := range queries {
			if _, err := tx.Exec(ctx, q); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) withSchema(ctx context.Context, schema string, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schema)); err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanProvider(row pgx.Row) (PaymentProviderRecord, error) {
	var p PaymentProviderRecord
	var metadataRaw []byte
	err := row.Scan(
		&p.ID,
		&p.ProjectID,
		&p.Name,
		&p.ProviderType,
		&p.MerchantID,
		&p.MerchantKey,
		&p.Passphrase,
		&p.APIKey,
		&p.APISecret,
		&p.PublicKey,
		&p.ReturnURL,
		&p.CancelURL,
		&p.NotifyURL,
		&p.SandboxMode,
		&p.IsActive,
		&metadataRaw,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		return PaymentProviderRecord{}, err
	}
	if len(metadataRaw) > 0 {
		_ = json.Unmarshal(metadataRaw, &p.Metadata)
	}
	if p.Metadata == nil {
		p.Metadata = map[string]any{}
	}
	return p, nil
}

func scanTransaction(row pgx.Row) (PaymentTransactionRecord, error) {
	var t PaymentTransactionRecord
	var metadataRaw []byte
	var webhookRaw []byte
	err := row.Scan(
		&t.ID,
		&t.ProjectID,
		&t.ProviderID,
		&t.TransactionID,
		&t.ExternalPaymentID,
		&t.Amount,
		&t.Currency,
		&t.ItemName,
		&t.ItemDescription,
		&t.CustomerEmail,
		&t.CustomerName,
		&t.CustomerPhone,
		&t.PaymentType,
		&t.SubscriptionType,
		&t.Frequency,
		&t.Cycles,
		&t.SubscriptionToken,
		&t.SubscriptionEmailToken,
		&t.PlanID,
		&t.PlanCode,
		&t.Status,
		&t.StatusMessage,
		&t.PaymentURL,
		&t.ReturnURL,
		&t.CancelURL,
		&metadataRaw,
		&webhookRaw,
		&t.PaidAt,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		return PaymentTransactionRecord{}, err
	}
	if len(metadataRaw) > 0 {
		_ = json.Unmarshal(metadataRaw, &t.Metadata)
	}
	if len(webhookRaw) > 0 {
		_ = json.Unmarshal(webhookRaw, &t.WebhookData)
	}
	if t.Metadata == nil {
		t.Metadata = map[string]any{}
	}
	return t, nil
}

func scanPlan(row pgx.Row) (PaymentPlanRecord, error) {
	var p PaymentPlanRecord
	var metadataRaw []byte
	err := row.Scan(
		&p.ID,
		&p.ProjectID,
		&p.ProviderID,
		&p.PlanCode,
		&p.Name,
		&p.Description,
		&p.Amount,
		&p.Currency,
		&p.Interval,
		&p.IsActive,
		&metadataRaw,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		return PaymentPlanRecord{}, err
	}
	if len(metadataRaw) > 0 {
		_ = json.Unmarshal(metadataRaw, &p.Metadata)
	}
	if p.Metadata == nil {
		p.Metadata = map[string]any{}
	}
	return p, nil
}

const planColumns = `id, project_id, provider_id, plan_code, name, description, amount, currency, interval, is_active, metadata, created_at, updated_at`

const transactionColumns = `id, project_id, provider_id, transaction_id, external_payment_id, amount, currency,
				item_name, item_description, customer_email, customer_name, customer_phone, payment_type,
				subscription_type, frequency, cycles, subscription_token, subscription_email_token,
				plan_id, plan_code, status, status_message,
				payment_url, return_url, cancel_url, metadata, webhook_data, paid_at, created_at, updated_at`

func (s *Store) ListPlans(ctx context.Context, projectID int, providerID *int, schema string) ([]PaymentPlanRecord, error) {
	return s.listPlans(ctx, projectID, providerID, schema, false)
}

func (s *Store) ListActivePlans(ctx context.Context, projectID int, providerID *int, schema string) ([]PaymentPlanRecord, error) {
	return s.listPlans(ctx, projectID, providerID, schema, true)
}

func (s *Store) listPlans(ctx context.Context, projectID int, providerID *int, schema string, activeOnly bool) ([]PaymentPlanRecord, error) {
	plans := make([]PaymentPlanRecord, 0)
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		query := `SELECT ` + planColumns + ` FROM skaftin_system_payment_plans WHERE project_id = $1`
		args := []any{projectID}
		next := 2
		if providerID != nil {
			query += fmt.Sprintf(` AND provider_id = $%d`, next)
			args = append(args, *providerID)
			next++
		}
		if activeOnly {
			query += ` AND is_active = true`
		}
		query += ` ORDER BY created_at DESC`
		rows, err := tx.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			plan, err := scanPlan(rows)
			if err != nil {
				return err
			}
			plans = append(plans, plan)
		}
		return rows.Err()
	})
	return plans, err
}

func (s *Store) GetPlan(ctx context.Context, projectID, planID int, schema string) (*PaymentPlanRecord, error) {
	var plan *PaymentPlanRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `SELECT `+planColumns+` FROM skaftin_system_payment_plans WHERE id = $1 AND project_id = $2`, planID, projectID)
		p, err := scanPlan(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		plan = &p
		return nil
	})
	return plan, err
}

func (s *Store) GetPlanByCode(ctx context.Context, providerID int, planCode, schema string) (*PaymentPlanRecord, error) {
	var plan *PaymentPlanRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `SELECT `+planColumns+` FROM skaftin_system_payment_plans WHERE provider_id = $1 AND plan_code = $2`, providerID, planCode)
		p, err := scanPlan(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		plan = &p
		return nil
	})
	return plan, err
}

func (s *Store) InsertPlan(ctx context.Context, req CreatePlanRequest, planCode string, schema string) (*PaymentPlanRecord, error) {
	var plan *PaymentPlanRecord
	metaJSON, _ := json.Marshal(req.Metadata)
	currency := req.Currency
	if strings.TrimSpace(currency) == "" {
		currency = "ZAR"
	}
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO skaftin_system_payment_plans (
				project_id, provider_id, plan_code, name, description, amount, currency, interval, metadata
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			RETURNING `+planColumns+`
		`,
			req.ProjectID, req.ProviderID, planCode, req.Name, req.Description, req.Amount, currency, req.Interval, metaJSON)
		p, err := scanPlan(row)
		if err != nil {
			return err
		}
		plan = &p
		return nil
	})
	return plan, err
}

func (s *Store) UpsertPlanFromSync(ctx context.Context, projectID, providerID int, planCode, name string, amount float64, currency, interval string, raw map[string]any, schema string) (*PaymentPlanRecord, error) {
	var plan *PaymentPlanRecord
	metaJSON, _ := json.Marshal(raw)
	if strings.TrimSpace(currency) == "" {
		currency = "ZAR"
	}
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO skaftin_system_payment_plans (
				project_id, provider_id, plan_code, name, amount, currency, interval, metadata
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (provider_id, plan_code) DO UPDATE SET
				name = EXCLUDED.name,
				amount = EXCLUDED.amount,
				currency = EXCLUDED.currency,
				interval = EXCLUDED.interval,
				metadata = EXCLUDED.metadata,
				updated_at = CURRENT_TIMESTAMP
			RETURNING `+planColumns+`
		`,
			projectID, providerID, planCode, name, amount, currency, interval, metaJSON)
		p, err := scanPlan(row)
		if err != nil {
			return err
		}
		plan = &p
		return nil
	})
	return plan, err
}

func (s *Store) UpdatePlan(ctx context.Context, projectID, planID int, req UpdatePlanRequest, schema string) (*PaymentPlanRecord, error) {
	updates := make([]string, 0, 4)
	args := make([]any, 0, 6)
	next := 1

	add := func(col string, v any) {
		updates = append(updates, fmt.Sprintf("%s = $%d", col, next))
		args = append(args, v)
		next++
	}

	if req.Name != nil {
		add("name", *req.Name)
	}
	if req.Description != nil {
		add("description", *req.Description)
	}
	if req.IsActive != nil {
		add("is_active", *req.IsActive)
	}
	if req.Metadata != nil {
		metaJSON, _ := json.Marshal(req.Metadata)
		add("metadata", metaJSON)
	}

	if len(updates) == 0 {
		return s.GetPlan(ctx, projectID, planID, schema)
	}
	updates = append(updates, "updated_at = CURRENT_TIMESTAMP")

	args = append(args, planID, projectID)
	q := fmt.Sprintf(`
		UPDATE skaftin_system_payment_plans
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING `+planColumns+`
	`, strings.Join(updates, ", "), next, next+1)

	var plan *PaymentPlanRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, q, args...)
		p, err := scanPlan(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		plan = &p
		return nil
	})
	return plan, err
}

func (s *Store) DeletePlan(ctx context.Context, projectID, planID int, schema string) (bool, error) {
	var deleted bool
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		cmd, err := tx.Exec(ctx, `DELETE FROM skaftin_system_payment_plans WHERE id = $1 AND project_id = $2`, planID, projectID)
		if err != nil {
			return err
		}
		deleted = cmd.RowsAffected() > 0
		return nil
	})
	return deleted, err
}

func (s *Store) ListProviders(ctx context.Context, projectID int, schema string) ([]PaymentProviderRecord, error) {
	providers := make([]PaymentProviderRecord, 0)
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
				is_active, metadata, created_at, updated_at
			FROM skaftin_system_payment_providers
			WHERE project_id = $1
			ORDER BY created_at DESC
		`, projectID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			provider, err := scanProvider(rows)
			if err != nil {
				return err
			}
			providers = append(providers, provider)
		}
		return rows.Err()
	})
	return providers, err
}

func (s *Store) GetProvider(ctx context.Context, projectID, providerID int, schema string) (*PaymentProviderRecord, error) {
	var provider *PaymentProviderRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
				is_active, metadata, created_at, updated_at
			FROM skaftin_system_payment_providers
			WHERE id = $1 AND project_id = $2
		`, providerID, projectID)
		p, err := scanProvider(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		provider = &p
		return nil
	})
	return provider, err
}

func (s *Store) GetProviderByType(ctx context.Context, projectID int, providerType ProviderType, schema string) (*PaymentProviderRecord, error) {
	var provider *PaymentProviderRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
				is_active, metadata, created_at, updated_at
			FROM skaftin_system_payment_providers
			WHERE project_id = $1 AND provider_type = $2 AND is_active = true
			ORDER BY created_at ASC
			LIMIT 1
		`, projectID, providerType)
		p, err := scanProvider(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		provider = &p
		return nil
	})
	return provider, err
}

func (s *Store) GetActiveProvider(ctx context.Context, projectID int, schema string) (*PaymentProviderRecord, error) {
	var provider *PaymentProviderRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
				is_active, metadata, created_at, updated_at
			FROM skaftin_system_payment_providers
			WHERE project_id = $1 AND is_active = true
			ORDER BY created_at ASC
			LIMIT 1
		`, projectID)
		p, err := scanProvider(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		provider = &p
		return nil
	})
	return provider, err
}

func (s *Store) InsertProvider(ctx context.Context, req CreateProviderRequest, schema string) (*PaymentProviderRecord, error) {
	var provider *PaymentProviderRecord
	metaJSON, _ := json.Marshal(req.Metadata)
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		sandbox := true
		if req.SandboxMode != nil {
			sandbox = *req.SandboxMode
		}
		active := true
		if req.IsActive != nil {
			active = *req.IsActive
		}
		row := tx.QueryRow(ctx, `
			INSERT INTO skaftin_system_payment_providers (
				project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url,
				sandbox_mode, is_active, metadata
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
			RETURNING id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
				api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
				is_active, metadata, created_at, updated_at
		`,
			req.ProjectID, req.Name, req.ProviderType, req.MerchantID, req.MerchantKey, req.Passphrase,
			req.APIKey, req.APISecret, req.PublicKey, req.ReturnURL, req.CancelURL, req.NotifyURL,
			sandbox, active, metaJSON)
		p, err := scanProvider(row)
		if err != nil {
			return err
		}
		provider = &p
		return nil
	})
	return provider, err
}

func (s *Store) UpdateProvider(ctx context.Context, projectID, providerID int, req UpdateProviderRequest, schema string) (*PaymentProviderRecord, error) {
	updates := make([]string, 0, 12)
	args := make([]any, 0, 14)
	next := 1

	add := func(col string, v any) {
		updates = append(updates, fmt.Sprintf("%s = $%d", col, next))
		args = append(args, v)
		next++
	}

	if req.Name != nil {
		add("name", *req.Name)
	}
	if req.MerchantID != nil {
		add("merchant_id", *req.MerchantID)
	}
	if req.MerchantKey != nil {
		add("merchant_key", *req.MerchantKey)
	}
	if req.Passphrase != nil {
		add("passphrase", *req.Passphrase)
	}
	if req.APIKey != nil {
		add("api_key", *req.APIKey)
	}
	if req.APISecret != nil {
		add("api_secret", *req.APISecret)
	}
	if req.PublicKey != nil {
		add("public_key", *req.PublicKey)
	}
	if req.ReturnURL != nil {
		add("return_url", *req.ReturnURL)
	}
	if req.CancelURL != nil {
		add("cancel_url", *req.CancelURL)
	}
	if req.NotifyURL != nil {
		add("notify_url", *req.NotifyURL)
	}
	if req.SandboxMode != nil {
		add("sandbox_mode", *req.SandboxMode)
	}
	if req.IsActive != nil {
		add("is_active", *req.IsActive)
	}
	if req.Metadata != nil {
		metaJSON, _ := json.Marshal(req.Metadata)
		add("metadata", metaJSON)
	}

	if len(updates) == 0 {
		return s.GetProvider(ctx, projectID, providerID, schema)
	}
	updates = append(updates, "updated_at = CURRENT_TIMESTAMP")

	args = append(args, providerID, projectID)
	q := fmt.Sprintf(`
		UPDATE skaftin_system_payment_providers
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING id, project_id, name, provider_type, merchant_id, merchant_key, passphrase,
			api_key, api_secret, public_key, return_url, cancel_url, notify_url, sandbox_mode,
			is_active, metadata, created_at, updated_at
	`, strings.Join(updates, ", "), next, next+1)

	var provider *PaymentProviderRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, q, args...)
		p, err := scanProvider(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		provider = &p
		return nil
	})
	return provider, err
}

func (s *Store) DeleteProvider(ctx context.Context, projectID, providerID int, schema string) (bool, error) {
	var deleted bool
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		cmd, err := tx.Exec(ctx, `
			DELETE FROM skaftin_system_payment_providers
			WHERE id = $1 AND project_id = $2
		`, providerID, projectID)
		if err != nil {
			return err
		}
		deleted = cmd.RowsAffected() > 0
		return nil
	})
	return deleted, err
}

func (s *Store) GetTransaction(ctx context.Context, projectID int, transactionID, schema string) (*PaymentTransactionRecord, error) {
	var txRecord *PaymentTransactionRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT `+transactionColumns+`
			FROM skaftin_system_payment_transactions
			WHERE transaction_id = $1 AND project_id = $2
		`, transactionID, projectID)
		rec, err := scanTransaction(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		txRecord = &rec
		return nil
	})
	return txRecord, err
}

func (s *Store) InsertTransaction(ctx context.Context, projectID int, schema string, req InitiatePaymentRequest, provider *PaymentProviderRecord, transactionID string) error {
	paymentType := "once_off"
	if req.PaymentType != nil && strings.TrimSpace(*req.PaymentType) != "" {
		paymentType = strings.TrimSpace(*req.PaymentType)
	}
	returnURL := provider.ReturnURL
	if req.ReturnURL != nil {
		returnURL = req.ReturnURL
	}
	cancelURL := provider.CancelURL
	if req.CancelURL != nil {
		cancelURL = req.CancelURL
	}
	metaJSON, _ := json.Marshal(req.Metadata)

	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO skaftin_system_payment_transactions (
				project_id, provider_id, transaction_id, amount, currency, item_name,
				item_description, customer_email, customer_name, customer_phone,
				payment_type, subscription_type, frequency, cycles, return_url,
				cancel_url, metadata, status
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending')
		`,
			projectID,
			provider.ID,
			transactionID,
			req.Amount,
			"ZAR",
			req.ItemName,
			req.ItemDescription,
			req.CustomerEmail,
			req.CustomerName,
			req.CustomerPhone,
			paymentType,
			req.SubscriptionType,
			req.Frequency,
			req.Cycles,
			returnURL,
			cancelURL,
			metaJSON,
		)
		return err
	})
}

func (s *Store) SetTransactionProcessing(ctx context.Context, schema, transactionID, paymentURL string) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE skaftin_system_payment_transactions
			SET payment_url = $1, status = 'processing', updated_at = CURRENT_TIMESTAMP
			WHERE transaction_id = $2
		`, paymentURL, transactionID)
		return err
	})
}

func (s *Store) SetTransactionFailed(ctx context.Context, schema, transactionID, statusMessage string) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE skaftin_system_payment_transactions
			SET status = 'failed', status_message = $1, updated_at = CURRENT_TIMESTAMP
			WHERE transaction_id = $2
		`, statusMessage, transactionID)
		return err
	})
}

func (s *Store) SetTransactionCancelled(ctx context.Context, schema, transactionID string) error {
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE skaftin_system_payment_transactions
			SET status = 'cancelled', status_message = 'Subscription cancelled', updated_at = CURRENT_TIMESTAMP
			WHERE transaction_id = $1
		`, transactionID)
		return err
	})
}

func (s *Store) ListTransactions(ctx context.Context, projectID int, schema string, opts TransactionListOptions) ([]PaymentTransactionRecord, int, error) {
	records := make([]PaymentTransactionRecord, 0)
	var total int

	conditions := []string{"project_id = $1"}
	args := []any{projectID}
	next := 2
	if opts.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", next))
		args = append(args, opts.Status)
		next++
	}
	if opts.PaymentType != "" {
		conditions = append(conditions, fmt.Sprintf("payment_type = $%d", next))
		args = append(args, opts.PaymentType)
		next++
	}
	if opts.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", next))
		args = append(args, *opts.StartDate)
		next++
	}
	if opts.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", next))
		args = append(args, *opts.EndDate)
		next++
	}
	where := strings.Join(conditions, " AND ")
	limit := opts.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := opts.Offset
	if offset < 0 {
		offset = 0
	}

	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, "SELECT COUNT(*) FROM skaftin_system_payment_transactions WHERE "+where, args...).Scan(&total); err != nil {
			return err
		}

		queryArgs := append([]any{}, args...)
		queryArgs = append(queryArgs, limit, offset)
		rows, err := tx.Query(ctx, fmt.Sprintf(`
			SELECT `+transactionColumns+`
			FROM skaftin_system_payment_transactions
			WHERE %s
			ORDER BY created_at DESC
			LIMIT $%d OFFSET $%d
		`, where, next, next+1), queryArgs...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			rec, err := scanTransaction(rows)
			if err != nil {
				return err
			}
			records = append(records, rec)
		}
		return rows.Err()
	})
	return records, total, err
}

func (s *Store) HasRecentBlockingPayment(ctx context.Context, userID string, cutoff time.Time) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM public.fnb_payments
			WHERE user_id = $1
				AND status = ANY($2::text[])
				AND created_at > $3
			LIMIT 1
		)
	`, userID, []string{"pending", "Busy", "paid"}, cutoff).Scan(&exists)
	return exists, err
}

func (s *Store) InsertFNBPayment(ctx context.Context, userID, reference string, amount float64, signature, payload string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.fnb_payments (user_id, reference, status, price, gateway, signature, payload, updated_at)
		VALUES ($1, $2, 'pending', $3, 'fnb_pay', $4, $5, CURRENT_TIMESTAMP)
	`, userID, reference, amount, signature, payload)
	return err
}

func (s *Store) UpdateTransactionFromWebhook(
	ctx context.Context,
	schema string,
	projectID int,
	transactionID string,
	status string,
	externalPaymentID string,
	rawData map[string]any,
) error {
	return s.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, transactionID, WebhookUpdateOpts{
		Status:            status,
		ExternalPaymentID: externalPaymentID,
		RawData:           rawData,
	})
}

// WebhookUpdateOpts controls optional fields applied when a webhook updates a transaction.
type WebhookUpdateOpts struct {
	Status                 string
	StatusMessage          *string
	ExternalPaymentID      string
	SubscriptionToken      *string
	SubscriptionEmailToken *string
	RawData                map[string]any
}

func (s *Store) UpdateTransactionFromWebhookOpts(
	ctx context.Context,
	schema string,
	projectID int,
	transactionID string,
	opts WebhookUpdateOpts,
) error {
	var webhookJSON []byte
	if opts.RawData != nil {
		webhookJSON, _ = json.Marshal(opts.RawData)
	}
	return s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE skaftin_system_payment_transactions
			SET
				status = COALESCE(NULLIF($1, ''), status),
				status_message = COALESCE($2, status_message),
				external_payment_id = COALESCE(NULLIF($3, ''), external_payment_id),
				subscription_token = COALESCE($4, subscription_token),
				subscription_email_token = COALESCE($5, subscription_email_token),
				webhook_data = COALESCE($6::jsonb, webhook_data),
				paid_at = CASE WHEN $1 = 'complete' THEN CURRENT_TIMESTAMP ELSE paid_at END,
				updated_at = CURRENT_TIMESTAMP
			WHERE transaction_id = $7 AND project_id = $8
		`, opts.Status, opts.StatusMessage, opts.ExternalPaymentID, opts.SubscriptionToken, opts.SubscriptionEmailToken, webhookJSON, transactionID, projectID)
		return err
	})
}

// FindSubscriptionTransaction matches the newest plan subscription txn for email+plan without a token yet.
func (s *Store) FindSubscriptionTransaction(ctx context.Context, projectID int, customerEmail, planCode, schema string) (*PaymentTransactionRecord, error) {
	var txRecord *PaymentTransactionRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT `+transactionColumns+`
			FROM skaftin_system_payment_transactions
			WHERE project_id = $1
			  AND LOWER(COALESCE(customer_email, '')) = LOWER($2)
			  AND plan_code = $3
			  AND payment_type = 'subscription'
			  AND (subscription_token IS NULL OR TRIM(subscription_token) = '')
			  AND status IN ('processing', 'complete')
			ORDER BY created_at DESC
			LIMIT 1
		`, projectID, strings.TrimSpace(customerEmail), strings.TrimSpace(planCode))
		rec, err := scanTransaction(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		txRecord = &rec
		return nil
	})
	return txRecord, err
}

// FindTransactionBySubscriptionToken looks up a txn by Paystack subscription_code / PayFast token.
func (s *Store) FindTransactionBySubscriptionToken(ctx context.Context, projectID int, subscriptionToken, schema string) (*PaymentTransactionRecord, error) {
	var txRecord *PaymentTransactionRecord
	err := s.withSchema(ctx, schema, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT `+transactionColumns+`
			FROM skaftin_system_payment_transactions
			WHERE project_id = $1 AND subscription_token = $2
			ORDER BY created_at DESC
			LIMIT 1
		`, projectID, strings.TrimSpace(subscriptionToken))
		rec, err := scanTransaction(row)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil
			}
			return err
		}
		txRecord = &rec
		return nil
	})
	return txRecord, err
}
