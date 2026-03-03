# Go Service Integration (Current State)

## Overview

This project no longer runs a split Node + Go backend model.
Go is now the primary API gateway and backend runtime.

## Routing Model

```
Client / Frontend
        |
        v
      Go (:4006)
        |-- /auth/*        -> Go platform auth handlers (SuperTokens Core-backed)
        |-- /api/*         -> Go handlers (JWT auth)
        |-- /app-api/*     -> Go handlers (API key auth)
        |-- /app-api-2/*   -> Go handlers (API key auth)
        `-- /api/v2/*      -> Go handlers
```

Unknown API routes return standardized Go `404` responses.

## Dependencies

- PostgreSQL (shared data store)
- MinIO (object storage)
- SuperTokens Core (session/auth backing service)

## Environment

Key Go variables:
- `PORT` (default `4006`)
- `SUPERTOKENS_CORE_URL`
- `SUPERTOKENS_API_KEY` (optional depending on Core setup)
- `DB_*`
- `MINIO_*`
- `APP_ROOT_DIR` (optional, for migrations path lookup)

## Local Run

```bash
docker compose up -d
curl http://localhost:4006/api/v2/health
```

## Deployment

CI builds and publishes:
- `dr.bobosoftware.co.za/skaftin-go-service:*`
- `dr.bobosoftware.co.za/skaftin-frontend:*`

There is no runtime Node backend image in the active deployment flow.
