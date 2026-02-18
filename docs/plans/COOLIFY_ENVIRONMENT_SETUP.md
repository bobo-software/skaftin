# Coolify Environment Variables Setup

## Architecture Overview

The Skaftin platform uses a **Go API Gateway** as the single public entry point.
All traffic flows through Go, which proxies to the Node.js backend internally.

```
Browser / Client Apps
        │
        ▼
  Coolify Traefik (HTTPS termination)
        │
        ▼
  Go Gateway (:4006)  ◄── skaftinplatform.bobosoftware.co.za
    ├── /auth/*           → Node.js (:4007)   [pass-through, no auth]
    ├── /api/*            → Node.js (:4007)   [JWT validated by Go]
    ├── /app-api/*        → Node.js (:4007)   [API key validated by Go]
    ├── /socket.io/*      → Node.js (:4007)   [WebSocket pass-through]
    └── /api/v2/*         → Go handles directly [API key auth]
```

## Your Domains

- **Frontend**: `https://skaftin.bobosoftware.co.za`
- **Backend (Go Gateway)**: `https://skaftinplatform.bobosoftware.co.za`

---

## Coolify Services

You need these services deployed in Coolify (all on the same Docker network):

| Service | Image | Domain | Port |
|---------|-------|--------|------|
| **Go Gateway** | `dr.bobosoftware.co.za/skaftin-go-service:latest` | `skaftinplatform.bobosoftware.co.za` | 4006 |
| **Node.js Backend** | `dr.bobosoftware.co.za/skaftin-platform:latest` | _(none — internal only)_ | 4007 |
| **Frontend** | `dr.bobosoftware.co.za/skaftin-frontend:latest` | `skaftin.bobosoftware.co.za` | 3006 |
| **SuperTokens** | `registry.supertokens.io/supertokens/supertokens-postgresql` | _(internal)_ | 3567 |
| **PostgreSQL** | `postgres:17-alpine` | _(internal)_ | 5432 |
| **MinIO** | `minio/minio:latest` | `minio-skaftin.bobosoftware.co.za` | 9000 |

---

## Go Gateway Environment Variables

Copy these to your **Go Gateway Service** in Coolify:

```bash
# ============================================================================
# GO GATEWAY CONFIGURATION
# ============================================================================
PORT=4006

# IMPORTANT: Do NOT auto-start Node.js in production (separate containers)
AUTO_START_NODE=false

# ============================================================================
# NODE.JS BACKEND CONNECTION (Docker network hostname)
# ============================================================================
# Use the container name or Coolify service hostname
NODE_BACKEND_URL=http://<node-backend-container-name>:4007

# ============================================================================
# SUPERTOKENS CORE (for JWKS key fetching)
# ============================================================================
SUPERTOKENS_CORE_URL=http://<supertokens-container-name>:3567

# ============================================================================
# DATABASE CONNECTION
# ============================================================================
DB_HOST=<coolify-postgres-host>
DB_PORT=5432
DB_NAME=skaftin_db
DB_USER=postgres
DB_PASSWORD=<production-db-password>

# ============================================================================
# MINIO/S3 CONFIGURATION
# ============================================================================
MINIO_ENDPOINT=<coolify-minio-host>:9000
MINIO_ACCESS_KEY=<production-minio-key>
MINIO_SECRET_KEY=<production-minio-secret>
MINIO_USE_SSL=false
```

**Key points:**
- `AUTO_START_NODE=false` — In production, Node.js is a separate container. Go does NOT spawn it.
- `NODE_BACKEND_URL` — Must use the Docker network hostname of the Node.js container (e.g. `http://skaftin-node-backend:4007`).
- `MINIO_USE_SSL=false` — MinIO traffic is internal (Docker network). Traefik handles HTTPS for external access.

---

## Node.js Backend Environment Variables

Copy these to your **Node.js Backend Service** in Coolify:

```bash
# ============================================================================
# NODE ENVIRONMENT
# ============================================================================
NODE_ENV=production

# ============================================================================
# PORT CONFIGURATION
# ============================================================================
# IMPORTANT: Node.js runs on 4007 (Go gateway occupies 4006)
BACKEND_PORT=4007
FRONTEND_URL=https://skaftin.bobosoftware.co.za

# ============================================================================
# DATABASE CONNECTION
# ============================================================================
DB_CONNECTION=postgresql
DB_HOST=<coolify-postgres-host>
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<production-db-password>
DB_NAME=skaftin_db

# ============================================================================
# JWT SECRET
# ============================================================================
JWT_SECRET=<your-strong-jwt-secret>

# ============================================================================
# SUPERTOKENS CONFIGURATION
# ============================================================================
SUPERTOKENS_CONNECTION_URI=http://<supertokens-container-name>:3567
SUPERTOKENS_API_KEY=<your-production-api-key>
SUPERTOKENS_APP_NAME=Skaftin

# IMPORTANT: API_DOMAIN is the PUBLIC domain (Go gateway), not Node.js directly
SUPERTOKENS_API_DOMAIN=https://skaftinplatform.bobosoftware.co.za
SUPERTOKENS_WEBSITE_DOMAIN=https://skaftin.bobosoftware.co.za

# ============================================================================
# COOKIE DOMAIN (CRITICAL FOR SESSION REFRESH)
# ============================================================================
COOKIE_DOMAIN=.bobosoftware.co.za

# ============================================================================
# EMAIL CONFIGURATION
# ============================================================================
EMAIL_USER=<your-email>
EMAIL_PASS=<your-email-app-password>

# ============================================================================
# MINIO/S3 CONFIGURATION
# ============================================================================
MINIO_ACCESS_KEY=<production-minio-key>
MINIO_SECRET_KEY=<production-minio-secret>
MINIO_SERVER_URL=https://minio-skaftin.bobosoftware.co.za
MINIO_ENDPOINT=<coolify-minio-host>:9000
MINIO_BUCKET=skaftin
MINIO_REGION=us-east-1
MINIO_USE_SSL=false
```

**Key points:**
- `BACKEND_PORT=4007` — Node.js listens on 4007, not 4006.
- `SUPERTOKENS_API_DOMAIN` — Points to the public Go gateway domain, NOT to Node.js directly. SuperTokens uses this for cookie issuer and token verification.
- Node.js has NO public domain assigned in Coolify. All traffic reaches it via Go.

---

## Frontend Environment Variables

Copy these to your **Frontend Service** in Coolify (no changes from before):

```bash
# ============================================================================
# API CONFIGURATION
# ============================================================================
VITE_API_URL=https://skaftinplatform.bobosoftware.co.za

# ============================================================================
# WEBSOCKET CONFIGURATION
# ============================================================================
VITE_WS_URL=wss://skaftinplatform.bobosoftware.co.za
```

---

## Security Checklist

Before deploying, make sure:

- [ ] **SSL/HTTPS** is enabled on both public domains
- [ ] **COOKIE_DOMAIN** is set to `.bobosoftware.co.za` in Node.js backend
- [ ] **NODE_ENV** is set to `production` in Node.js backend
- [ ] **SUPERTOKENS_API_DOMAIN** matches the Go gateway's public URL exactly
- [ ] **SUPERTOKENS_WEBSITE_DOMAIN** matches the frontend URL exactly
- [ ] **SUPERTOKENS_API_KEY** is changed from default
- [ ] **JWT_SECRET** is a strong random string
- [ ] **AUTO_START_NODE=false** is set on the Go gateway
- [ ] **NODE_BACKEND_URL** uses the correct Docker network hostname
- [ ] Database and MinIO credentials are production values
- [ ] Go and Node.js services are on the **same Docker network** in Coolify

---

## Deployment Steps

1. **Push to `main`** — CI/CD builds and pushes all 3 images (Go, Node.js, Frontend)
2. **Create Go Gateway service** in Coolify:
   - Image: `dr.bobosoftware.co.za/skaftin-go-service:latest`
   - Assign domain: `skaftinplatform.bobosoftware.co.za`
   - Set port: `4006`
   - Paste Go env vars above
3. **Update Node.js Backend service** in Coolify:
   - Remove its public domain (Go is now the entry point)
   - Change `BACKEND_PORT` to `4007`
   - Keep all other env vars
4. **Ensure networking**:
   - Both Go and Node.js must be on the same Docker network
   - Verify `NODE_BACKEND_URL` resolves (test with `curl` inside Go container)
5. **Deploy** both services
6. **Verify** (see Testing section below)

---

## Testing After Deployment

### 1. Go Gateway Health
```bash
curl https://skaftinplatform.bobosoftware.co.za/api/v2/health
```
Should return: `{"status":"ok"}`

### 2. Node.js Health (via Go proxy)
```bash
curl https://skaftinplatform.bobosoftware.co.za/api/health
```
Should return: `{"status":"ok",...}`

### 3. SuperTokens Connection
```bash
curl https://skaftinplatform.bobosoftware.co.za/auth/hello
```
Should return: `"Hello"` or SuperTokens response

### 4. Test in Browser
1. Open `https://skaftin.bobosoftware.co.za`
2. Try to login
3. Check **Application > Cookies** for `.bobosoftware.co.za` cookies:
   - `sAccessToken`
   - `sRefreshToken`
   - `sFrontToken`

### 5. Test Client App Auth
From an external client app, verify:
```bash
curl -X POST https://skaftinplatform.bobosoftware.co.za/app-api/auth/auth/login \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <project-api-key>" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 6. Check Go Gateway Logs
In Coolify, the Go service logs should show:
```
{"level":"INFO","msg":"connected to PostgreSQL"}
{"level":"INFO","msg":"JWKS provider initialized"}
{"level":"INFO","msg":"reverse proxy initialized"}
{"level":"INFO","msg":"Go gateway starting","port":"4006","autoStartNode":false}
```

---

## Common Issues & Solutions

### Issue: "502 Bad Gateway" on all routes
**Cause**: Go can't reach Node.js  
**Solution**: Check `NODE_BACKEND_URL` — it must use the Docker network hostname, not `localhost`. Verify both containers are on the same network.

### Issue: "Cookies not being set"
**Cause**: `cookieSecure: false` or missing `COOKIE_DOMAIN`  
**Solution**: Ensure `COOKIE_DOMAIN=.bobosoftware.co.za` is set on Node.js backend.

### Issue: "CORS error" from client apps
**Cause**: Go CORS middleware not allowing the origin  
**Solution**: Go allows all origins by default. Check browser console for the specific error — it may be duplicate CORS headers if Node.js also sets them (Go strips these in the proxy, so this should not happen).

### Issue: "Session refresh not working"
**Cause**: Cookie domain mismatch or `SUPERTOKENS_API_DOMAIN` wrong  
**Solution**: `SUPERTOKENS_API_DOMAIN` must be `https://skaftinplatform.bobosoftware.co.za` (the Go gateway URL, not Node.js).

### Issue: "WebSocket connection failed"
**Cause**: Traefik not upgrading to WebSocket  
**Solution**: Coolify/Traefik typically handles this automatically. If not, add WebSocket support labels to the Go service in Coolify.

### Issue: "SuperTokens connection error" in Go logs
**Cause**: `SUPERTOKENS_CORE_URL` incorrect  
**Solution**: Use the Docker network hostname: `http://<supertokens-container>:3567`

---

## Important Notes

- **Go does NOT spawn Node.js in production** (`AUTO_START_NODE=false`). They run as separate Coolify services.
- **Traefik handles HTTPS**. Go and Node.js communicate over plain HTTP on the internal Docker network.
- **Go strips CORS headers** from Node.js responses to prevent duplicates.
- **Go validates JWTs** using JWKS keys from SuperTokens Core for `/api/*` routes.
- **Go validates API keys** against PostgreSQL for `/app-api/*` and `/api/v2/*` routes.
- **The `.env` file is NOT used in production**. Go's `godotenv.Load()` silently skips if no file exists.
