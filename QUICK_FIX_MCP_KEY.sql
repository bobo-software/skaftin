-- Quick Fix: Add mcp_key support to api_credentials table
-- Run this SQL on your database to fix the constraint error

-- Drop the old constraint
ALTER TABLE public.api_credentials 
DROP CONSTRAINT IF EXISTS api_credentials_credential_type_check;

-- Add the new constraint with mcp_key included
ALTER TABLE public.api_credentials 
ADD CONSTRAINT api_credentials_credential_type_check 
CHECK (credential_type IN ('api_key', 'access_token', 'mcp_key'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.api_credentials'::regclass 
  AND conname = 'api_credentials_credential_type_check';

