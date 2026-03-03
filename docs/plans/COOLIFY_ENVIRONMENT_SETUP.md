# Coolify Environment Variables Setup

## Architecture Overview

Skaftin now runs with a **Go-only API gateway** as the backend entry point.

```
Browser / Client Apps
        |
        v
  Coolify Traefik (HTTPS termination)
        |
        v
  Go Gateway (:4006)  <- skaftinplatform.bobosoftware.co.za
    |-- /auth/*         -> Go platform auth handlers (SuperTokens Core-backed)
    |-- /api/*          -> Go handlers (JWT auth)
    |-- /app-api/*      -> Go handlers (API key auth)
    |-- /app-api-2/*    -> Go handlers (API key auth)
    `-- /api/v2/*       -> Go handlers (API key auth)
```

## Your Domains

- Frontend: `https://skaftin.bobosoftware.co.za`
- Backend (Go Gateway): `https://skaftinplatform.bobosoftware.co.za`

## Coolify Services

Deploy these services on the same Docker network:

| Service | Image | Domain | Port |
|---------|-------|--------|------|
| Go Gateway | `dr.bobosoftware.co.za/skaftin-go-service:latest` | `skaftinplatform.bobosoftware.co.za` | 4006 |
| Frontend | `dr.bobosoftware.co.za/skaftin-frontend:latest` | `skaftin.bobosoftware.co.za` | 3006 |
| SuperTokens | `registry.supertokens.io/supertokens/supertokens-postgresql` | internal | 3567 |
| PostgreSQL | `postgres:17-alpine` | internal | 5432 |
| MinIO | `minio/minio:latest` | `minio-skaftin.bobosoftware.co.za` | 9000 |

## Go Gateway Environment Variables

Copy these to the **Go Gateway** service:

```bash
PORT=4006

SUPERTOKENS_CORE_URL=http://<supertokens-container-name>:3567
SUPERTOKENS_API_KEY=<your-production-api-key>

DB_HOST=<coolify-postgres-host>
DB_PORT=5432
DB_NAME=skaftin_db
DB_USER=postgres
DB_PASSWORD=<production-db-password>

MINIO_ENDPOINT=<coolify-minio-host>:9000
MINIO_ACCESS_KEY=<production-minio-key>
MINIO_SECRET_KEY=<production-minio-secret>
MINIO_USE_SSL=false
```

Optional:

```bash
# Only if you need custom migrations lookup path
APP_ROOT_DIR=..
```

## Frontend Environment Variables

Copy these to the **Frontend** service:

```bash
VITE_API_URL=https://skaftinplatform.bobosoftware.co.za
VITE_WS_URL=wss://skaftinplatform.bobosoftware.co.za
```

## Security Checklist

- [ ] SSL/HTTPS enabled on both public domains
- [ ] `SUPERTOKENS_API_DOMAIN` in SuperTokens config points at Go gateway public URL
- [ ] `SUPERTOKENS_WEBSITE_DOMAIN` points at frontend public URL
- [ ] `SUPERTOKENS_API_KEY` is not default
- [ ] Database and MinIO credentials are production values
- [ ] Go, SuperTokens, PostgreSQL, and MinIO share the same Docker network

## Deployment Steps

1. Push to `main` and publish latest images.
2. Deploy/upgrade Go Gateway service:
   - domain `skaftinplatform.bobosoftware.co.za`
   - port `4006`
   - env vars above
3. Deploy/upgrade Frontend service.
4. Verify health:
   - `GET /api/v2/health` returns `{"status":"ok"}`
5. Verify login and normal API usage from browser.

## Common Issues

- **401 / token verification issues**
  - Check `SUPERTOKENS_CORE_URL` and `SUPERTOKENS_API_KEY`.
- **Cookies not set**
  - Verify SuperTokens API/website domain values and public HTTPS.
- **CORS issues**
  - Ensure requests target Go gateway URL only.
