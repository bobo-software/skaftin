# Go Microservice Integration

## Overview

The Go microservice runs alongside the Node.js backend to handle performance-critical and CPU-intensive tasks. It shares the same PostgreSQL database and MinIO storage, and authenticates requests using the existing API key / access token system -- no SuperTokens dependency.

---

## Architecture

```
Frontend / Client Apps
        |
        v
   Nginx / Reverse Proxy
        |
        |-- /api/*       --> Node.js (Express) :4006   [SuperTokens + API keys]
        |-- /app-api/*    --> Node.js (Express) :4006   [API keys / access tokens]
        |-- /auth/*       --> Node.js (Express) :4006   [SuperTokens auth]
        |
        |-- /api/v2/*     --> Go Service :4007          [API keys / access tokens only]
```

- **Node.js** handles all platform UI operations, SuperTokens login/sessions, and credential management
- **Go** handles `/api/v2/*` routes using API keys and access tokens validated against the shared database
- Both services connect to the same PostgreSQL and MinIO instances

---

## Project Structure

```
go-services/
  cmd/
    api/
      main.go              -- Entry point, HTTP server, route registration
  internal/
    config/
      config.go            -- Environment variable loading (DB, MinIO, port)
    middleware/
      auth.go              -- API key / access token auth middleware
      logging.go           -- Structured request logging
      cors.go              -- CORS configuration
    handlers/
      health.go            -- GET /api/v2/health
    models/
      credential.go        -- Credential verification (DB query)
      project.go           -- Project schema lookup
      errors.go            -- Sentinel error types
    database/
      pool.go              -- pgxpool connection setup
  Dockerfile               -- Multi-stage Docker build
  go.mod / go.sum          -- Go module dependencies
```

---

## Authentication

The Go service replicates the same auth logic as the Node.js `apiKeyOnlyMiddleware`:

1. Extract token from `X-API-Key` header or `Authorization: Bearer <token>` header
2. Query `skaftin_system_api_credentials WHERE token = $1`
3. Validate `is_active = true` and `expires_at` hasn't passed
4. Look up `schema_name` from `skaftin_system_projects WHERE id = $1`
5. Attach credential context (id, projectId, name, type, permissions, schemaName) to request
6. Optionally check specific permissions per endpoint

Login and credential creation remain in Node.js. Go only validates existing credentials.

---

## Environment Variables

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

---

## Local Development

### Start with Docker Compose

```bash
# Start the Go service (and its postgres dependency)
sudo docker compose up -d postgres go-service

# Verify it's running
curl http://localhost:4007/api/v2/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "service": "skaftin-go-service",
    "status": "ok",
    "database": "ok",
    "time": "2026-02-17T10:00:00Z"
  }
}
```

### Rebuild after code changes

```bash
sudo docker compose up -d --build go-service
```

### Vite Dev Proxy

The frontend Vite dev server (`localhost:3005`) proxies `/api/v2/*` to `localhost:4007` automatically. No extra config needed during development.

---

## Adding New Endpoints

1. Create a handler in `go-services/internal/handlers/`:

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/skaftin/go-services/internal/middleware"
)

type MyHandler struct {
    pool *pgxpool.Pool
}

func NewMyHandler(pool *pgxpool.Pool) *MyHandler {
    return &MyHandler{pool: pool}
}

func (h *MyHandler) DoWork(w http.ResponseWriter, r *http.Request) {
    auth := middleware.GetAuthContext(r)
    // auth.ProjectID, auth.SchemaName, auth.Credential are available

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{
        "success": true,
        "data":    "result",
    })
}
```

2. Register it on the `authMux` in `cmd/api/main.go`:

```go
myHandler := handlers.NewMyHandler(pool)
authMux.HandleFunc("POST /api/v2/my-endpoint", myHandler.DoWork)
```

3. For permission-restricted endpoints, wrap with `RequirePermission`:

```go
restricted := middleware.RequirePermission("write")(http.HandlerFunc(myHandler.DoWork))
authMux.Handle("POST /api/v2/admin-endpoint", restricted)
```

---

## Coolify Production Deployment

### Step 1: Add a New Service in Coolify

1. Go to Coolify Dashboard -> **New Resource** -> **Application**
2. **Source**: Same Git repository as the backend
3. **Name**: `skaftin-go-service`
4. **Build Pack**: Dockerfile
5. **Dockerfile Location**: `go-services/Dockerfile`
6. **Base Directory**: `go-services`
7. **Port**: `4007`
8. **Domain**: `go.skaftinplatform.bobosoftware.co.za` (or your preferred subdomain)

### Step 2: Set Environment Variables

Add these in the Coolify service environment variables:

```bash
# ============================================================================
# PORT CONFIGURATION
# ============================================================================
PORT=4007

# ============================================================================
# DATABASE CONNECTION (same as Node.js backend)
# ============================================================================
DB_HOST=your-coolify-postgres-host
DB_PORT=5432
DB_NAME=skaftin_db
DB_USER=postgres
DB_PASSWORD=your-production-db-password

# ============================================================================
# MINIO/S3 CONFIGURATION (same as Node.js backend)
# ============================================================================
MINIO_ENDPOINT=minio.bobosoftware.co.za
MINIO_ACCESS_KEY=minio_user
MINIO_SECRET_KEY=your-production-minio-password
MINIO_USE_SSL=true
```

Use the **same database and MinIO credentials** as your Node.js backend service.

### Step 3: Configure Routing

The Go service needs to be reachable at `/api/v2/*`. There are two approaches:

#### Option A: Separate Subdomain (Simplest)

Give the Go service its own domain in Coolify (e.g., `go.skaftinplatform.bobosoftware.co.za`). Then update the frontend:

```bash
# Add to frontend environment variables in Coolify
VITE_GO_API_URL=https://go.skaftinplatform.bobosoftware.co.za
```

#### Option B: Same Domain with Path Routing (Recommended)

If your Coolify setup uses Traefik (the default), you can route by path prefix. Configure the Go service with a Traefik label to match `/api/v2/`:

In the Coolify service settings for `skaftin-go-service`, add a custom Traefik rule:

```
PathPrefix(`/api/v2`)
```

With the host matching your backend domain: `skaftinplatform.bobosoftware.co.za`

This way both Node.js and Go respond on the same domain, routed by path:
- `skaftinplatform.bobosoftware.co.za/api/*` -> Node.js
- `skaftinplatform.bobosoftware.co.za/api/v2/*` -> Go

**Important**: The `/api/v2` rule must have higher priority than `/api` in Traefik so it matches first. In Coolify, set a higher priority number on the Go service's Traefik rule.

### Step 4: Health Check

In the Coolify service settings, configure the health check:

- **Path**: `/api/v2/health`
- **Port**: `4007`
- **Interval**: `10s`

### Step 5: Deploy

1. Deploy the Go service in Coolify
2. Verify: `curl https://skaftinplatform.bobosoftware.co.za/api/v2/health`
3. Should return `{"success":true,"data":{"status":"ok","database":"ok",...}}`

### Step 6: CI/CD

The GitHub Actions workflow (`.github/workflows/docker-image.yml`) already builds and pushes the Go service image to your registry:

```
dr.bobosoftware.co.za/skaftin-go-service:latest
dr.bobosoftware.co.za/skaftin-go-service:<version>
```

Point the Coolify service to this image instead of building from source for faster deployments.

---

## Testing

### Health Check
```bash
curl http://localhost:4007/api/v2/health
```

### Authenticated Request
```bash
curl -H "X-API-Key: your-api-key-here" http://localhost:4007/api/v2/some-endpoint
```

### Test Auth Rejection
```bash
# Should return 401
curl http://localhost:4007/api/v2/some-authenticated-endpoint

# Should return 403
curl -H "X-API-Key: invalid-key" http://localhost:4007/api/v2/some-authenticated-endpoint
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `github.com/jackc/pgx/v5` | PostgreSQL driver with connection pooling |
| `github.com/rs/cors` | CORS handling |
| Go standard library `net/http` | HTTP server (no framework) |

---

## Notes

- **Database migrations** are owned by Node.js (Drizzle ORM). Go reads/writes to the same tables but does not manage the schema.
- **Connection pool limits**: Go is configured with max 10 connections. Combined with Node.js (max 20), ensure your PostgreSQL `max_connections` accommodates both.
- **Credential caching**: For high-throughput endpoints, consider adding an in-memory TTL cache for credential lookups to reduce database load.
- The Go binary compiles to ~10MB static binary with zero runtime dependencies.
