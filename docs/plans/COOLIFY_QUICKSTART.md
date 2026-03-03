# Coolify Quickstart (Go-Only Backend)

## Deploy Order

1. PostgreSQL
2. MinIO
3. SuperTokens Core
4. Go API gateway
5. Frontend

## Backend Service (Go)

Create an application from image:
- `dr.bobosoftware.co.za/skaftin-go-service:latest`
- Port: `4006`
- Domain: your API domain (for example `skaftinplatform.example.com`)

Required env vars:

```bash
PORT=4006
SUPERTOKENS_CORE_URL=http://<supertokens-service>:3567
SUPERTOKENS_API_KEY=<api-key-if-enabled>

DB_HOST=<postgres-service>
DB_PORT=5432
DB_NAME=skaftin_db
DB_USER=postgres
DB_PASSWORD=<password>

MINIO_ENDPOINT=<minio-service>:9000
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_USE_SSL=false
```

## Frontend Service

- Build/publish as your existing frontend service
- Set:

```bash
VITE_API_URL=https://<your-api-domain>
VITE_WS_URL=wss://<your-api-domain>
```

## Verification

```bash
curl https://<your-api-domain>/api/v2/health
```

Expected: JSON health response from Go.

## Notes

- The previous Node backend service is retired from runtime.
- All API/auth traffic is served by Go, with SuperTokens Core as auth dependency.
