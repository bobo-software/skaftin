#!/bin/bash

# Quick Fix for Production Database - User ID Type Error
# This script fixes the "invalid input syntax for type integer" error
# by converting user_id from INTEGER to VARCHAR(255)

echo "🔧 Fixing Production Database Schema..."
echo "========================================"
echo ""

# Database connection details - UPDATE THESE!
DB_HOST="${DB_HOST:-your-db-host}"
DB_USER="${DB_USER:-your-db-user}"
DB_NAME="${DB_NAME:-skaftin_db}"
DB_PORT="${DB_PORT:-5432}"

echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if connection details are set
if [ "$DB_HOST" = "your-db-host" ]; then
    echo "❌ Error: Please set database connection details"
    echo ""
    echo "Usage:"
    echo "  DB_HOST=your-host DB_USER=your-user DB_NAME=skaftin_db ./PRODUCTION_QUICK_FIX.sh"
    echo ""
    echo "Or edit this script and set the variables at the top"
    exit 1
fi

# Run the migration
echo "Running migration..."
echo ""

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" << 'EOF'
-- Check current schema
\echo 'Current user_id column type:'
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

\echo ''
\echo 'Applying migration...'

-- Fix the user_id column type
DO $$ 
BEGIN
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
    
    RAISE NOTICE 'Migration complete!';
  ELSE
    RAISE NOTICE 'user_id is already VARCHAR - no migration needed';
  END IF;
END $$;

\echo ''
\echo 'New user_id column type:'
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

\echo ''
\echo '✅ Migration complete!'
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database schema fixed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy your updated backend code"
    echo "  2. Test authentication with SuperTokens users"
    echo "  3. Monitor logs for any remaining errors"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

