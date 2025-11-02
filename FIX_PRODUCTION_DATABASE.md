# 🚨 Fix Production Database - User ID Type Error

## Problem
Your production database has `user_id` as **INTEGER**, but SuperTokens generates **UUID strings**.

Error: `invalid input syntax for type integer: "3aeb0fdc-3418-467e-b4d7-11f764ed5a59"`

## Quick Fix (Run on Production Database)

### Option 1: Using psql (Recommended)

```bash
# Connect to your production database
psql -h your-db-host -U your-db-user -d skaftin_db

# Run this SQL:
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

# Verify the change:
\d projects
```

### Option 2: Using the Migration File

```bash
# Copy the migration file to your server
scp migrations/002_fix_user_id_type.sql your-server:/tmp/

# On your server, run:
psql -h your-db-host -U your-db-user -d skaftin_db -f /tmp/002_fix_user_id_type.sql
```

### Option 3: Using Docker (if database is in Docker)

```bash
# Copy migration to container
docker cp migrations/002_fix_user_id_type.sql your-postgres-container:/tmp/

# Execute it
docker exec your-postgres-container psql -U postgres -d skaftin_db -f /tmp/002_fix_user_id_type.sql
```

## What I Fixed in the Code

### ✅ Updated `DatabaseInitializer.ts`
- Changed `user_id` from `INTEGER` to `VARCHAR(255)`
- Added automatic migration for existing databases
- Now compatible with SuperTokens UUIDs

### ✅ Created Migration File
- `migrations/002_fix_user_id_type.sql` - Run this on production

### ✅ Schema Already Correct
- `ProjectsSchema.ts` was already using `VARCHAR(255)`

## After Applying the Fix

Once you run the migration, your production errors will stop. The next deployment will include the updated `DatabaseInitializer.ts` which will handle this automatically for new environments.

## Verify the Fix

After running the migration:

```sql
-- Check the column type
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- Should show:
-- user_id | character varying | 255
```

## Test Authentication

After the fix, test login:
```bash
curl -X POST https://api.bobosoftware.co.za/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "formFields": [
      {"id": "email", "value": "sibiya.bobo@gmail.com"},
      {"id": "password", "value": "your-password"}
    ]
  }'
```

You should no longer see the "invalid input syntax" error! ✅

