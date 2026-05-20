-- Add Google Sign-In configuration columns to per-project auth settings.
-- google_web_client_ids holds the allowed OAuth 'aud' values (Web client IDs from Google Cloud).

ALTER TABLE public.skaftin_system_auth_settings
  ADD COLUMN IF NOT EXISTS google_sign_in_enabled BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_web_client_ids  TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS google_auto_register   BOOLEAN   NOT NULL DEFAULT false;
