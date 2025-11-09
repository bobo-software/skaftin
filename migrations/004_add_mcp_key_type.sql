-- Migration: Add mcp_key to api_credentials credential_type constraint
-- Date: 2025-11-09
-- Description: Updates the api_credentials table to support the new mcp_key credential type

-- Drop the old constraint
ALTER TABLE public.api_credentials 
DROP CONSTRAINT IF EXISTS api_credentials_credential_type_check;

-- Add the new constraint with mcp_key included
ALTER TABLE public.api_credentials 
ADD CONSTRAINT api_credentials_credential_type_check 
CHECK (credential_type IN ('api_key', 'access_token', 'mcp_key'));

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004: Added mcp_key to credential_type constraint';
END $$;

