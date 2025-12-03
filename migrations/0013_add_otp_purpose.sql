-- Add purpose column to OTP verifications table to distinguish between registration and password reset
-- This migration adds the column to all existing project schemas

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
    
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = proj_schema_name 
      AND table_name = 'skaftin_system_otp_verifications'
    ) THEN
      -- Check if column doesn't exist yet
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = proj_schema_name 
        AND table_name = 'skaftin_system_otp_verifications'
        AND column_name = 'purpose'
      ) THEN
        -- Add purpose column with default value 'registration' for existing records
        EXECUTE format('
          ALTER TABLE %I.skaftin_system_otp_verifications 
          ADD COLUMN purpose VARCHAR(20) NOT NULL DEFAULT ''registration'' 
          CHECK (purpose IN (''registration'', ''password_reset''));
        ', proj_schema_name);
        
        RAISE NOTICE 'Added purpose column to skaftin_system_otp_verifications in schema: %', proj_schema_name;
      ELSE
        RAISE NOTICE 'Purpose column already exists in schema: %', proj_schema_name;
      END IF;
    ELSE
      RAISE NOTICE 'Table skaftin_system_otp_verifications does not exist in schema: %', proj_schema_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;

