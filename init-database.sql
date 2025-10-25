-- Initialize Skaftin database schema
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS auth;

-- Create users table
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS platform.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_name VARCHAR(63) NOT NULL,
  bucket_name VARCHAR(63) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create a test user
INSERT INTO auth.users (id, email, password_hash, first_name, last_name) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test@example.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8.8.8.8',
  'Test',
  'User'
) ON CONFLICT (email) DO NOTHING;

-- Create a test project
INSERT INTO platform.projects (id, user_id, name, description, schema_name, bucket_name)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'Furniture Store',
  'A project for managing furniture inventory',
  'project_furniture_store',
  'project-furniture-store'
) ON CONFLICT (id) DO NOTHING;

-- Create project schema
CREATE SCHEMA IF NOT EXISTS project_furniture_store;

