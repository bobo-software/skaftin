-- Migration: Remove foreign key constraint from platform.projects
-- This allows the projects table to use SuperTokens user IDs instead of auth.users

-- Drop the foreign key constraint
ALTER TABLE platform.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

-- Change user_id column type to VARCHAR to support SuperTokens user IDs
ALTER TABLE platform.projects ALTER COLUMN user_id TYPE VARCHAR(255);

-- Add comment to document the change
COMMENT ON COLUMN platform.projects.user_id IS 'SuperTokens user ID (string format)';
