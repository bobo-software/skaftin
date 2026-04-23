-- Migration 005: Add Performance Indexes
-- Date: 2025-11-09
-- Description: Adds missing indexes on foreign key columns for better query performance
-- Impact: Dramatically improves multi-tenant filtering and JOIN performance

-- Note: These indexes are added to the public schema (system tables)
-- Individual project schemas will need their own indexes based on their tables

BEGIN;

-- ============================================================================
-- ORGANIZATIONS & MEMBERS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id 
ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_role 
ON public.organization_members(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user 
ON public.organization_members(organization_id, user_id);

-- ============================================================================
-- PROJECTS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_organization_id 
ON public.projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id 
ON public.projects(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_schema_name 
ON public.projects(schema_name);

CREATE INDEX IF NOT EXISTS idx_projects_bucket_name 
ON public.projects(bucket_name);

CREATE INDEX IF NOT EXISTS idx_projects_created_at 
ON public.projects(created_at DESC);

-- ============================================================================
-- API CREDENTIALS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_credentials_project_id 
ON public.api_credentials(project_id);

CREATE INDEX IF NOT EXISTS idx_api_credentials_token 
ON public.api_credentials(token);

CREATE INDEX IF NOT EXISTS idx_api_credentials_is_active 
ON public.api_credentials(is_active);

CREATE INDEX IF NOT EXISTS idx_api_credentials_credential_type 
ON public.api_credentials(credential_type);

CREATE INDEX IF NOT EXISTS idx_api_credentials_expires_at 
ON public.api_credentials(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for authentication
CREATE INDEX IF NOT EXISTS idx_api_credentials_token_active 
ON public.api_credentials(token, is_active) WHERE is_active = true;

-- ============================================================================
-- INVITATIONS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id 
ON public.project_invitations(project_id);

CREATE INDEX IF NOT EXISTS idx_project_invitations_email 
ON public.project_invitations(email);

CREATE INDEX IF NOT EXISTS idx_project_invitations_status 
ON public.project_invitations(status);

CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_by 
ON public.project_invitations(invited_by);

-- Composite index for checking existing invitations
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_email 
ON public.project_invitations(project_id, email);

-- ============================================================================
-- PROJECT MEMBERS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_members_project_id 
ON public.project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id 
ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_role 
ON public.project_members(role);

-- Composite index for access checks
CREATE INDEX IF NOT EXISTS idx_project_members_project_user 
ON public.project_members(project_id, user_id);

-- ============================================================================
-- TEMPLATE INDEXES FOR PROJECT SCHEMAS
-- ============================================================================
-- These are example indexes to add to each project schema
-- Run these for each project schema replacing 'project_schema_name'

-- Example: For associations table
-- CREATE INDEX IF NOT EXISTS idx_associations_user_id 
-- ON project_schema_name.associations(user_id);

-- Example: For vehicles table
-- CREATE INDEX IF NOT EXISTS idx_vehicles_association_id 
-- ON project_schema_name.vehicles(association_id);
-- CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id 
-- ON project_schema_name.vehicles(driver_id);
-- CREATE INDEX IF NOT EXISTS idx_vehicles_status 
-- ON project_schema_name.vehicles(status);

-- Example: For drivers table
-- CREATE INDEX IF NOT EXISTS idx_drivers_association_id 
-- ON project_schema_name.drivers(association_id);
-- CREATE INDEX IF NOT EXISTS idx_drivers_user_id 
-- ON project_schema_name.drivers(user_id);

COMMIT;

-- Analyze tables to update statistics
ANALYZE public.organization_members;
ANALYZE public.projects;
ANALYZE public.api_credentials;
ANALYZE public.project_invitations;
ANALYZE public.project_members;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005: Added performance indexes successfully';
  RAISE NOTICE 'ℹ️  Run ANALYZE on project schema tables for optimal performance';
END $$;

