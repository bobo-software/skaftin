-- Add last_name column to all existing project schemas
-- This ensures all skaftin_system_users tables have the last_name column
-- which is required by the createUserWithTransaction function

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
      -- Add last_name if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = proj_schema_name 
        AND table_name = 'skaftin_system_users' 
        AND column_name = 'last_name'
      ) THEN
        EXECUTE format('ALTER TABLE %I.skaftin_system_users ADD COLUMN last_name VARCHAR(255);', proj_schema_name);
        RAISE NOTICE 'Added last_name to schema: %', proj_schema_name;
      ELSE
        RAISE NOTICE 'last_name already exists in schema: %', proj_schema_name;
      END IF;
    ELSE
      RAISE NOTICE 'Table skaftin_system_users does not exist in schema: %', proj_schema_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;
