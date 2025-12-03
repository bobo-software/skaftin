-- Migration: Add require_otp_for_password_change field to auth settings
-- Date: 2025-12-03
-- Description: Adds a toggle to control whether OTP verification is required when users change their password

-- Add the new column to auth settings table
ALTER TABLE public.skaftin_system_auth_settings 
ADD COLUMN IF NOT EXISTS require_otp_for_password_change BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.skaftin_system_auth_settings.require_otp_for_password_change 
IS 'When enabled, users must verify their identity via OTP (email or SMS) before changing their password';

