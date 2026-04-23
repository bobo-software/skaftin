-- Baseline for public.skaftin_system_* tables that the Go services expect but that
-- older repo migrations never created (those migrations targeted legacy names like
-- projects / api_credentials). Safe to run on existing DBs: everything is IF NOT EXISTS.

-- Auth settings (public.skaftin_system_auth_settings)
CREATE TABLE IF NOT EXISTS public.skaftin_system_auth_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    allow_duplicate_emails BOOLEAN NOT NULL DEFAULT false,
    require_email_verification BOOLEAN NOT NULL DEFAULT false,
    require_phone_verification BOOLEAN NOT NULL DEFAULT false,
    enable_password_reset BOOLEAN NOT NULL DEFAULT true,
    enable_mfa BOOLEAN NOT NULL DEFAULT false,
    registration_enabled BOOLEAN NOT NULL DEFAULT true,
    auth_enabled BOOLEAN NOT NULL DEFAULT true,
    default_role_id INTEGER,
    email_provider_id INTEGER,
    sms_provider_id INTEGER,
    send_registration_email BOOLEAN NOT NULL DEFAULT true,
    send_verification_email BOOLEAN NOT NULL DEFAULT true,
    send_password_reset_email BOOLEAN NOT NULL DEFAULT true,
    send_welcome_email BOOLEAN NOT NULL DEFAULT false,
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    otp_length INTEGER NOT NULL DEFAULT 6,
    send_registration_sms BOOLEAN NOT NULL DEFAULT false,
    send_verification_sms BOOLEAN NOT NULL DEFAULT false,
    send_password_reset_sms BOOLEAN NOT NULL DEFAULT false,
    send_welcome_sms BOOLEAN NOT NULL DEFAULT false,
    require_email BOOLEAN NOT NULL DEFAULT true,
    require_otp_for_password_change BOOLEAN NOT NULL DEFAULT false,
    require_otp_for_account_deletion BOOLEAN NOT NULL DEFAULT false,
    allow_users_without_email BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT skaftin_system_auth_settings_project_id_key UNIQUE (project_id)
);

-- API credentials (MCP keys, app API keys, etc.)
CREATE TABLE IF NOT EXISTS public.skaftin_system_api_credentials (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,
    token TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}'::text[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITHOUT TIME ZONE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_credentials_project_id
    ON public.skaftin_system_api_credentials(project_id);

-- Project storage bucket registry
CREATE TABLE IF NOT EXISTS public.skaftin_system_project_buckets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    bucket_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_project_buckets_bucket_name_key UNIQUE (bucket_name)
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_project_id
    ON public.skaftin_system_project_buckets(project_id);

-- Email / SMS templates (project_id stored as text key in application code)
CREATE TABLE IF NOT EXISTS public.skaftin_system_email_providers (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(255),
    smtp_password TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_providers_project_id
    ON public.skaftin_system_email_providers(project_id);

CREATE TABLE IF NOT EXISTS public.skaftin_system_email_templates (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_templates_project_id
    ON public.skaftin_system_email_templates(project_id);

CREATE TABLE IF NOT EXISTS public.skaftin_system_sms_templates (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_sms_templates_project_id
    ON public.skaftin_system_sms_templates(project_id);

-- Invitations & direct project membership
CREATE TABLE IF NOT EXISTS public.skaftin_system_project_invitations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invite_code VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    invited_by VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_project_id
    ON public.skaftin_system_project_invitations(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_code
    ON public.skaftin_system_project_invitations(invite_code);

CREATE TABLE IF NOT EXISTS public.skaftin_system_project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    invited_by VARCHAR(255),
    joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_project_members_project_user_key UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_members_project_id
    ON public.skaftin_system_project_members(project_id);

-- Analytics tables (read by internal/analytics/store.go)
CREATE TABLE IF NOT EXISTS public.skaftin_system_api_metrics (
    id BIGSERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT '',
    status_code INTEGER,
    response_time_ms DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_metrics_project_created
    ON public.skaftin_system_api_metrics(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.skaftin_system_storage_metrics (
    id BIGSERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    operation_type VARCHAR(32) NOT NULL,
    file_path TEXT,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_storage_metrics_project_created
    ON public.skaftin_system_storage_metrics(project_id, created_at DESC);

-- One auth_settings row per existing project (idempotent)
INSERT INTO public.skaftin_system_auth_settings (project_id)
SELECT p.id
FROM public.skaftin_system_projects p
WHERE NOT EXISTS (
    SELECT 1 FROM public.skaftin_system_auth_settings s WHERE s.project_id = p.id
);
