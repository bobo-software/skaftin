-- ============================================================================
-- 🚨 RUN THIS ON YOUR PRODUCTION DATABASE
-- ============================================================================
-- This fixes the user_id column type to support SuperTokens UUIDs
-- 
-- HOW TO RUN:
-- 1. In Coolify, go to your PostgreSQL database service
-- 2. Click "Execute Command" or connect via psql
-- 3. Copy and paste this entire file
-- 4. Press Enter
--
-- OR via command line:
-- psql -h <host> -U <user> -d skaftin_db -f migrations/RUN_THIS_ON_PRODUCTION.sql
-- ============================================================================

-- First, let's see what we have
\echo '📊 Current projects table schema:'
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;

\echo ''
\echo '🔄 Starting migration...'
\echo ''

-- Main migration
DO $$ 
DECLARE
  current_type text;
BEGIN
  -- Check current column type
  SELECT data_type INTO current_type
  FROM information_schema.columns 
  WHERE table_name='projects' 
  AND column_name='user_id';
  
  RAISE NOTICE 'Current user_id type: %', current_type;
  
  -- Check if user_id is INTEGER and needs conversion
  IF current_type = 'integer' THEN
    
    RAISE NOTICE '🔧 Converting user_id from INTEGER to VARCHAR(255)...';
    
    -- Drop foreign key constraint if it exists
    BEGIN
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
      RAISE NOTICE '✅ Dropped foreign key constraint (if existed)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ℹ️  No foreign key constraint to drop';
    END;
    
    -- Drop old index if exists
    BEGIN
      DROP INDEX IF EXISTS idx_projects_user_id;
      RAISE NOTICE '✅ Dropped old index (if existed)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ℹ️  No old index to drop';
    END;
    
    -- Change column type to VARCHAR
    ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
    RAISE NOTICE '✅ Changed user_id column type to VARCHAR(255)';
    
    -- Recreate index
    CREATE INDEX idx_projects_user_id ON projects(user_id);
    RAISE NOTICE '✅ Created index on user_id';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 MIGRATION COMPLETE! user_id is now VARCHAR(255)';
    RAISE NOTICE '';
    
  ELSIF current_type = 'character varying' THEN
    RAISE NOTICE '✅ user_id is already VARCHAR - no migration needed';
  ELSE
    RAISE WARNING '⚠️  Unexpected user_id type: %', current_type;
  END IF;
END $$;

-- Verify the change
\echo ''
\echo '✅ Verification - Updated schema:'
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;

-- Show current projects (if any)
\echo ''
\echo '📁 Current projects in database:'
SELECT 
  id,
  name,
  user_id,
  schema_name,
  created_at
FROM projects
ORDER BY created_at DESC
LIMIT 10;

\echo ''
\echo '✅ Done! You can now restart your backend service in Coolify.'
\echo ''

