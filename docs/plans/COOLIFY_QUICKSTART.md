# 🚀 Coolify Quick Deployment Guide

## Step-by-Step Deployment on Coolify

### 📦 1. Deploy SuperTokens (Choose One)

#### Option A: Managed SuperTokens (Easiest)
1. Go to [supertokens.com/dashboard](https://supertokens.com/dashboard)
2. Create app → Copy **Connection URI** and **API Key**
3. Done! ✅

#### Option B: Self-Hosted on Coolify
1. Coolify → **New Resource** → **Docker Compose**
2. Name: `supertokens`
3. Paste:
```yaml
services:
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:10.0
    restart: always
    environment:
      POSTGRESQL_CONNECTION_URI: ${DB_CONNECTION_STRING}
      API_KEYS: ${SUPERTOKENS_API_KEY}
    ports:
      - "3567:3567"
```
4. Environment Variables:
   - `DB_CONNECTION_STRING`: Your Coolify PostgreSQL URL
   - `SUPERTOKENS_API_KEY`: (generate random secure key)
5. Domain: `supertokens.yourdomain.com`
6. **Deploy!**

---

### 🔧 2. Deploy Backend

1. Coolify → **New Resource** → **Application**
2. **Source**: Your Git repository
3. **Type**: Node.js
4. **Name**: `skaftin-backend`
5. **Build Pack**: Node.js
6. **Port**: `4006`
7. **Build Command**: `npm install && npm run build`
8. **Start Command**: `npm start`
9. **Domain**: `api.yourdomain.com`

10. **Environment Variables** (click "Add"):

```bash
# SuperTokens (from Step 1)
SUPERTOKENS_CONNECTION_URI=https://your-app.supertokens.io
# OR if self-hosted: http://supertokens:3567
SUPERTOKENS_API_KEY=your-api-key
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=https://api.yourdomain.com
SUPERTOKENS_WEBSITE_DOMAIN=https://yourdomain.com

# Backend
BACKEND_PORT=4006
FRONTEND_URL=https://yourdomain.com

# Database (use Coolify PostgreSQL)
DB_CONNECTION=postgresql
DB_HOST=your-coolify-postgres-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_NAME=skaftin_production
DB_SSL=false  # Internal Coolify network

# MinIO (use Coolify MinIO)
MINIO_ACCESS_KEY=your-minio-key
MINIO_SECRET_KEY=your-minio-secret
MINIO_SERVER_URL=https://s3.yourdomain.com
MINIO_ENDPOINT=minio:9000  # Internal Coolify name
MINIO_BUCKET=skaftin
MINIO_REGION=us-east-1
MINIO_USE_SSL=false  # Internal network

# Security
JWT_SECRET=your-very-long-random-secret-min-64-chars
```

11. **Deploy!**

---

### 🎨 3. Deploy Frontend

1. Coolify → **New Resource** → **Application**
2. **Source**: Same Git repository
3. **Type**: Static Site
4. **Name**: `skaftin-frontend`
5. **Build Command**: `cd frontend && npm install && npm run build`
6. **Publish Directory**: `frontend/dist`
7. **Domain**: `yourdomain.com`

8. **Environment Variables**:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

9. **Deploy!**

---

### 🗄️ 4. Database Migration

1. SSH into your Coolify server OR use Coolify's database GUI
2. Connect to your PostgreSQL database
3. Run:

```sql
-- Switch to your database
\c skaftin_production

-- Migrate user_id to VARCHAR for SuperTokens
ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Verify
SELECT user_id FROM projects LIMIT 1;
```

4. SuperTokens will auto-create its tables on first connection ✅

---

### 🔐 5. Update Code for Production

#### Backend: `go-services/internal/platformauth/handler.go`

Change these lines for production:

```typescript
Ensure Go platform auth cookie settings align with your domain strategy
(`Secure`, `SameSite`, and cookie path/domain) before production cutover.
```

#### Backend: `src/middleware/supertokensAuthMiddleware.ts`

Enable CSRF:

```typescript
export const authenticateSession = verifySession({
  sessionRequired: true,
  antiCsrfCheck: true,  // ← Change from false
});
```

#### Frontend: `frontend/vite.config.ts`

Comment out proxy (only for local dev):

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005,
    // proxy: { ... }  ← Comment out or remove
  },
  // ... rest
});
```

---

### ✅ 6. Test Everything

1. **Visit**: `https://yourdomain.com`
2. **Register** a new user
3. **Check cookies** (F12 → Application → Cookies):
   - Should see `sAccessToken`, `sRefreshToken`
   - ✅ Secure: true
   - ✅ HttpOnly: true
   - ✅ SameSite: None

4. **Create a project** - should work!
5. **Logout and login** - should work!

---

## 🎉 Done!

Your Skaftin platform is now live with SuperTokens authentication!

### 📊 Monitoring in Coolify

- **Logs**: Coolify Dashboard → Service → Logs
- **Metrics**: CPU, Memory, Network usage
- **Health**: Auto-checked every 30s

### 🔄 Auto-Deploy on Git Push

Enable in Coolify:
1. Go to service → **Settings**
2. Enable **Auto Deploy**
3. Push to `main` branch → Auto deploys! 🚀

---

## 🆘 Troubleshooting

### Backend not starting?
```bash
# Check logs in Coolify
# Look for environment variable issues
# Verify PostgreSQL connection
```

### Frontend can't connect to backend?
```bash
# Check VITE_API_URL is correct
# Verify CORS allows your frontend domain
# Check SSL certificates are active
```

### SuperTokens errors?
```bash
# Test connection: curl https://your-supertokens-uri/hello
# Verify API key matches
# Check CORS headers
```

---

## 📚 Next Steps

- Set up **automatic backups** for PostgreSQL
- Configure **email service** for password resets
- Add **monitoring alerts** in Coolify
- Set up **staging environment** (separate branch)

**Need help?** Check the full guide: `SUPERTOKENS_PRODUCTION_SETUP.md` 📖

