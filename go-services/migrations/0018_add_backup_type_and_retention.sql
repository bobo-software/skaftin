-- Migration: Add backup_type and retention policy fields to backup schedules
-- Date: 2025-12-03
-- Description: Adds support for full backups and flexible retention policies

-- Add backup_type column (database vs full)
ALTER TABLE public.skaftin_system_backup_schedules 
ADD COLUMN IF NOT EXISTS backup_type VARCHAR(20) DEFAULT 'database' 
CHECK (backup_type IN ('database', 'full'));

-- Add retention_policy column
ALTER TABLE public.skaftin_system_backup_schedules
ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(20) DEFAULT 'keep_all' 
CHECK (retention_policy IN ('keep_all', 'keep_count', 'keep_days'));

-- Add retention_value column (number of backups to keep OR number of days)
ALTER TABLE public.skaftin_system_backup_schedules
ADD COLUMN IF NOT EXISTS retention_value INTEGER DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN public.skaftin_system_backup_schedules.backup_type IS 'Type of backup: database (schema only) or full (schema + system settings)';
COMMENT ON COLUMN public.skaftin_system_backup_schedules.retention_policy IS 'Retention policy: keep_all, keep_count (keep N most recent), or keep_days (keep backups from last N days)';
COMMENT ON COLUMN public.skaftin_system_backup_schedules.retention_value IS 'Number of backups to keep (for keep_count) or number of days (for keep_days)';

-- Update existing schedules to use new retention policy if retention_days is set
UPDATE public.skaftin_system_backup_schedules
SET 
  retention_policy = 'keep_days',
  retention_value = retention_days
WHERE retention_days IS NOT NULL AND retention_days > 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_schedules_backup_type 
ON public.skaftin_system_backup_schedules(backup_type);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_retention_policy 
ON public.skaftin_system_backup_schedules(retention_policy);

