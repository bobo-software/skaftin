-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test users
INSERT INTO users (username, email, full_name) VALUES
    ('alice', 'alice@example.com', 'Alice Johnson'),
    ('bob', 'bob@example.com', 'Bob Smith'),
    ('charlie', 'charlie@example.com', 'Charlie Brown'),
    ('diana', 'diana@example.com', 'Diana Prince'),
    ('eve', 'eve@example.com', 'Eve Wilson')
ON CONFLICT (username) DO NOTHING;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

