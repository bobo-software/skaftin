-- Migration: Update payment provider types to payfast and fnb_pay only
-- Removes yoco, paystack, peach_payments, ozow, flutterwave

-- Update CHECK constraint on skaftin_system_payment_providers in ALL schemas that have it
-- Uses pg_constraint to find the actual constraint name (may vary by PG version)
DO $$
DECLARE
  r RECORD;
  constraint_name TEXT;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_payment_providers'
  LOOP
    -- Find the check constraint on provider_type
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'skaftin_system_payment_providers'
      AND n.nspname = r.table_schema
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%provider_type%';

    -- Drop old constraint (try both standard name and actual name from pg_constraint)
    EXECUTE format('ALTER TABLE %I.skaftin_system_payment_providers DROP CONSTRAINT IF EXISTS skaftin_system_payment_providers_provider_type_check',
      r.table_schema);
    IF constraint_name IS NOT NULL AND constraint_name != 'skaftin_system_payment_providers_provider_type_check' THEN
      EXECUTE format('ALTER TABLE %I.skaftin_system_payment_providers DROP CONSTRAINT IF EXISTS %I',
        r.table_schema, constraint_name);
    END IF;

    -- Add new constraint
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_payment_providers ADD CONSTRAINT skaftin_system_payment_providers_provider_type_check CHECK (provider_type IN (''payfast'', ''fnb_pay''))',
      r.table_schema
    );

    RAISE NOTICE 'Updated provider_type constraint in schema: %', r.table_schema;
  END LOOP;
END $$;
