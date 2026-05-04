# Server Package Architecture

This package is the HTTP composition root for the Go API.

## Route Registration Layout

- `routes.go`: orchestrates dependency wiring and calls domain registrars.
- `routes_data.go`: data-domain mounts (`database`, `storage`, `projects`, etc.).
- `routes_auth_admin.go`: auth management and admin mounts.
- `routes_ops.go`: invitations, communications, payments, backups, workflows.

## Backups and restore

- **Database backup** (`.sql`): `POST /api/backups/{projectId}/create` stores a schema dump in object storage. **Restore** applies that SQL to the **same** project’s schema via `POST /api/backups/{projectId}/{filename}/restore` with body `{ "dropExisting": bool }` (JWT + project access). Use `dropExisting` only when you intend to drop existing project tables first.
- **Full backup** (`.zip`): includes project SQL and system settings. **Restore into the current project** uses the same route as database restore: `POST /api/backups/{projectId}/{filename}/restore` with `{ "dropExisting": bool }` (JWT + project access). The service remaps the backup’s schema name and source `project_id` to this project before executing. **`POST /api/backups/restore`** (JWT only) still creates a **new** project from a `.zip` when you pass `backupId`, `newProjectName`, `organizationId`. Calling `POST /api/backups/restore` with a non-`.zip` key returns `400` with a short hint.
- **Another instance (e.g. live → local):** restores always read from **this** environment’s object storage. Download `.sql` or `.zip` from the source UI (or copy the object from its bucket), then use **`POST /api/backups/{projectId}/actions/import`** (multipart field `file`, max **64MiB**) to upload into the **local** project’s `backups/{projectId}/…` prefix; the file then appears in the list and the same restore flows apply. (The path is under `actions/import` so it does not collide with `DELETE /api/backups/{projectId}/{backupId}`.) Alternatively, use `mc cp` / AWS CLI to place an object at `backups/{projectId}/yourfile.sql` in the local bucket and refresh the list.
- `routes_proxy.go`: gateway-only mounts (`/api/v2`) and strict fallback handlers.

## Route Ordering Guardrails

Order is critical when using `http.ServeMux` path matching:

1. Register specific `/app-api/...` compatibility routes first.
   - `/app-api/mcp/`
2. Register broad JWT/API domain routes next.
   - `/api/mcp/`
3. Register fallback routes last:
   - `/auth/`
   - `/api/`
   - `/app-api/`
   - `/app-api-2/`

If a new `/app-api/...` route is added, ensure it is mounted before `/app-api/`.

## Strict Fallback Behavior

- Unknown `/api/*` paths return a Go JSON `404` contract.
- Unknown `/app-api/*` paths return a Go JSON `404` contract.
- Unknown `/app-api-2/*` paths return a Go JSON `404` contract.

## Compatibility Migration Checklist

For each route migrated from Node to Go:

1. Add a dedicated registrar on the target domain handler.
2. Mount specific route prefix before the `/app-api/` catch-all.
3. Preserve response envelope and auth behavior.
4. Add route precedence tests in `routes_compat_test.go`.

## Route Ownership Reference

For the current Go-vs-Node ownership matrix, see:

- `docs/route-ownership.md`

## Platform password reset (dashboard)

The `/auth/` prefix is served by `platformauth` for SuperTokens-compatible platform login. Link-based forgot-password (used by the React `supertokens-auth-react` EmailPassword recipe) is implemented as:

- `POST /auth/user/password/reset/token` — creates a reset token in SuperTokens Core and sends email via **environment SMTP**, not project DB email providers.
- `POST /auth/user/password/reset` — completes reset via Core.

Configure mail with `PLATFORM_SMTP_HOST`, `PLATFORM_SMTP_PORT`, `PLATFORM_SMTP_USER`, `PLATFORM_SMTP_PASSWORD`, `PLATFORM_SMTP_SECURE`, `PLATFORM_FROM_EMAIL`, and optionally `PLATFORM_FROM_NAME`. If `PLATFORM_SMTP_HOST` is unset, `EMAIL_USER` and `EMAIL_PASS` default to Gmail SMTP (`smtp.gmail.com:587`). The reset link uses `FRONTEND_URL` (or `SUPERTOKENS_WEBSITE_DOMAIN`) as the site base. App-user OTP reset remains on `/app-api/auth/...` and uses per-project communications providers.
