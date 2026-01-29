-- Migration: Fix driver_details.id to use SERIAL / auto-increment
-- Run this in your PROJECT schema (e.g. via MCP apply_migration with projectId, or SET search_path TO your_schema; then run).
-- Safe to run multiple times (idempotent).

-- Create sequence for driver_details.id if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS driver_details_id_seq;

-- Set default so inserts without id get the next value
ALTER TABLE driver_details ALTER COLUMN id SET DEFAULT nextval('driver_details_id_seq');

-- Sync sequence to current max id so next insert doesn't conflict
SELECT setval('driver_details_id_seq', COALESCE((SELECT MAX(id) FROM driver_details), 1));
