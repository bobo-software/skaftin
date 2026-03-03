# Go API Gateway Migration

## Overview

The Go service has been upgraded from a standalone microservice to the full API gateway. All auth and API traffic now flows through Go.

## Architecture

```
Client / Frontend
        |
        v
   Go Gateway (:4006)
        |
        |-- /api/v2/*      --> Go handles directly (API key auth)
        |-- /auth/*       --> Go platform auth handler (SuperTokens Core-backed)
        |-- /api/*        --> Explicit Go routes only; unknown paths return Go 404
        |-- /app-api/*    --> Explicit Go routes only; unknown paths return Go 404
        |-- /app-api-2/*  --> Explicit Go routes only; unknown paths return Go 404
```

## What Changed

### Phase 1: SuperTokens JWT Mode

Go now owns `/auth/*` through `go-services/internal/platformauth/handler.go`, which creates and refreshes SuperTokens Core sessions while preserving JWT claims consumed by Go middleware.

### Phase 2: Go JWT Validation

New files in Go:
- `internal/middleware/jwt.go` -- JWT auth middleware that extracts tokens from `sAccessToken` cookie or `Authorization: Bearer` header, validates them against the JWKS, and extracts `userId`, `projectIds`, `role` from claims.
- `internal/middleware/rsa.go` -- RSA public key parser for JWK keys.
- `internal/models/user.go` -- UserContext struct for authenticated platform users.

### Phase 3: Strict Go Route Ownership

Updated route structure:
- `/api/v2/health` -- public, no auth
- `/api/v2/*` -- API key/access token auth, Go handles directly
- `/auth/*` -- handled by Go platform auth
- `/api/*` -- explicit Go routes only (unknown paths return Go 404)
- `/app-api/*` -- explicit Go routes only (unknown paths return Go 404)
- `/app-api-2/*` -- explicit Go routes only (unknown paths return Go 404)

### Phase 4: Infrastructure Cutover

- `docker-compose.yml` -- Go service uses `SUPERTOKENS_CORE_URL` and owns all API routing directly.
- `frontend/vite.config.ts` -- All proxy entries now point to `localhost:4006` (Go gateway).
- `frontend/src/config/supertokens.ts` -- Default API domain changed to `localhost:4006`.

## Environment Variables (Go Service)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4006` | HTTP server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `skaftin_db` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | | Database password |
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO endpoint |
| `MINIO_ACCESS_KEY` | | MinIO access key |
| `MINIO_SECRET_KEY` | | MinIO secret key |
| `MINIO_USE_SSL` | `false` | Use SSL for MinIO |
| `SUPERTOKENS_CORE_URL` | `http://localhost:3567` | SuperTokens Core URL for JWKS |

## Local Development

```bash
# Start all services
sudo docker compose up -d postgres supertokens go-service

# Verify Go gateway health
curl http://localhost:4006/api/v2/health
```

## Production (Coolify)

1. Go service should be the public-facing service with the main API domain
2. Set `VITE_API_URL` on the frontend to the Go gateway domain
3. Set `SUPERTOKENS_CORE_URL` on Go to the SuperTokens Core address

## Auth Flow Summary

| Route | Auth Method | Handler |
|-------|------------|---------|
| `/auth/*` | None (SuperTokens Core-backed platform auth) | Go handles directly |
| `/api/*` | SuperTokens JWT (sAccessToken cookie or Bearer) | Go handlers only |
| `/api/v2/*` | API key / access token (X-API-Key or Bearer) | Go handles directly |
| `/app-api/*` | API key / access token | Go handlers only |
| `/app-api-2/*` | API key / access token | Go handlers only |
