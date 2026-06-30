# Route Ownership Matrix

This document tracks which API routes are handled by Go gateway vs Node backend.

## Go-owned routes

- `/auth/*` (SuperTokens platform auth routes)
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
- `/app-api2/database/*` (read-only: `POST` table select)
- `/app-api2/storage/*` (read-only: `GET` file download)

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
- `/app-api2/database/*`, `/app-api2/storage/*`
  - client refs: open browse / catalog flows
  - Go owner: `internal/dbproxy`, `internal/storage` via `registerDataRoutes`
  - auth: dual credential (`api_key` + `access_token`, same project)

## Node-owned routes (current)

- None (API fallback/proxy behavior removed for `/api/*` and `/app-api/*`)

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

## Strict no-fallback behavior

- Unknown `/api/*` paths return Go `404`.
- Unknown `/app-api/*` paths return Go `404`.
- Unknown `/app-api2/*` paths return Go `404`.

