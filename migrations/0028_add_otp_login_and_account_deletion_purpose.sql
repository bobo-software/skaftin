-- Migration: Add otp_login and account_deletion purpose to OTP verifications check constraint
-- Date: 2026-02-05
-- Description: Updates purpose constraint to include 'otp_login' and 'account_deletion'
--              These purposes are required for passwordless OTP login and account deletion flows

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
        -- Drop old purpose constraint
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            DROP CONSTRAINT IF EXISTS skaftin_system_otp_verifications_purpose_check
        ', schema_record.table_schema);
        
        -- Add new purpose constraint with otp_login and account_deletion included
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            ADD CONSTRAINT skaftin_system_otp_verifications_purpose_check 
            CHECK (purpose IN (''registration'', ''password_reset'', ''password_change'', ''account_deletion'', ''otp_login''))
        ', schema_record.table_schema);
        
        RAISE NOTICE 'Updated purpose constraint in schema: %', schema_record.table_schema;
    END LOOP;
    
    RAISE NOTICE 'Migration complete! All project schemas updated.';
END $$;
