-- Migration: Hard cleanup email provider_type values
-- nodemailer -> smtp
-- simple     -> aws_ses
-- Enforce allowed values: smtp, mailtrap, aws_ses

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
    -- Normalize existing legacy values in this schema.
    EXECUTE format(
      'UPDATE %I.skaftin_system_email_providers SET provider_type = ''smtp'' WHERE provider_type = ''nodemailer''',
      r.table_schema
    );
    EXECUTE format(
      'UPDATE %I.skaftin_system_email_providers SET provider_type = ''aws_ses'' WHERE provider_type = ''simple''',
      r.table_schema
    );

    -- Find existing provider_type check constraint (name may vary).
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'skaftin_system_email_providers'
      AND n.nspname = r.table_schema
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%provider_type%';

    -- Drop old constraint(s).
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_email_providers DROP CONSTRAINT IF EXISTS skaftin_system_email_providers_provider_type_check',
      r.table_schema
    );
    IF constraint_name IS NOT NULL AND constraint_name != 'skaftin_system_email_providers_provider_type_check' THEN
      EXECUTE format(
        'ALTER TABLE %I.skaftin_system_email_providers DROP CONSTRAINT IF EXISTS %I',
        r.table_schema, constraint_name
      );
    END IF;

    -- Add strict constraint.
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_email_providers ADD CONSTRAINT skaftin_system_email_providers_provider_type_check CHECK (provider_type IN (''smtp'', ''mailtrap'', ''aws_ses''))',
      r.table_schema
    );

    RAISE NOTICE 'Hard-cleaned email provider_type values and constraints in schema: %', r.table_schema;
  END LOOP;
END $$;
