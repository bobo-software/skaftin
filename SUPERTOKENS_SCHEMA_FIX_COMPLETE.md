# SuperTokens Schema Fix - Complete ✅

## 🔍 Problem Identified

Your production logs showed this error:
```
error: invalid input syntax for type integer: "3aeb0fdc-3418-467e-b4d7-11f764ed5a59"
```

**Root Cause:**
- SuperTokens generates **UUID strings** for user IDs (e.g., `3aeb0fdc-3418-467e-b4d7-11f764ed5a59`)
- Your `projects` table had `user_id` defined as **INTEGER**
- When the middleware tried to query projects by user_id, PostgreSQL rejected the UUID string

## ✅ What Was Fixed

### 1. Updated DatabaseInitializer.ts
Changed the projects table initialization to:
- Use `VARCHAR(255)` instead of `INTEGER` for `user_id`
- Added automatic migration to convert existing INTEGER columns
- Removed foreign key constraint (SuperTokens users are in separate schema)

**Before:**
```typescript
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

**After:**
```typescript
user_id VARCHAR(255) NOT NULL  // SuperTokens UUID
```

### 2. Created Migration Scripts
- `migrations/002_fix_user_id_type.sql` - Standalone SQL migration
- Automatic migration built into DatabaseInitializer

### 3. Schema Already Correct
- `src/db/schemas/ProjectsSchema.ts` was already using VARCHAR(255) ✅
- Middleware code was already correct ✅

## 🚀 How to Fix Production Database

### **IMPORTANT: Run this on your production database NOW**

Connect to your production PostgreSQL database and run:

```sql
-- Fix the user_id column type
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
```

### Alternative: Use the Migration File

```bash
# Option 1: Using psql directly
psql -h your-db-host -U your-db-user -d skaftin_db << 'EOF'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
EOF

# Option 2: Using the migration file
psql -h your-db-host -U your-db-user -d skaftin_db -f migrations/002_fix_user_id_type.sql
```

## 🔄 Deploy Updated Code

After fixing the database, deploy your updated backend code to Coolify:

```bash
# The updated files:
- src/services/DatabaseInitializer.ts (fixed)
- migrations/002_fix_user_id_type.sql (new)
```

### Build and Deploy

```bash
# Build Docker image
docker build -t skaftin-backend:latest .

# Push to your registry (if using one)
docker push your-registry/skaftin-backend:latest

# Or deploy directly via Coolify
```

## 🧪 Verify the Fix

### Check Database Schema
```sql
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- Should show:
-- user_id | character varying | 255
```

### Test Authentication
```bash
# Sign in with SuperTokens user
curl -X POST https://api.bobosoftware.co.za/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "formFields": [
      {"id": "email", "value": "sibiya.bobo@gmail.com"},
      {"id": "password", "value": "your-password"}
    ]
  }'

# Should return success with session tokens
# No more "invalid input syntax for type integer" error!
```

### Check User Projects
```bash
# After signing in, get user info
curl -X GET https://api.bobosoftware.co.za/api/users/me \
  -H "Cookie: sAccessToken=your-token-here"

# Should successfully fetch user's projects
```

## 📋 What Happens in Each Environment

### Local Development
- ✅ Already fixed (public.projects has VARCHAR)
- ✅ Updated code will prevent issues in new setups
- ✅ Automatic migration runs on startup

### Production (Coolify)
- ⚠️ Database needs manual migration (run SQL above)
- ✅ Deploy updated code after fixing database
- ✅ Future deployments will use correct schema

## 🔐 Security Notes

### SuperTokens User ID Format
- **Type:** UUID v4 string
- **Length:** 36 characters (e.g., `3aeb0fdc-3418-467e-b4d7-11f764ed5a59`)
- **Storage:** VARCHAR(255) provides plenty of room

### No Foreign Key Constraint
- SuperTokens users are stored in `supertokens` schema
- Your app tables can't have FK to SuperTokens tables
- Use `user_id` string for lookups instead

## 📊 Database Architecture

```
┌─────────────────────────────────────────────────────┐
│              PostgreSQL Database                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Schema: supertokens                                 │
│  ├── emailpassword_users                            │
│  │   ├── user_id: UUID (managed by SuperTokens)    │
│  │   ├── email                                       │
│  │   └── ... (40 tables total)                      │
│                                                      │
│  Schema: public                                      │
│  ├── projects                                        │
│  │   ├── id: SERIAL                                 │
│  │   ├── user_id: VARCHAR(255) ← SuperTokens UUID  │
│  │   ├── name                                        │
│  │   └── ...                                         │
│  │                                                   │
│  └── (your other tables)                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 🎯 Next Steps

1. ✅ Run the SQL migration on production database
2. ✅ Deploy updated backend code
3. ⬜ Test authentication and user projects
4. ⬜ Monitor logs for any remaining errors
5. ⬜ Update any other tables that might have user_id foreign keys

## 🆘 Troubleshooting

### Still Getting Integer Error?
- Verify migration was applied: `\d projects` in psql
- Check you're connected to correct database
- Restart backend after database migration

### Projects Not Loading?
- Clear existing projects: `TRUNCATE projects;`
- Users may need to recreate projects with UUID user_ids

### Session Issues?
- Check SUPERTOKENS_CONNECTION_URI is correct
- Verify SuperTokens service is running
- Check API keys match between backend and SuperTokens

---

**Status**: Code fixed ✅ | Database migration required ⚠️  
**Priority**: HIGH - Apply database migration ASAP  
**Impact**: Authentication will fail until migration is applied

