# Client SDK API Requests

This folder documents HTTP (and WebSocket) requests that **client applications** make to the Skaftin platform.

## Base URLs

| Surface | Base path | Authentication (reference server) |
|---------|-----------|----------------------------------|
| **App API** (primary for mobile / public clients) | `/app-api/...` | **`x-api-key`** — project is resolved from the key |
| **App API 2** (restricted DB/storage helpers) | `/app-api-2/...` | **`x-api-key`** only |
| **Project HTTP API** (dashboard / server-side) | `/api/...` with `projectId` in path where applicable | **Platform JWT** (`Authorization: Bearer`) + project access middleware |
| **GraphQL** | `/api/graphql` | **Platform JWT** (same as other `/api/` routes; browser cookies work when logged into the admin app) |

App user JWTs (from `POST /app-api/auth/auth/login`) are used for **auth** and for routes that explicitly accept `Authorization: Bearer` in addition to the API key. **`/app-api/database/`** and **`/app-api/storage/`** are mounted with **API-key middleware only** on the Go server — use a valid **`x-api-key`** for those.

## Headers

```
Content-Type: application/json
x-api-key: your-api-key
```

or, where the route supports it:

```
Authorization: Bearer <token>
```

## Available request categories

| Document | Description |
|----------|-------------|
| [01-AUTH-REQUESTS.md](./01-AUTH-REQUESTS.md) | App user authentication (register, login, OTP, password reset, session) |
| [02-USER-REQUESTS.md](./02-USER-REQUESTS.md) | App user CRUD, roles, custom auth fields, auth settings |
| [03-DATABASE-REQUESTS.md](./03-DATABASE-REQUESTS.md) | Database tables, rows, constraints, cron (app-api + app-api-2) |
| [04-STORAGE-REQUESTS.md](./04-STORAGE-REQUESTS.md) | Object storage (buckets, upload, download) |
| [05-GRAPHQL-REQUESTS.md](./05-GRAPHQL-REQUESTS.md) | GraphQL queries and mutations |
| [06-COMMUNICATIONS-REQUESTS.md](./06-COMMUNICATIONS-REQUESTS.md) | Email, SMS, WhatsApp, templates, providers |
| [07-WEBSOCKET-REQUESTS.md](./07-WEBSOCKET-REQUESTS.md) | Real-time `/app-api/ws` |
| [03-PAYMENT-REQUESTS.md](./03-PAYMENT-REQUESTS.md) | Payments (PayFast, etc.) under `/app-api/payments/...` |
| [STORAGE-UPLOAD-CLIENT-NOTES.md](./STORAGE-UPLOAD-CLIENT-NOTES.md) | Multipart upload pitfalls for `POST /app-api/storage/files` |

## Typical authentication flow (app clients)

```
1. Register → POST /app-api/auth/auth/register        (header: x-api-key)
2. Verify registration OTP (if enabled) → POST /app-api/auth/auth/verify-otp
3. Login    → POST /app-api/auth/auth/login          (header: x-api-key)
4. Use accessToken as Bearer on routes that require it; keep using x-api-key for app-api database/storage
```

Project-scoped equivalents (no API key, `projectId` in URL) live under `/api/auth/{projectId}/auth/...` — see [01-AUTH-REQUESTS.md](./01-AUTH-REQUESTS.md).

## Response shape

Success:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2026-04-11T12:00:00.000000000Z"
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message"
}
```

Some legacy handlers (e.g. parts of communications) may return slightly different JSON; prefer checking HTTP status and `success` when present.
