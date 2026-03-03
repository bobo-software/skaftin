# Go API Gateway Migration

## Overview

The Go service has been upgraded from a standalone microservice to a full API gateway. All traffic now flows through Go, which either handles requests directly (`/api/v2/*`) or proxies them to Node.js.

## Architecture

```
Client / Frontend
        |
        v
   Go Gateway (:4007)
        |
        |-- /api/v2/*     --> Go handles directly (API key auth)
        |-- /auth/*       --> Go platform auth handler (SuperTokens Core-backed)
        |-- /api/*         --> JWT validation, then proxy to Node.js
        |-- /app-api/*     --> API key validation, then proxy to Node.js
        |-- /socket.io/*   --> Proxy to Node.js (WebSocket support)
        |
        v
   Node.js (:4006) -- internal only, not publicly exposed
```

## What Changed

### Phase 1: SuperTokens JWT Mode

Go now owns `/auth/*` through `go-services/internal/platformauth/handler.go`, which creates and refreshes SuperTokens Core sessions while preserving JWT claims consumed by Go middleware.

### Phase 2: Go JWT Validation

New files in Go:
- `internal/middleware/jwt.go` -- JWT auth middleware that extracts tokens from `sAccessToken` cookie or `Authorization: Bearer` header, validates them against the JWKS, and extracts `userId`, `projectIds`, `role` from claims.
- `internal/middleware/rsa.go` -- RSA public key parser for JWK keys.
- `internal/models/user.go` -- UserContext struct for authenticated platform users.

### Phase 3: Go Reverse Proxy

New files:
- `internal/proxy/reverse.go` -- Reverse proxy using `net/http/httputil.ReverseProxy` with full header pass-through (cookies, Set-Cookie, CORS), error handling, and WebSocket upgrade support for Socket.IO.

Updated route structure:
- `/api/v2/health` -- public, no auth
- `/api/v2/*` -- API key/access token auth, Go handles directly
- `/auth/*` -- handled by Go platform auth
- `/api/*` -- JWT auth, proxied to Node.js
- `/app-api/*` -- API key auth, proxied to Node.js
- `/socket.io/*` -- proxied to Node.js (WebSocket-aware)

### Phase 4: Infrastructure Cutover

- `docker-compose.yml` -- Go service gets `NODE_BACKEND_URL` and `SUPERTOKENS_CORE_URL` env vars. Node.js backend added as `node-backend` service with `expose: 4006` (internal only, no public port).
- `frontend/vite.config.ts` -- All proxy entries now point to `localhost:4007` (Go gateway).
- `frontend/src/config/supertokens.ts` -- Default API domain changed to `localhost:4007`.

### Phase 5: WebSocket Proxy

Built into the reverse proxy (`internal/proxy/reverse.go`). Detects `Upgrade: websocket` and `Connection: upgrade` headers to handle Socket.IO connections.

## Environment Variables (Go Service)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4007` | HTTP server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `skaftin_db` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | | Database password |
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO endpoint |
| `MINIO_ACCESS_KEY` | | MinIO access key |
| `MINIO_SECRET_KEY` | | MinIO secret key |
| `MINIO_USE_SSL` | `false` | Use SSL for MinIO |
| `NODE_BACKEND_URL` | `http://localhost:4006` | Node.js backend internal URL |
| `SUPERTOKENS_CORE_URL` | `http://localhost:3567` | SuperTokens Core URL for JWKS |

## Local Development

```bash
# Start all services
sudo docker compose up -d postgres supertokens node-backend go-service

# Verify Go gateway health
curl http://localhost:4007/api/v2/health

# Verify Node.js is reachable through Go
curl http://localhost:4007/api/health
```

## Production (Coolify)

1. Go service should be the public-facing service with the main API domain
2. Node.js backend should be internal-only (no public domain)
3. Set `VITE_API_URL` on the frontend to the Go gateway domain
4. Set `NODE_BACKEND_URL` on Go to the internal Node.js address
5. Set `SUPERTOKENS_CORE_URL` on Go to the SuperTokens Core address

## Auth Flow Summary

| Route | Auth Method | Handler |
|-------|------------|---------|
| `/auth/*` | None (SuperTokens Core-backed platform auth) | Go handles directly |
| `/api/*` | SuperTokens JWT (sAccessToken cookie or Bearer) | Proxy to Node.js |
| `/api/v2/*` | API key / access token (X-API-Key or Bearer) | Go handles directly |
| `/app-api/*` | API key / access token | Proxy to Node.js |
| `/socket.io/*` | None (Socket.IO has its own auth) | Proxy to Node.js |
