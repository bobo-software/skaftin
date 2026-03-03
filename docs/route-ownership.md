# Route Ownership Matrix

This document tracks which API routes are handled by Go gateway vs Node backend.

## Go-owned routes

- `/api/auth/*`
  - includes `POST /api/auth/{projectId}/users/import` (served by Go `authmanagement.ImportUsersHandler`)
- `/api/admin/*`
- `/api/organizations/*`
- `/api/projects/*`
- `/api/files/*`
- `/api/users/*`
- `/api/communications/*`
- `/api/credentials/*`
- `/api/analytics/*`
- `/api/health`
- `/api/database/*`
- `/api/storage/*`
- `/api/payments/*`
- `/api/request-logs/*`
- `/api/backups/*`
- `/api/migrations/*`
- `/api/mcp/*`
- `/app-api/mcp/*`
- `/app-api/auth/*` (all app auth compatibility routes except `/auth/*` SuperTokens)
- `/app-api/storage/*`
- `/app-api/database/*`
- `/app-api/request-logs/*`
- `/app-api/communications/*`
- `/app-api/payments/*`
- `/app-api-2/database/*`
- `/app-api-2/storage/*`

## App-API consumer inventory (frontend -> Go route owner)

The following `/app-api/*` paths are used by frontend route constants and are
served by explicit Go registrations (not Node business handlers):

- `/app-api/auth/*`
  - frontend refs: `APP_AUTH`, plus app auth management routes
  - Go owner: `internal/authmanagement` via `registerAuthAndAdminRoutes`
- `/app-api/storage/*`
  - frontend refs: `STORAGE.UPLOAD_FILE_FORM`, `DELETE_FILE_FORM`,
    `DOWNLOAD_FILE_FORM`
  - Go owner: `internal/storage` via `registerDataRoutes`
- `/app-api/database/*`
  - frontend refs: app database client flows
  - Go owner: `internal/dbproxy` via `registerDataRoutes`
- `/app-api/request-logs/*`
  - frontend refs: `APP_API_REQUEST_LOGS`
  - Go owner: `internal/requestlogs` via `registerDataRoutes`
- `/app-api/communications/*`
  - frontend refs: `APP_API_COMMUNICATIONS`
  - Go owner: `internal/communications` via `registerOperationalRoutes`
- `/app-api/payments/*`
  - frontend refs: `APP_API_PAYMENTS`
  - Go owner: `internal/payments` via `registerOperationalRoutes`
- `/app-api/mcp/*`
  - frontend refs: `CLIENT_MCP`
  - Go owner: `internal/mcp` via `registerMCPRoutes`
- `/app-api-2/database/*`, `/app-api-2/storage/*`
  - frontend refs: public API flows
  - Go owner: `internal/dbproxy`, `internal/storage` via `registerDataRoutes`

## Node-owned routes (current)

- `/auth/*` (SuperTokens middleware endpoints)
- `/app-api/*` catch-all fallback only when `APP_API_PROXY_FALLBACK_ENABLED=true`

## Removed from Node

- Node MCP routes/controllers/modules (fully removed)
- Legacy unused routers:
  - `src/routers/AdminRouter.ts`
  - `src/routers/AuthCompatibilityRouter.ts`

## Migration guardrails

- Always mount specific Go routes before catch-all proxy routes (`/api/`, `/app-api/`).
- When migrating a route from Node to Go:
  1. Add Go handler + route mount with correct auth middleware.
  2. Add/adjust route precedence tests.
  3. Remove/disable Node mount only after Go parity is verified.

## Rollback playbook (app-api cutover)

If `/app-api/*` fallback to Node is disabled and unexpected client traffic
breaks, re-enable `APP_API_PROXY_FALLBACK_ENABLED=true` and redeploy Go
gateway. This restores proxy pass-through while gaps are addressed.

For `/app-api-2/*`, rollback uses explicit Go route fixes only. There is no
Node fallback path for app-api-2 unknown routes.
