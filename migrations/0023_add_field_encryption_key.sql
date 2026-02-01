-- Migration: Add field encryption key to projects
-- Description: Per-project encryption key for payload-driven field encryption (user database only).

ALTER TABLE skaftin_system_projects
  ADD COLUMN IF NOT EXISTS field_encryption_key TEXT;

COMMENT ON COLUMN skaftin_system_projects.field_encryption_key IS 'Optional per-project key for encrypting/decrypting specified fields in user data (insert/update/select). Not returned in project API responses.';
