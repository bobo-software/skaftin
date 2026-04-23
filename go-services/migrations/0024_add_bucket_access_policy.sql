-- Migration 0024: Add Access Policy to Buckets
-- Date: 2026-02-03
-- Description: Add access_policy field to project_buckets table for private/public bucket access control

BEGIN;

-- Add access_policy column to skaftin_system_project_buckets
ALTER TABLE public.skaftin_system_project_buckets
ADD COLUMN IF NOT EXISTS access_policy VARCHAR(20) NOT NULL DEFAULT 'public';

-- Add check constraint to ensure only 'private' or 'public' values
ALTER TABLE public.skaftin_system_project_buckets
ADD CONSTRAINT check_access_policy CHECK (access_policy IN ('private', 'public'));

-- Create index on access_policy for faster queries
CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_access_policy 
ON public.skaftin_system_project_buckets(access_policy);

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 0024: Added access_policy column to project_buckets table';
END $$;
