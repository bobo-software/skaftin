-- Migration: Add skaftin_system_payment_plans table (generic, provider-agnostic)
-- and plan_id/plan_code columns on skaftin_system_payment_transactions.
-- Applies to every existing project schema that already has payment tables provisioned.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_payment_providers'
  LOOP
    EXECUTE format($fmt$
      CREATE TABLE IF NOT EXISTS %I.skaftin_system_payment_plans (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          provider_id INTEGER NOT NULL REFERENCES %I.skaftin_system_payment_providers(id) ON DELETE CASCADE,
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
      )
    $fmt$, r.table_schema, r.table_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_plans_project_id ON %I.skaftin_system_payment_plans(project_id)', r.table_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_plans_provider_id ON %I.skaftin_system_payment_plans(provider_id)', r.table_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_plans_is_active ON %I.skaftin_system_payment_plans(is_active)', r.table_schema);

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = r.table_schema AND table_name = 'skaftin_system_payment_transactions'
    ) THEN
      EXECUTE format($fmt$
        ALTER TABLE %I.skaftin_system_payment_transactions
          ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES %I.skaftin_system_payment_plans(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS plan_code VARCHAR(255)
      $fmt$, r.table_schema, r.table_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_transactions_plan_id ON %I.skaftin_system_payment_transactions(plan_id)', r.table_schema);
    END IF;

    RAISE NOTICE 'Added payment plans support in schema: %', r.table_schema;
  END LOOP;
END $$;
