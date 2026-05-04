-- Idempotent baseline for workflow + backup scheduler tables (public).
-- Referenced at API boot by internal/backups and internal/workflows stores.

DO $$
BEGIN
    CREATE TYPE public.workflow_execution_status AS ENUM (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflows (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule VARCHAR(100),
    cron_job_id INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_nodes (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_workflow_nodes_workflow_id_node_id_key UNIQUE (workflow_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_edges (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
    source_node_id VARCHAR(100) NOT NULL,
    target_node_id VARCHAR(100) NOT NULL,
    source_handle VARCHAR(100),
    target_handle VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
    status public.workflow_execution_status NOT NULL DEFAULT 'pending'::public.workflow_execution_status,
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    triggered_by VARCHAR(50),
    input_data JSONB,
    result_data JSONB,
    error_message TEXT,
    execution_log JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_node_executions (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    result_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
    cron_job_id INTEGER NOT NULL,
    schedule VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_workflow_schedules_workflow_id_key UNIQUE (workflow_id)
);

CREATE TABLE IF NOT EXISTS public.skaftin_system_backup_schedules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schedule VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    backup_name_prefix VARCHAR(255),
    retention_days INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    last_run_at TIMESTAMP WITHOUT TIME ZONE,
    next_run_at TIMESTAMP WITHOUT TIME ZONE,
    backup_type VARCHAR(32) NOT NULL DEFAULT 'database',
    retention_policy VARCHAR(32) NOT NULL DEFAULT 'keep_all',
    retention_value INTEGER
);

ALTER TABLE public.skaftin_system_backup_schedules
    ADD COLUMN IF NOT EXISTS backup_type VARCHAR(32) NOT NULL DEFAULT 'database';

ALTER TABLE public.skaftin_system_backup_schedules
    ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(32) NOT NULL DEFAULT 'keep_all';

ALTER TABLE public.skaftin_system_backup_schedules
    ADD COLUMN IF NOT EXISTS retention_value INTEGER;

CREATE INDEX IF NOT EXISTS idx_skaftin_system_backup_schedules_project_id
    ON public.skaftin_system_backup_schedules(project_id);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_backup_schedules_enabled
    ON public.skaftin_system_backup_schedules(enabled);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_backup_type
    ON public.skaftin_system_backup_schedules(backup_type);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_retention_policy
    ON public.skaftin_system_backup_schedules(retention_policy);
