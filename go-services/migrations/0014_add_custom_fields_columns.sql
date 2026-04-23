-- Add custom_field_1 and custom_field_2 columns to all existing project schemas
-- These are standard custom fields available by default

DO $$
DECLARE
  project_record RECORD;
  proj_schema_name TEXT;
BEGIN
  -- Loop through all projects
  FOR project_record IN 
    SELECT id, p.schema_name FROM skaftin_system_projects p WHERE p.schema_name IS NOT NULL
  LOOP
    proj_schema_name := project_record.schema_name;
    
    -- Check if skaftin_system_users table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = proj_schema_name 
      AND table_name = 'skaftin_system_users'
    ) THEN
      -- Add custom_field_1 if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = proj_schema_name 
        AND table_name = 'skaftin_system_users' 
        AND column_name = 'custom_field_1'
      ) THEN
        EXECUTE format('ALTER TABLE %I.skaftin_system_users ADD COLUMN custom_field_1 VARCHAR(255);', proj_schema_name);
        RAISE NOTICE 'Added custom_field_1 to schema: %', proj_schema_name;
      ELSE
        RAISE NOTICE 'custom_field_1 already exists in schema: %', proj_schema_name;
      END IF;

      -- Add custom_field_2 if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = proj_schema_name 
        AND table_name = 'skaftin_system_users' 
        AND column_name = 'custom_field_2'
      ) THEN
        EXECUTE format('ALTER TABLE %I.skaftin_system_users ADD COLUMN custom_field_2 VARCHAR(255);', proj_schema_name);
        RAISE NOTICE 'Added custom_field_2 to schema: %', proj_schema_name;
      ELSE
        RAISE NOTICE 'custom_field_2 already exists in schema: %', proj_schema_name;
      END IF;

      -- Create indexes
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_custom_field_1 ON %I.skaftin_system_users(custom_field_1);', proj_schema_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_custom_field_2 ON %I.skaftin_system_users(custom_field_2);', proj_schema_name);
      
      RAISE NOTICE 'Indexes created for custom fields in schema: %', proj_schema_name;
    ELSE
      RAISE NOTICE 'Table skaftin_system_users does not exist in schema: %', proj_schema_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;

