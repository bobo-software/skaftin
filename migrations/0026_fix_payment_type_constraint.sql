-- Migration: Fix payment_type constraint - change 'once' to 'once_off'
-- DatabaseInitializer used 'once' but code expects 'once_off'

DO $$
DECLARE
  r RECORD;
  constraint_name TEXT;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_payment_transactions'
  LOOP
    -- Find the check constraint on payment_type
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'skaftin_system_payment_transactions'
      AND n.nspname = r.table_schema
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%payment_type%';

    -- 1. Drop old constraint first (so we can update 'once' -> 'once_off')
    EXECUTE format('ALTER TABLE %I.skaftin_system_payment_transactions DROP CONSTRAINT IF EXISTS skaftin_system_payment_transactions_payment_type_check',
      r.table_schema);
    IF constraint_name IS NOT NULL AND constraint_name != 'skaftin_system_payment_transactions_payment_type_check' THEN
      EXECUTE format('ALTER TABLE %I.skaftin_system_payment_transactions DROP CONSTRAINT IF EXISTS %I',
        r.table_schema, constraint_name);
    END IF;

    -- 2. Update any existing 'once' to 'once_off'
    EXECUTE format(
      'UPDATE %I.skaftin_system_payment_transactions SET payment_type = ''once_off'' WHERE payment_type = ''once''',
      r.table_schema
    );

    -- 3. Add new constraint with once_off
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_payment_transactions ADD CONSTRAINT skaftin_system_payment_transactions_payment_type_check CHECK (payment_type IN (''once_off'', ''subscription''))',
      r.table_schema
    );

    RAISE NOTICE 'Updated payment_type constraint in schema: %', r.table_schema;
  END LOOP;
END $$;
