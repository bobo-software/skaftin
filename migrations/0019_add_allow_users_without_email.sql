-- Migration: Add allow_users_without_email field to auth_settings
-- Date: 2025-12-XX
-- Description: Allows projects to configure whether users can be created without email addresses

-- Add allow_users_without_email column
ALTER TABLE public.skaftin_system_auth_settings 
ADD COLUMN IF NOT EXISTS allow_users_without_email BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.skaftin_system_auth_settings.allow_users_without_email IS 'Allow creating users without email addresses (email can be null)';

