# 🚨 URGENT: Production Database Fix Required

## Quick Summary

Your production app is failing because the `projects` table has `user_id` as **INTEGER**, but SuperTokens uses **UUID strings**.

```
Error: invalid input syntax for type integer: "3aeb0fdc-3418-467e-b4d7-11f764ed5a59"
```

## ⚡ Quick Fix (Copy & Paste)

### Option 1: One-Line SQL Fix

Connect to your production database and run:

```sql
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
```

### Option 2: Use the Fix Script

```bash
# Set your database credentials and run:
DB_HOST=your-db-host \
DB_USER=your-db-user \
DB_PASSWORD=your-db-password \
DB_NAME=skaftin_db \
./PRODUCTION_QUICK_FIX.sh
```

### Option 3: Manual psql

```bash
psql -h your-db-host -U your-db-user -d skaftin_db << 'EOF'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
EOF
```

## 📦 What Was Fixed in the Code

### ✅ Files Updated:
1. **src/services/DatabaseInitializer.ts**
   - Changed `user_id` from INTEGER to VARCHAR(255)
   - Added automatic migration for existing databases

2. **migrations/002_fix_user_id_type.sql**
   - Standalone migration file

3. **Documentation:**
   - SUPERTOKENS_SCHEMA_FIX_COMPLETE.md (detailed guide)
   - FIX_PRODUCTION_DATABASE.md (instructions)
   - PRODUCTION_QUICK_FIX.sh (automated script)

## 🔄 After Applying the Fix

1. **Rebuild and Deploy Backend:**
```bash
# The updated code is ready
# Just rebuild and push your Docker image
docker build -t skaftin-backend:latest .
```

2. **Test Authentication:**
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

3. **Verify Projects Load:**
The error should be gone and user info should load correctly!

## 📊 Changes Summary

| Item | Before | After |
|------|--------|-------|
| `user_id` type | INTEGER | VARCHAR(255) |
| Foreign Key | `REFERENCES users(id)` | None (SuperTokens manages users) |
| Index | `idx_projects_user_id` (integer) | `idx_projects_user_id` (varchar) |
| Compatible with | Old integer user IDs | SuperTokens UUID strings ✅ |

## 🎯 Timeline

1. **NOW**: Apply database migration (5 minutes)
2. **NEXT**: Deploy updated backend code (10 minutes)
3. **TEST**: Verify authentication works (5 minutes)
4. **DONE**: Production fixed! ✅

## 📚 More Information

- **Detailed Guide**: SUPERTOKENS_SCHEMA_FIX_COMPLETE.md
- **Migration File**: migrations/002_fix_user_id_type.sql
- **Test Script**: test-supertokens.sh (for local testing)

---

**Priority**: 🔴 CRITICAL  
**Estimated Fix Time**: 5-10 minutes  
**Downtime Required**: None (migration runs instantly)

