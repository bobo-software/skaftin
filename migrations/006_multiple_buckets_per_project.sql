-- Migration 006: Multiple Buckets Per Project
-- Date: 2025-01-XX
-- Description: Migrate from single bucket per project to multiple buckets per project
-- Impact: Projects can now have multiple storage buckets, requires explicit bucket selection

BEGIN;

-- ============================================================================
-- CREATE PROJECT_BUCKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_buckets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bucket_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_buckets_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Create indexes for project_buckets
CREATE INDEX IF NOT EXISTS idx_project_buckets_project_id 
ON public.project_buckets(project_id);

CREATE INDEX IF NOT EXISTS idx_project_buckets_bucket_name 
ON public.project_buckets(bucket_name);

-- ============================================================================
-- REMOVE BUCKET_NAME FROM PROJECTS TABLE
-- ============================================================================

-- Drop the index on bucket_name first (created in migration 005)
DROP INDEX IF EXISTS public.idx_projects_bucket_name;

-- Drop the unique constraint on bucket_name
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_bucket_name_key;

-- Remove the bucket_name column
ALTER TABLE public.projects 
DROP COLUMN IF EXISTS bucket_name;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE public.project_buckets;
ANALYZE public.projects;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 006: Multiple buckets per project migration completed';
  RAISE NOTICE 'ℹ️  Projects now start with no buckets - create buckets manually';
  RAISE NOTICE 'ℹ️  All storage operations now require explicit bucket selection';
END $$;

