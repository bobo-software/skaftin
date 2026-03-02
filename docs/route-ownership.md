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

## Node-owned routes (current)

- `/auth/*` (SuperTokens middleware endpoints)
- `/socket.io/*` (realtime passthrough to Node)
- `/app-api/auth/*` (except Go compatibility routes listed above)
- `/app-api-2/*` (catch-all fallback proxy only)

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
