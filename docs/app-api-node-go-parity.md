# App API Node-Go Parity Contract

This contract defines behavior expected from the Go handlers that now own former Node routes.

## Scope

- `/app-api/request-logs/*`
- `/app-api/communications/*`
- `/app-api/payments/*`
- `/app-api-2/database/*`
- `/app-api-2/storage/*`

## Auth and Project Context

- `/app-api/*` and `/app-api-2/*` require API key/access token auth at the gateway (`X-API-Key` or `Authorization: Bearer` credential token).
- Project context is resolved from the credential (`project_id`) and may fall back to route params for compatibility endpoints.
- `/auth/*` and full SuperTokens session flows remain Node-owned.

## Response Contract

- Existing JSON response envelope shape is preserved per endpoint family:
  - Communications endpoints return `success` with either `data` and/or `message` depending on operation.
  - Payments client endpoints return `success`, `transactionId`, `paymentUrl`, optional `paymentData`, and `error` on failures.
  - Request log client ingestion returns `success`, with `data.logged` and optional `data.log_id`.
- Error semantics are preserved:
  - Validation failures return `400`.
  - Not found errors return `404`.
  - Provider/configuration errors map to `400` for client-facing operations.

## Route Precedence Contract

- Specific mounted prefixes must remain registered before catch-all proxies:
  - `/app-api/request-logs/`
  - `/app-api/communications/`
  - `/app-api/payments/`
  - `/app-api-2/database/`
  - `/app-api-2/storage/`
  - then catch-all `/app-api/` and `/app-api-2/`.

## Public API (`/app-api-2`) Restrictions

- Only GET and POST operations are exposed for public database and storage routes.
- Mutating methods that were not public in Node (`PUT`, `PATCH`, `DELETE`) are intentionally not mounted under `/app-api-2/*`.

## Non-goals in this migration

- Moving SuperTokens core middleware endpoints (`/auth/*`).
- Migrating non-compat session-specific auth flows under `/app-api/auth/*` beyond existing compatibility paths.
