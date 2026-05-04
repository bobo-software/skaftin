-- Idempotent baseline for core public platform tables required before
-- 0034_public_system_tables_baseline.sql (which references skaftin_system_projects).
-- Column shapes align with internal/orgs/store.go and internal/projects/store.go.

-- Organizations (public.skaftin_system_organizations)
CREATE TABLE IF NOT EXISTS public.skaftin_system_organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_organizations_owner_id
    ON public.skaftin_system_organizations(owner_id);

-- Organization members (public.skaftin_system_organization_members)
CREATE TABLE IF NOT EXISTS public.skaftin_system_organization_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES public.skaftin_system_organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skaftin_system_organization_members_org_user_key UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_organization_members_org_id
    ON public.skaftin_system_organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_organization_members_user_id
    ON public.skaftin_system_organization_members(user_id);

-- Projects (public.skaftin_system_projects)
CREATE TABLE IF NOT EXISTS public.skaftin_system_projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id INTEGER NOT NULL REFERENCES public.skaftin_system_organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    field_encryption_key TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deletion_requested_at TIMESTAMP,
    deletion_scheduled_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_projects_organization_id
    ON public.skaftin_system_projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_skaftin_system_projects_user_id
    ON public.skaftin_system_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_deletion_scheduled
    ON public.skaftin_system_projects(deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL AND deleted_at IS NULL;
