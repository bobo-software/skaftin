# Database Migration - Request Logs Feature
**Date:** February 6, 2026  
**Feature:** API Request Logging System

---

## Overview

This migration adds a centralized request logging system that tracks all API requests made to project endpoints. Logs are stored in a single public schema table with `project_id` for filtering.

---

## Migration Script

Run the following SQL on your production database:

```sql
-- Migration: Add request logs table to public schema
-- This table stores API request logs for all projects, with project_id to filter by project

-- Create the request logs table in public schema
CREATE TABLE IF NOT EXISTS public.skaftin_system_request_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    request_id UUID DEFAULT gen_random_uuid(),
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_request_logs_project_id ON public.skaftin_system_request_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.skaftin_system_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON public.skaftin_system_request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_project_created ON public.skaftin_system_request_logs(project_id, created_at);
```

---

## Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `project_id` | INTEGER | Foreign key to `skaftin_system_projects` |
| `request_id` | UUID | Unique identifier for each request |
| `method` | VARCHAR(10) | HTTP method (GET, POST, PUT, DELETE, PATCH) |
| `url` | TEXT | Request URL |
| `status_code` | INTEGER | HTTP response status code |
| `request_payload` | JSONB | Request body (truncated for large payloads) |
| `response_data` | JSONB | Response body (truncated for large payloads) |
| `error_message` | TEXT | Error message if request failed |
| `duration_ms` | INTEGER | Request duration in milliseconds |
| `user_id` | INTEGER | User ID if authenticated |
| `ip_address` | VARCHAR(45) | Client IP address |
| `user_agent` | TEXT | Client user agent string |
| `created_at` | TIMESTAMP | When the request was logged |

---

## Configuration

Request logging settings are stored in the existing `skaftin_system_auth_settings` table's `settings_json` JSONB column. **No migration needed for this** - it uses the existing JSONB structure.

Settings added to `settings_json`:
- `request_logging_enabled` (boolean) - Enable/disable logging for the project
- `request_log_retention` (string) - Retention period: `'daily'`, `'weekly'`, `'monthly'`, or `'disabled'`

Example settings JSON:
```json
{
  "request_logging_enabled": true,
  "request_log_retention": "weekly"
}
```

---

## Post-Migration Notes

1. **Automatic Cleanup**: A cron job runs daily at 3 AM UTC to delete logs older than the retention period
2. **Payload Truncation**: Large request/response payloads are automatically truncated to ~10KB to save storage
3. **Logged Routes**: Only requests to `/app-api/*` endpoints are logged (client-facing API routes)

---

## Verification

After running the migration, verify with:

```sql
-- Check table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'skaftin_system_request_logs'
);

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'skaftin_system_request_logs';
```

---

## Rollback (if needed)

```sql
-- WARNING: This will delete all request logs!
DROP TABLE IF EXISTS public.skaftin_system_request_logs CASCADE;
```
