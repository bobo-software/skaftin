# Startup Migrations

## Current behavior

- API startup runs an explicit startup allowlist from `go-services/internal/startup/migrate.go`.
- The startup baseline SQL is embedded in the binary from `go-services/internal/startup/sql/0034_public_system_tables_baseline.sql`.
- If startup migration execution fails, the API logs the error and continues booting (non-blocking startup).
- Set `SKIP_STARTUP_MIGRATIONS=1` to skip startup migrations entirely.

## Why this exists

- Some deploy targets run the binary from `/` (or another minimal cwd) where migration folders are not present.
- Embedding the baseline migration removes filesystem path dependency for critical bootstrap tables.
- Non-blocking mode prevents complete API downtime due to migration file/path issues.

## Ops impact

- You should still run full migration workflows out-of-band for non-startup migrations.
- Startup migration logs include source information, for example:
  - `embedded://internal/startup/sql/0034_public_system_tables_baseline.sql`
- General migration files for admin tooling remain under `go-services/migrations/`.

## Verification

1. Start API and check logs for:
   - `startup migration source`
   - `startup migration ok`
2. Confirm API serves traffic even if startup migration fails (non-blocking fallback path).
3. Validate baseline tables exist, for example:
   - `public.skaftin_system_auth_settings`
   - `public.skaftin_system_api_credentials`
   - `public.skaftin_system_project_members`
