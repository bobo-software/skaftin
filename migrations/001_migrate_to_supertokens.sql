-- Migration: Switch from custom users table to SuperTokens
-- This migration:
-- 1. Removes existing test data from projects
-- 2. Drops the custom users table
-- 3. Updates projects table to use SuperTokens user IDs (VARCHAR instead of INTEGER)

-- Step 1: Clear existing projects (if any)
TRUNCATE TABLE projects CASCADE;

-- Step 2: Drop the old users table (SuperTokens will manage users)
DROP TABLE IF EXISTS users CASCADE;

-- Step 3: Update projects table to use VARCHAR user_id for SuperTokens UUIDs
ALTER TABLE projects 
  ALTER COLUMN user_id TYPE VARCHAR(255);

-- Step 4: Add index on user_id for better query performance  
CREATE INDEX IF NOT EXISTS idx_projects_user_id_varchar ON projects(user_id);

-- Migration complete!
-- SuperTokens will create its own tables in the 'supertokens' schema

