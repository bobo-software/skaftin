-- Initialize Skaftin Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create a sample table for testing
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a sample table for platform data
CREATE TABLE IF NOT EXISTS platform_stats (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data
INSERT INTO users (username, email) VALUES 
    ('admin', 'admin@skaftin.com'),
    ('demo', 'demo@skaftin.com')
ON CONFLICT (username) DO NOTHING;

INSERT INTO platform_stats (metric_name, metric_value) VALUES 
    ('active_users', 150),
    ('total_requests', 2500),
    ('uptime_hours', 99.9)
ON CONFLICT DO NOTHING;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_platform_stats_metric ON platform_stats(metric_name);
