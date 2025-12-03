-- Migration: Add metadata column and password_change purpose to OTP verifications
-- Date: 2025-12-03
-- Description: Adds metadata JSONB column to store additional data (like new password temporarily)
--              and updates purpose constraint to include 'password_change'

-- Function to update all project schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    -- Loop through all project schemas that have the OTP table
    FOR schema_record IN 
        SELECT DISTINCT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'skaftin_system_otp_verifications'
        AND table_schema LIKE 'project_%'
    LOOP
        -- Add metadata column if it doesn't exist
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb
        ', schema_record.table_schema);
        
        -- Drop old purpose constraint
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            DROP CONSTRAINT IF EXISTS skaftin_system_otp_verifications_purpose_check
        ', schema_record.table_schema);
        
        -- Add new purpose constraint with password_change included
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            ADD CONSTRAINT skaftin_system_otp_verifications_purpose_check 
            CHECK (purpose IN (''registration'', ''password_reset'', ''password_change''))
        ', schema_record.table_schema);
        
        RAISE NOTICE 'Updated schema: %', schema_record.table_schema;
    END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN project_kcd_local_1763958053841.skaftin_system_otp_verifications.metadata 
IS 'JSONB field to store additional data like temporarily encrypted new password for password change flow';

