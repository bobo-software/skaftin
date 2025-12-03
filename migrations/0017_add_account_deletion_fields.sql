-- Migration: Add account deletion fields to users table
-- Date: 2025-12-03
-- Description: Adds fields for soft delete with grace period functionality

-- Function to update all project schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    -- Loop through all project schemas that have the users table
    FOR schema_record IN 
        SELECT DISTINCT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'skaftin_system_users'
        AND table_schema LIKE 'project_%'
    LOOP
        -- Add deletion_requested_at column
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_users 
            ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP
        ', schema_record.table_schema);
        
        -- Add deletion_scheduled_at column
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_users 
            ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMP
        ', schema_record.table_schema);
        
        -- Add deletion_reason column
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_users 
            ADD COLUMN IF NOT EXISTS deletion_reason TEXT
        ', schema_record.table_schema);
        
        -- Add deleted_at column if it doesn't exist (for final soft delete)
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_users 
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
        ', schema_record.table_schema);
        
        -- Add index for efficient deletion processing
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled 
            ON %I.skaftin_system_users (deletion_scheduled_at) 
            WHERE deletion_scheduled_at IS NOT NULL AND deleted_at IS NULL
        ', schema_record.table_schema);
        
        RAISE NOTICE 'Updated schema: %', schema_record.table_schema;
    END LOOP;
END $$;

-- Add column to auth settings for OTP requirement
ALTER TABLE public.skaftin_system_auth_settings 
ADD COLUMN IF NOT EXISTS require_otp_for_account_deletion BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.skaftin_system_auth_settings.require_otp_for_account_deletion 
IS 'When enabled, users must verify via OTP (email or SMS) before scheduling account deletion';

-- Update OTP purpose constraint to include account_deletion
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT DISTINCT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'skaftin_system_otp_verifications'
        AND table_schema LIKE 'project_%'
    LOOP
        -- Drop old constraint
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            DROP CONSTRAINT IF EXISTS skaftin_system_otp_verifications_purpose_check
        ', schema_record.table_schema);
        
        -- Add new constraint with account_deletion
        EXECUTE format('
            ALTER TABLE %I.skaftin_system_otp_verifications 
            ADD CONSTRAINT skaftin_system_otp_verifications_purpose_check 
            CHECK (purpose IN (''registration'', ''password_reset'', ''password_change'', ''account_deletion''))
        ', schema_record.table_schema);
        
        RAISE NOTICE 'Updated OTP constraints in schema: %', schema_record.table_schema;
    END LOOP;
END $$;

