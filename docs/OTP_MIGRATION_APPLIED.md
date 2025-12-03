# OTP Table Migration Applied

## Migration Executed
**Date:** December 2, 2025  
**Script:** `migrations/add_otp_table_to_existing_projects.sql`

## What Was Done

Successfully added the `skaftin_system_otp_verifications` table to all existing project schemas in the database.

### Schemas Updated
1. ✅ `project_kcd_local_1763958053841`
2. ✅ `project_taxi_admin_1764134341736`

### Table Structure Created

```sql
CREATE TABLE {schema}.skaftin_system_otp_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES {schema}.skaftin_system_users(id) ON DELETE CASCADE,
  otp_code VARCHAR(10) NOT NULL,
  otp_method VARCHAR(10) NOT NULL CHECK (otp_method IN ('email', 'sms')),
  destination VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes Created
- `idx_otp_user_id` - Fast user lookups
- `idx_otp_status` - Status filtering
- `idx_otp_expires_at` - Expiration checks

## Resolution

The error:
```
relation "project_taxi_admin_1764134341736.skaftin_system_otp_verifications" does not exist
```

Has been **RESOLVED**. The table now exists in all project schemas.

## Testing

You can now:
1. ✅ View OTP status: `GET /api/auth/2/users/6/otp-status`
2. ✅ Resend OTP: `POST /api/auth/2/users/6/resend-otp`
3. ✅ Manual verify: `POST /api/auth/2/users/6/manual-verify`
4. ✅ Register with OTP: `POST /api/app-auth/auth/register` with `otp_method`

## Future Projects

For any new projects created after this migration, the `skaftin_system_otp_verifications` table will be automatically created by the `DatabaseInitializer.initializeProjectAuthTables()` method.

No further manual migration will be needed.

## Verification

To verify the table exists in a specific schema:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'project_taxi_admin_1764134341736' 
  AND table_name = 'skaftin_system_otp_verifications'
);
```

Should return `true`.

