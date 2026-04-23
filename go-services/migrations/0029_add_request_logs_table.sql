-- Migration: Add request logs table to public schema
-- This table stores API request logs for all projects, with project_id to filter by project
-- Run once - stores all request logs in a single public table

-- Create the request logs table in public schema
CREATE TABLE IF NOT EXISTS public.skaftin_system_request_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
    request_id UUID DEFAULT gen_random_uuid(),
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_request_logs_project_id ON public.skaftin_system_request_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.skaftin_system_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON public.skaftin_system_request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_project_created ON public.skaftin_system_request_logs(project_id, created_at);
