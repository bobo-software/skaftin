-- Migration: Add Organizations and Team Members
-- This migration:
-- 1. Creates organizations table
-- 2. Creates organization_members table with roles
-- 3. Migrates existing projects to organizations (one org per user)
-- 4. Updates projects table to reference organization_id

-- Step 1: Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create organization_members table with roles
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

-- Step 4: Migrate existing projects to organizations
-- For each unique user_id in projects, create an organization and add user as admin
DO $$
DECLARE
  user_record RECORD;
  new_org_id INTEGER;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT user_id FROM projects WHERE user_id IS NOT NULL
  LOOP
    -- Create an organization for this user
    INSERT INTO organizations (name, description, owner_id)
    VALUES (
      'My Organization', 
      'Default organization for existing projects',
      user_record.user_id
    )
    RETURNING id INTO new_org_id;
    
    -- Add the user as admin to their organization
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.user_id, 'admin');
    
    -- Update all projects for this user to belong to the new organization
    UPDATE projects 
    SET organization_id = new_org_id 
    WHERE user_id = user_record.user_id AND organization_id IS NULL;
  END LOOP;
END $$;

-- Step 5: Add organization_id column to projects if it doesn't exist
-- (The column should already exist from the schema, but this ensures backward compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN organization_id INTEGER;
  END IF;
END $$;

-- Step 6: Make organization_id NOT NULL after migration
ALTER TABLE projects ALTER COLUMN organization_id SET NOT NULL;

-- Step 7: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_organization_id_fkey'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT projects_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Step 8: Add index on projects.organization_id
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);

-- Migration complete!
-- Users can now:
-- - Create organizations
-- - Invite team members with roles (admin, dev, member, viewer)
-- - Projects belong to organizations
-- - All organization members can access organization projects (based on their role)

