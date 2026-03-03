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
   - `/app-api/` (only when `APP_API_PROXY_FALLBACK_ENABLED=true`)

If a new `/app-api/...` route is added, ensure it is mounted before `/app-api/`.

## App-API Fallback Flag

- `APP_API_PROXY_FALLBACK_ENABLED=false` (default): unknown `/app-api/*` paths
  return a Go JSON `404` contract.
- `APP_API_PROXY_FALLBACK_ENABLED=true`: unknown `/app-api/*` paths are proxied
  to Node and fallback hits are emitted as structured warning logs.
- `/app-api-2/*` is always Go-only. Unknown paths under `/app-api-2/*` always
  return a Go JSON `404` contract and are never proxied to Node.

## Compatibility Migration Checklist

For each route migrated from Node to Go:

1. Add a dedicated registrar on the target domain handler.
2. Mount specific route prefix before the `/app-api/` catch-all.
3. Preserve response envelope and auth behavior.
4. Add route precedence tests in `routes_compat_test.go`.

## Route Ownership Reference

For the current Go-vs-Node ownership matrix, see:

- `docs/route-ownership.md`
