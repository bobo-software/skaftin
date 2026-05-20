-- Add app_user_auth_providers table to all existing project schemas.
-- This table links app users to external OAuth identities (e.g. Google).
-- New projects get this table automatically via EnsureAuthSchemaCompatibility.

DO $$
DECLARE
  project_record RECORD;
  proj_schema TEXT;
BEGIN
  FOR project_record IN
    SELECT schema_name FROM public.skaftin_system_projects
    WHERE schema_name IS NOT NULL
      AND deletion_scheduled_at IS NULL
      AND deleted_at IS NULL
  LOOP
    proj_schema := project_record.schema_name;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = proj_schema
        AND table_name = 'app_user_auth_providers'
    ) THEN
      EXECUTE format('
        CREATE TABLE %I.app_user_auth_providers (
          id               SERIAL PRIMARY KEY,
          app_user_id      INTEGER      NOT NULL REFERENCES %I.skaftin_system_users(id) ON DELETE CASCADE,
          provider         VARCHAR(32)  NOT NULL,
          provider_subject VARCHAR(255) NOT NULL,
          email            VARCHAR(255),
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          UNIQUE (provider, provider_subject)
        )
      ', proj_schema, proj_schema);

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_app_user_auth_providers_user ON %I.app_user_auth_providers(app_user_id)',
        proj_schema
      );

      RAISE NOTICE 'Created app_user_auth_providers in schema: %', proj_schema;
    ELSE
      RAISE NOTICE 'app_user_auth_providers already exists in schema: %', proj_schema;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete.';
END $$;
