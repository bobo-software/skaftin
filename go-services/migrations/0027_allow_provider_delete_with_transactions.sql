-- Migration: Allow deleting payment providers when transactions exist
-- Changes provider_id FK from ON DELETE RESTRICT to ON DELETE SET NULL
-- so transactions remain but provider_id becomes NULL when provider is deleted

DO $$
DECLARE
  r RECORD;
  fk_name TEXT;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_payment_transactions'
  LOOP
    -- Find the foreign key constraint on provider_id
    SELECT c.conname INTO fk_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'skaftin_system_payment_transactions'
      AND n.nspname = r.table_schema
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%provider_id%';

    IF fk_name IS NOT NULL THEN
      -- 1. Drop the existing foreign key
      EXECUTE format('ALTER TABLE %I.skaftin_system_payment_transactions DROP CONSTRAINT IF EXISTS %I',
        r.table_schema, fk_name);

      -- 2. Allow provider_id to be NULL
      EXECUTE format('ALTER TABLE %I.skaftin_system_payment_transactions ALTER COLUMN provider_id DROP NOT NULL',
        r.table_schema);

      -- 3. Add new foreign key with ON DELETE SET NULL
      EXECUTE format(
        'ALTER TABLE %I.skaftin_system_payment_transactions ADD CONSTRAINT skaftin_system_payment_transactions_provider_id_fkey '
        || 'FOREIGN KEY (provider_id) REFERENCES %I.skaftin_system_payment_providers(id) ON DELETE SET NULL',
        r.table_schema, r.table_schema
      );

      RAISE NOTICE 'Updated provider_id FK in schema: %', r.table_schema;
    END IF;
  END LOOP;
END $$;
