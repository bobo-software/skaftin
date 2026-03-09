-- Migration: Add soft-delete metadata to projects
-- Date: 2026-03-09

ALTER TABLE public.skaftin_system_projects
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_projects_deletion_scheduled
ON public.skaftin_system_projects (deletion_scheduled_at)
WHERE deletion_scheduled_at IS NOT NULL AND deleted_at IS NULL;
