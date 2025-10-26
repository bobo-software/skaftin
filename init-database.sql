-- Initialize Skaftin database schema for SuperTokens integration
CREATE SCHEMA IF NOT EXISTS platform;

-- Create projects table
-- Note: user_id uses SuperTokens user IDs (strings from SuperTokens)
CREATE TABLE IF NOT EXISTS platform.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- SuperTokens user ID
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_name VARCHAR(63) NOT NULL UNIQUE,
  bucket_name VARCHAR(63) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON platform.projects(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON platform.projects(created_at DESC);

