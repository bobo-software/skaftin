-- public.skaftin_system_expo_push_settings: project-level pause/enable for Expo push.
-- Device tokens live in each project's schema as skaftin_system_expo_notifications
-- (created on project init / ensure). Toggle never deletes tokens.

CREATE TABLE IF NOT EXISTS public.skaftin_system_expo_push_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_expo_push_settings_project_id_key UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_expo_push_settings_project_id
    ON public.skaftin_system_expo_push_settings(project_id);
