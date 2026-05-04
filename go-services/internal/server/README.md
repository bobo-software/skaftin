# Server Package Architecture

This package is the HTTP composition root for the Go API.

## Route Registration Layout

- `routes.go`: orchestrates dependency wiring and calls domain registrars.
- `routes_data.go`: data-domain mounts (`database`, `storage`, `projects`, etc.).
- `routes_auth_admin.go`: auth management and admin mounts.
- `routes_ops.go`: invitations, communications, payments, backups, workflows.
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
