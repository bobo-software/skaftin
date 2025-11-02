-- Migration: Fix user_id column type for SuperTokens UUID support
-- This migration converts user_id from INTEGER to VARCHAR(255)
-- Run this on production database to fix the "invalid input syntax for type integer" error

-- Check current column type
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- Fix the user_id column type
DO $$ 
BEGIN
  -- Check if user_id is INTEGER and needs conversion
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='projects' 
    AND column_name='user_id' 
    AND data_type='integer'
  ) THEN
    
    RAISE NOTICE 'Converting user_id from INTEGER to VARCHAR(255)...';
    
    -- Drop foreign key constraint if it exists
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
    
    -- Drop old index if exists
    DROP INDEX IF EXISTS idx_projects_user_id;
    
    -- Change column type to VARCHAR
    ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
    
    -- Recreate index
    CREATE INDEX idx_projects_user_id ON projects(user_id);
    
    RAISE NOTICE 'Migration complete! user_id is now VARCHAR(255)';
  ELSE
    RAISE NOTICE 'user_id is already VARCHAR - no migration needed';
  END IF;
END $$;

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- Show current projects
SELECT * FROM projects;

