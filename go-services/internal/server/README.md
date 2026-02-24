# Server Package Architecture

This package is the HTTP composition root for the Go API.

## Route Registration Layout

- `routes.go`: orchestrates dependency wiring and calls domain registrars.
- `routes_data.go`: data-domain mounts (`database`, `storage`, `projects`, etc.).
- `routes_auth_admin.go`: auth management and admin mounts.
- `routes_ops.go`: invitations, communications, payments, backups, workflows.
- `routes_proxy.go`: gateway-only mounts (`/api/v2`) and Node proxy catch-alls.

## Route Ordering Guardrails

Order is critical when using `http.ServeMux` path matching:

1. Register specific `/app-api/...` compatibility routes first.
   - `/app-api/mcp/`
2. Register broad JWT/API domain routes next.
   - `/api/mcp/`
3. Register catch-all proxy routes last:
   - `/auth/`
   - `/api/`
   - `/app-api/`

If a new `/app-api/...` route is added, ensure it is mounted before `/app-api/`.

## Compatibility Migration Checklist

For each route migrated from Node to Go:

1. Add a dedicated registrar on the target domain handler.
2. Mount specific route prefix before the `/app-api/` catch-all.
3. Preserve response envelope and auth behavior.
4. Add route precedence tests in `routes_compat_test.go`.
