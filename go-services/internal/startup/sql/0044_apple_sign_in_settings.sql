-- Add Apple Sign-In configuration columns to per-project auth settings.
-- apple_client_ids holds the allowed JWT 'aud' values (native iOS bundle IDs).
-- All three columns default to disabled/empty so existing projects are unaffected.

ALTER TABLE public.skaftin_system_auth_settings
  ADD COLUMN IF NOT EXISTS apple_sign_in_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apple_client_ids          TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS apple_auto_register       BOOLEAN NOT NULL DEFAULT false;
