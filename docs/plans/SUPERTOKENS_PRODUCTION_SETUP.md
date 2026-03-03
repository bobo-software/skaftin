# SuperTokens Production Setup Guide for Coolify

## 🎯 Overview

This guide will help you deploy SuperTokens to production on your **Coolify server**.

---

## 🚀 Coolify Deployment Architecture

```
Coolify Server:
├── Backend (Node.js) - api.yourdomain.com
├── Frontend (Static) - yourdomain.com
├── PostgreSQL Database (already running)
├── MinIO Storage (already running)
└── SuperTokens Core (Docker container)
```

---

## 📋 Option 1: SuperTokens Managed Service (Recommended for Coolify)

### Step 1: Create SuperTokens App
1. Go to [https://supertokens.com/dashboard](https://supertokens.com/dashboard)
2. Sign up / Login
3. Click **"Create New App"**
4. Choose your region (closest to your users)
5. Copy the **Connection URI** and **API Key**

### Step 2: Configure Environment Variables in Coolify

In your **Coolify Dashboard** → **Backend Service** → **Environment Variables**, add:

```bash
# SuperTokens Production Configuration
SUPERTOKENS_CONNECTION_URI=https://your-app.supertokens.io
SUPERTOKENS_API_KEY=your-production-api-key-from-dashboard
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=https://api.yourdomain.com
SUPERTOKENS_WEBSITE_DOMAIN=https://yourdomain.com

# Backend Configuration
BACKEND_PORT=4006
FRONTEND_URL=https://yourdomain.com

# Database (Your Production PostgreSQL)
DB_CONNECTION=postgresql
DB_HOST=your-db-host.com
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD="your_secure_password"
DB_NAME=skaftin_production
DB_SSL=true  # Enable SSL for production database

# JWT (Legacy - keeping for compatibility)
JWT_SECRET=your-very-long-random-secret-key-min-64-chars

# MinIO/S3 (Production)
MINIO_ACCESS_KEY=your-production-access-key
MINIO_SECRET_KEY=your-production-secret-key
MINIO_SERVER_URL=https://s3.yourdomain.com
MINIO_ENDPOINT=s3.yourdomain.com
MINIO_BUCKET=skaftin-production
MINIO_REGION=us-east-1
MINIO_USE_SSL=true
```

### Step 3: Update Backend Configuration

**File: `go-services/internal/platformauth/handler.go`**

```typescript
Session.init({
  cookieSameSite: "none", // CHANGED: "lax" → "none" for cross-origin in production
  cookieSecure: true,     // CHANGED: false → true (requires HTTPS)
  cookieDomain: ".yourdomain.com", // CHANGED: undefined → your domain (allows subdomains)
  sessionExpiredStatusCode: 401,
  getTokenTransferMethod: () => "cookie",
  override: {
    // ... rest of your config
  },
}),
```

**Important changes for production:**
- `cookieSameSite: "none"` - Required if frontend/backend on different domains
- `cookieSecure: true` - Only send cookies over HTTPS
- `cookieDomain: ".yourdomain.com"` - Allows cookies across subdomains

### Step 4: Update CORS Configuration

**File: `src/Server.ts`**

```typescript
app.use(
  cors({
    origin: [
      process.env.SUPERTOKENS_WEBSITE_DOMAIN || "https://yourdomain.com",
      "https://www.yourdomain.com", // Add www variant if needed
    ],
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
  })
);
```

### Step 5: Update Frontend Configuration

**File: `frontend/.env.production`** (create this file)

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

**File: `frontend/vite.config.ts`**

Remove or comment out the proxy configuration (only needed for local dev):

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005,
    // Remove proxy in production - frontend directly calls backend
  },
  // ... rest of config
});
```

### Step 6: Database Migration

Run the SuperTokens migration (already done locally):

```sql
-- Your production database should have:
-- 1. User ID changed to VARCHAR(255)
-- 2. SuperTokens tables (created automatically)

-- Verify:
SELECT user_id FROM projects LIMIT 1; -- Should be UUID string format
```

### Step 7: Deploy on Coolify

#### **Backend Deployment:**

1. **In Coolify Dashboard** → **Create New Resource**
2. Select **Docker Compose** or **Dockerfile**
3. Connect your Git repository
4. Set **Build Pack**: Node.js
5. **Build Command**: `npm install && npm run build`
6. **Start Command**: `npm start`
7. **Port**: `4006`
8. Set environment variables (from Step 2)
9. **Deploy!**

#### **Frontend Deployment:**

1. **In Coolify Dashboard** → **Create New Resource**
2. Select **Static Site**
3. Connect your Git repository (same repo, `frontend` folder)
4. **Build Command**: `cd frontend && npm install && npm run build`
5. **Publish Directory**: `frontend/dist`
6. Set environment variables:
   - `VITE_API_URL=https://api.yourdomain.com`
   - `VITE_WS_URL=wss://api.yourdomain.com`
7. **Deploy!**

#### **Configure Domains in Coolify:**

1. **Backend**: 
   - Go to backend service → **Domains**
   - Add: `api.yourdomain.com`
   - Coolify automatically generates SSL certificate ✅

2. **Frontend**:
   - Go to frontend service → **Domains**
   - Add: `yourdomain.com` and `www.yourdomain.com`
   - SSL auto-generated ✅

---

## 📋 Option 2: Self-Hosted SuperTokens on Coolify

### Step 1: Deploy SuperTokens Core in Coolify

1. **In Coolify Dashboard** → **Create New Resource**
2. Select **Docker Compose**
3. **Paste this Docker Compose**:

```yaml
services:
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:10.0
    restart: always
    environment:
      # Use your existing Coolify PostgreSQL
      POSTGRESQL_CONNECTION_URI: ${POSTGRESQL_CONNECTION_URI}
      API_KEYS: ${SUPERTOKENS_API_KEY}
    ports:
      - "3567:3567"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3567/hello"]
      interval: 30s
      timeout: 10s
      retries: 3
```

4. **Add Environment Variables**:
   - `POSTGRESQL_CONNECTION_URI`: Your Coolify PostgreSQL connection string
   - `SUPERTOKENS_API_KEY`: Generate a secure random key

5. **Configure Domain**: `supertokens.yourdomain.com` (SSL auto-generated)

6. **Deploy!**

### Step 2: Update Backend Environment Variables

In **Backend Service** → **Environment Variables**, change:

```bash
SUPERTOKENS_CONNECTION_URI=http://supertokens:3567
# Or if using domain: https://supertokens.yourdomain.com
SUPERTOKENS_API_KEY=your-generated-api-key
```

**Note:** If SuperTokens and Backend are in the same Coolify network, use internal URL: `http://supertokens:3567`

---

## 🔒 Security Checklist

### ✅ Before Going Live:

- [ ] Enable SSL/HTTPS on all domains
- [ ] Set `cookieSecure: true`
- [ ] Set `cookieSameSite: "none"` (if cross-origin) or `"strict"`
- [ ] Enable CSRF protection (remove `antiCsrfCheck: false`)
- [ ] Use strong `API_KEYS` for SuperTokens
- [ ] Enable database SSL (`DB_SSL=true`)
- [ ] Set strong `JWT_SECRET` (64+ characters)
- [ ] Configure CORS to only allow your frontend domain
- [ ] Set up rate limiting
- [ ] Enable logging and monitoring
- [ ] Back up SuperTokens database regularly

### Enable CSRF Protection:

**File: `src/middleware/supertokensAuthMiddleware.ts`**

```typescript
export const authenticateSession = verifySession({
  sessionRequired: true,
  antiCsrfCheck: true, // CHANGED: false → true for production
});
```

**File: `go-services/internal/platformauth/handler.go`**

```typescript
Session.init({
  cookieSameSite: "none",
  cookieSecure: true,
  antiCsrfProtection: "VIA_TOKEN", // Enable CSRF protection
  // ... rest of config
}),
```

---

## 🌐 Domain Setup Examples

### Example 1: Same Domain (Subdomain)
```
Frontend: https://app.yourdomain.com
Backend:  https://api.yourdomain.com

cookieDomain: ".yourdomain.com"
cookieSameSite: "lax" or "strict"
```

### Example 2: Different Domains
```
Frontend: https://yourfrontend.com
Backend:  https://yourbackend.com

cookieDomain: undefined (browser default)
cookieSameSite: "none"
cookieSecure: true
```

---

## 🧪 Testing Production Setup

### 1. Test HTTPS
```bash
curl -I https://api.yourdomain.com/api/health
# Should return 200 OK with HTTPS
```

### 2. Test SuperTokens Connection
```bash
curl https://your-supertokens-uri/hello
# Should return: "Hello"
```

### 3. Test Authentication Flow
1. Register new user via frontend
2. Check browser DevTools → Application → Cookies
3. Should see `sAccessToken`, `sRefreshToken` with:
   - ✅ Secure: true
   - ✅ HttpOnly: true
   - ✅ SameSite: None (or Lax/Strict based on setup)

### 4. Test Protected Routes
```bash
# Should fail without cookies
curl https://api.yourdomain.com/api/projects/list
# Returns: 401 Unauthorized

# Should work with valid session (browser handles this automatically)
```

---

## 📊 Monitoring & Logs

### SuperTokens Dashboard
- Login to SuperTokens dashboard
- View active sessions
- Monitor user signups
- Check error logs

### Backend Logs
```bash
# Check for SuperTokens errors
grep "supertokens" /var/log/your-app.log

# Monitor authentication
tail -f /var/log/your-app.log | grep "Session created"
```

---

## 🔄 Migration from Development to Production

### 1. User Migration
Your existing users in development have SuperTokens UUIDs. For production:

**Option A: Fresh Start**
- Start with clean database
- Users re-register in production

**Option B: Migrate Users**
- Export user emails from development
- Use SuperTokens API to bulk import users
- Send password reset emails

### 2. Database Schema
Already prepared! Your `user_id` is VARCHAR(255) which works with SuperTokens UUIDs.

### 3. Environment Variables
Use separate `.env` files:
- `.env` - Development (local Docker)
- `.env.production` - Production (managed service)

---

## 🚨 Troubleshooting Production

### Issue: Cookies not being set
**Solution:**
- Verify HTTPS is enabled
- Check `cookieSecure: true`
- Check `cookieSameSite` matches your domain setup
- Verify CORS allows `credentials: true`

### Issue: 401 Unauthorized on protected routes
**Solution:**
- Check SuperTokens connection URI is correct
- Verify API key matches dashboard
- Check browser is sending cookies (DevTools → Network → Headers)
- Verify session hasn't expired

### Issue: CORS errors
**Solution:**
- Add frontend domain to CORS `origin` array
- Ensure `credentials: true` in CORS config
- Check SuperTokens CORS headers are included

---

## 📚 Additional Resources

- **SuperTokens Docs:** https://supertokens.com/docs
- **SuperTokens Dashboard:** https://supertokens.com/dashboard
- **Discord Support:** https://supertokens.com/discord
- **Migration Guide:** https://supertokens.com/docs/guides/migration

---

## ✅ Coolify Deployment Checklist

### 1. SuperTokens Setup:
- [ ] Create SuperTokens managed app (Option 1) OR
- [ ] Deploy SuperTokens container in Coolify (Option 2)
- [ ] Copy connection URI and API key
- [ ] Test: `curl https://your-supertokens-uri/hello`

### 2. Backend Deployment in Coolify:
- [ ] Create new Docker/Node.js service
- [ ] Connect Git repository
- [ ] Configure domain: `api.yourdomain.com`
- [ ] Add all environment variables (see Step 2)
- [ ] Update `cookieSecure: true` in code
- [ ] Update `cookieSameSite` based on domain setup
- [ ] Enable CSRF protection in code
- [ ] Update CORS to production domain in code
- [ ] **Deploy!**
- [ ] Verify health: `https://api.yourdomain.com/api/health`

### 3. Frontend Deployment in Coolify:
- [ ] Create new Static Site service
- [ ] Connect Git repository (`frontend` folder)
- [ ] Configure domain: `yourdomain.com`
- [ ] Add environment variables:
  - `VITE_API_URL=https://api.yourdomain.com`
  - `VITE_WS_URL=wss://api.yourdomain.com`
- [ ] Remove/comment Vite proxy in `vite.config.ts`
- [ ] **Deploy!**
- [ ] Test login flow
- [ ] Verify cookies in browser DevTools

### 4. Database (Already in Coolify):
- [ ] Run migration: `ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(255);`
- [ ] Verify migration: `SELECT user_id FROM projects;`
- [ ] SuperTokens tables created automatically on first connection

### 5. SSL & Security (Auto-handled by Coolify):
- [ ] ✅ SSL certificates auto-generated for all domains
- [ ] ✅ HTTPS enforced automatically
- [ ] ✅ Domain routing configured

### 6. Final Testing:
- [ ] Register new user at `https://yourdomain.com`
- [ ] Login successfully
- [ ] Create a project
- [ ] Check cookies in DevTools (Secure, HttpOnly, SameSite)
- [ ] Logout and login again
- [ ] Test protected routes work

---

## 🎯 Coolify-Specific Tips

### Network Configuration
If all services (Backend, SuperTokens, PostgreSQL) are in the same Coolify instance:
- Use **internal Docker network names** for faster communication
- Example: `SUPERTOKENS_CONNECTION_URI=http://supertokens:3567`
- No need for external HTTPS between services on same server

### Environment Variables
Coolify supports:
- ✅ Per-service environment variables
- ✅ Shared environment variables (team/project level)
- ✅ Secret management (encrypted storage)

### Automatic Deployments
Enable in Coolify:
- ✅ Auto-deploy on Git push
- ✅ Webhook integration
- ✅ Branch-specific deployments (staging/production)

### Logs & Monitoring
Access in Coolify Dashboard:
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Network usage
- **Health checks**: Automatic service monitoring

### Database Backups
In Coolify PostgreSQL service:
- Enable automatic backups
- Configure backup schedule
- Test restore process

---

**Need help?** Feel free to ask! 🚀

