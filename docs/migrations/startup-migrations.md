# Startup Migrations

## Current behavior

- API and MCP server startup run an explicit ordered allowlist from [`go-services/internal/startup/migrate.go`](../../go-services/internal/startup/migrate.go).
- SQL is loaded from the binary embed first (`go-services/internal/startup/sql/*.sql`), then falls back to disk under `ResolveMigrationsDir` (typically `go-services/migrations/`).
- Allowlist order (as of this doc):
  1. `0038_ensure_public_schema.sql` — `CREATE SCHEMA IF NOT EXISTS public` (some restores or templates omit `public`, which breaks all `public.*` DDL).
  2. `0039_supertokens_schema_baseline.sql` — **DDL only** (no auth data): `supertokens` schema, tables, primary keys, unique constraints, indexes, and foreign keys, derived from a `pg_dump` snapshot. Idempotent for repeated boots (`CREATE IF NOT EXISTS`, guarded `ALTER ... ADD CONSTRAINT`). SuperTokens Core may still run its own migrations at runtime; if your Core/Postgres version differs from the dump source, regenerate this file via [`go-services/scripts/gen_supertokens_baseline.py`](../../go-services/scripts/gen_supertokens_baseline.py) and a fresh schema-only dump.
  3. `0041_supertokens_public_app_seed.sql` — Idempotent seed for `supertokens.apps`, `supertokens.tenants`, and `supertokens.tenant_configs` (default `public` app/tenant, empty connection URI domain, email-password enabled). Required when `0039` created tables but no tenant rows yet.
  4. `0037_platform_core_public_baseline.sql` — organizations, organization members, projects (required before later files reference `skaftin_system_projects`).
  5. `0034_public_system_tables_baseline.sql` — auth settings, API credentials, buckets, templates, invitations, members, metrics.
  6. `0036_bucket_access_policy_idempotent.sql` — adds `access_policy` on `skaftin_system_project_buckets` (required by the Go projects store).
  7. `0040_public_workflows_and_backup_baseline.sql` — `workflow_execution_status` enum, `skaftin_system_workflows` (+ nodes, edges, executions, node_executions, schedules), and `skaftin_system_backup_schedules` (including `backup_type` / `retention_*` columns). Runs after `0036` so `skaftin_system_projects` exists for foreign keys.
  8. `0042_public_sms_providers_baseline.sql` — `public.sms_providers` for communications/workflows.
  9. `0043_google_sign_in_settings.sql` / `0044_apple_sign_in_settings.sql` — auth settings columns for social sign-in.
  10. `0045_public_push_notifications_baseline.sql` — `public.skaftin_system_expo_push_settings` (project-level pause/enable for Expo push). Device tokens live in each project schema as `skaftin_system_expo_notifications` (created on project init and ensured on first push API use). Turning push off pauses sending/register without deleting tokens.
- If any startup migration fails, the process **exits with a non-zero status**; the HTTP/MCP server does not start.
- After migrations succeed, [`startup.ValidatePlatformSchema`](../../go-services/internal/startup/schema_validate.go) checks required `public` tables (and `access_policy`), then checks `supertokens.apps`, `supertokens.tenants`, and `supertokens.session_info`. On failure, the process **exits with a non-zero status**.

### SuperTokens Core and tenant cache

Core loads tenant metadata from Postgres at process start and **refreshes it on a timer** (roughly after the first minute, then about every minute). If startup migrations add or change `supertokens.*` **while Core is already running** with an outdated in-memory list, platform signup can fail until the next refresh. **Mitigation:** restart SuperTokens Core after first-time `supertokens` bootstrap (e.g. `docker restart skaftin-supertokens` when using [`docs/DOCKER_LOCAL.md`](../DOCKER_LOCAL.md)), or wait briefly and retry. See also the SuperTokens row in the verification list below.

## Environment variables

| Variable | Effect |
|----------|--------|
| `SKIP_STARTUP_MIGRATIONS=1` | Do not execute startup SQL. Schema validation still runs unless `SKIP_STARTUP_SCHEMA_CHECK=1`. |
| `SKIP_STARTUP_SCHEMA_CHECK=1` | Skip post-migration schema checks (break-glass only; runtime errors are likely if the DB is incomplete). |

## Why this exists

- Some deploy targets run the binary from a minimal cwd where migration folders are not present; embedding critical bootstrap SQL avoids path dependency for first boot.
- Blocking startup prevents serving an API against an empty or half-migrated database.
- `0039` lets a **fresh Postgres** get a compatible `supertokens` layout before SuperTokens Core connects, while keeping startup idempotent on existing databases.
- `0041` supplies the default tenant configuration rows that DDL-only `0039` does not insert; Core and the Go gateway both assume this baseline exists.

## Ops impact

- You should still run full migration workflows out-of-band for migrations **not** on the startup allowlist (see governance rules in `.cursor/rules/database-schema-governance.mdc`).
- Startup migration logs include source information, for example:
  - `embedded://internal/startup/sql/0039_supertokens_schema_baseline.sql`
- Canonical copies of startup SQL also live under `go-services/migrations/` (same filenames) for review and admin tooling.

## Verification

1. Start the API (`go run ./cmd/api/`) against an empty database and confirm logs show `startup migration ok` for each file, then a successful listen.
2. Confirm the process exits if you drop a required table and restart (expect schema validation error).
3. Spot-check tables:
   - `public.skaftin_system_organizations`, `public.skaftin_system_projects`
   - `public.skaftin_system_auth_settings`, `public.skaftin_system_project_buckets` (with column `access_policy`)
   - `public.skaftin_system_workflows`, `public.skaftin_system_backup_schedules`
   - `public.skaftin_system_expo_push_settings`
   - `supertokens.apps`, `supertokens.tenants`, `supertokens.tenant_configs` (one row: empty `connection_uri_domain`, `app_id`/`tenant_id` `public`, `email_password_enabled` true), `supertokens.session_info` (may be empty until users sign in)
4. SuperTokens HTTP: `curl -sS http://localhost:3567/hello` should return `Hello` when Core is up (see [`docs/DOCKER_LOCAL.md`](../DOCKER_LOCAL.md) for compose layout).
