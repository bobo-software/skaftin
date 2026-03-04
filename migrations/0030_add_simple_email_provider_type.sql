-- Migration: Add 'simple' as a valid email provider_type
-- Allows the simplified username/password setup for known email services

DO $$
DECLARE
  r RECORD;
  constraint_name TEXT;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_email_providers'
  LOOP
    -- Find the check constraint on provider_type
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'skaftin_system_email_providers'
      AND n.nspname = r.table_schema
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%provider_type%';

    -- Drop old constraint
    EXECUTE format('ALTER TABLE %I.skaftin_system_email_providers DROP CONSTRAINT IF EXISTS skaftin_system_email_providers_provider_type_check',
      r.table_schema);
    IF constraint_name IS NOT NULL AND constraint_name != 'skaftin_system_email_providers_provider_type_check' THEN
      EXECUTE format('ALTER TABLE %I.skaftin_system_email_providers DROP CONSTRAINT IF EXISTS %I',
        r.table_schema, constraint_name);
    END IF;

    -- Add new constraint including 'simple'
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_email_providers ADD CONSTRAINT skaftin_system_email_providers_provider_type_check CHECK (provider_type IN (''nodemailer'', ''mailtrap'', ''simple''))',
      r.table_schema
    );

    RAISE NOTICE 'Updated email provider_type constraint in schema: %', r.table_schema;
  END LOOP;
END $$;
