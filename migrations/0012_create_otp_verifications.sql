-- Migration: Create OTP Verifications Table
-- Description: Add table to track OTP verification attempts with audit trail
-- Date: 2025-12-02

-- This migration needs to be run on all project schemas
-- The table will be created in each project schema dynamically

-- Template SQL for project schemas (executed by DatabaseInitializer)
-- CREATE TABLE IF NOT EXISTS {schema}.skaftin_system_otp_verifications (
--   id SERIAL PRIMARY KEY,
--   user_id INTEGER NOT NULL REFERENCES {schema}.skaftin_system_users(id) ON DELETE CASCADE,
--   otp_code VARCHAR(10) NOT NULL,
--   otp_method VARCHAR(10) NOT NULL CHECK (otp_method IN ('email', 'sms')),
--   destination VARCHAR(255) NOT NULL,
--   status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
--   expires_at TIMESTAMP NOT NULL,
--   verified_at TIMESTAMP,
--   attempts INTEGER DEFAULT 0,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
--
-- CREATE INDEX idx_otp_user_id ON {schema}.skaftin_system_otp_verifications(user_id);
-- CREATE INDEX idx_otp_status ON {schema}.skaftin_system_otp_verifications(status);
-- CREATE INDEX idx_otp_expires_at ON {schema}.skaftin_system_otp_verifications(expires_at);

-- Note: This table is created programmatically in DatabaseInitializer.ts
-- This file serves as documentation of the schema structure

