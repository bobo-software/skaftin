CREATE TABLE IF NOT EXISTS public.skaftin_system_database_metrics (
    id BIGSERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    table_name TEXT,
    query_type VARCHAR(32) NOT NULL,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    rows_affected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_metrics_project_created
    ON public.skaftin_system_database_metrics(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_db_metrics_project_query_type
    ON public.skaftin_system_database_metrics(project_id, query_type);

CREATE INDEX IF NOT EXISTS idx_db_metrics_project_table_name
    ON public.skaftin_system_database_metrics(project_id, table_name);
