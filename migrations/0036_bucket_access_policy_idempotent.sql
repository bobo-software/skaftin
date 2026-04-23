-- Idempotent variant of access_policy on skaftin_system_project_buckets (safe every API boot).
-- Replaces non-idempotent ADD CONSTRAINT in 0024 for automated runs.

ALTER TABLE public.skaftin_system_project_buckets
    ADD COLUMN IF NOT EXISTS access_policy VARCHAR(20) NOT NULL DEFAULT 'public';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE c.conname = 'check_access_policy'
          AND n.nspname = 'public'
          AND t.relname = 'skaftin_system_project_buckets'
    ) THEN
        ALTER TABLE public.skaftin_system_project_buckets
            ADD CONSTRAINT check_access_policy
            CHECK (access_policy IN ('private', 'public'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_access_policy
    ON public.skaftin_system_project_buckets(access_policy);
