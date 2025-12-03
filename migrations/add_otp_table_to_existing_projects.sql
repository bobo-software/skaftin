-- Add OTP verifications table to all existing project schemas
-- Run this script to add the table to projects that were created before this feature

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
    
    -- Check if table already exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = proj_schema_name 
      AND table_name = 'skaftin_system_otp_verifications'
    ) THEN
      -- Create the table
      EXECUTE format('
        CREATE TABLE %I.skaftin_system_otp_verifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES %I.skaftin_system_users(id) ON DELETE CASCADE,
          otp_code VARCHAR(10) NOT NULL,
          otp_method VARCHAR(10) NOT NULL CHECK (otp_method IN (''email'', ''sms'')),
          destination VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT ''pending'' CHECK (status IN (''pending'', ''verified'', ''expired'', ''failed'')),
          expires_at TIMESTAMP NOT NULL,
          verified_at TIMESTAMP,
          attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      ', proj_schema_name, proj_schema_name);
      
      -- Create indexes
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_otp_user_id ON %I.skaftin_system_otp_verifications(user_id);', proj_schema_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_otp_status ON %I.skaftin_system_otp_verifications(status);', proj_schema_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON %I.skaftin_system_otp_verifications(expires_at);', proj_schema_name);
      
      RAISE NOTICE 'Created skaftin_system_otp_verifications table in schema: %', proj_schema_name;
    ELSE
      RAISE NOTICE 'Table skaftin_system_otp_verifications already exists in schema: %', proj_schema_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;

