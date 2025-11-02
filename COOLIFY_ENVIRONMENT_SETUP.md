# 🚀 Coolify Environment Variables Setup

## Your Domains
- **Frontend**: `https://skaftin.bobosoftware.co.za`
- **Backend**: `https://skaftinplatform.bobosoftware.co.za`

---

## 📋 Backend Environment Variables

Copy these to your **Backend Service** in Coolify:

```bash
# ============================================================================
# NODE ENVIRONMENT
# ============================================================================
NODE_ENV=production

# ============================================================================
# PORT CONFIGURATION
# ============================================================================
BACKEND_PORT=4006
FRONTEND_URL=https://skaftin.bobosoftware.co.za

# ============================================================================
# DATABASE CONNECTION (Update with your Coolify Postgres details)
# ============================================================================
DB_CONNECTION=postgresql
DB_HOST=your-postgres-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-database-password
DB_NAME=skaftin_db

# ============================================================================
# JWT SECRET (Keep your existing one or generate a new strong one)
# ============================================================================
JWT_SECRET=18c93bfdbc667a31a0bc79898a27d6b518227c03d763941d0bf91173a4e62edc065e892e77ca61e14f52c4e68be0d5d9315f1ba38b46727c25dfe846e3e0de48

# ============================================================================
# SUPERTOKENS CONFIGURATION (PRODUCTION)
# ============================================================================
# If SuperTokens is running on the same Docker network:
SUPERTOKENS_CONNECTION_URI=http://supertokens:3567
# OR if it's on a separate domain:
# SUPERTOKENS_CONNECTION_URI=https://supertokens.bobosoftware.co.za

# SuperTokens API Key (generate a strong random key)
SUPERTOKENS_API_KEY=your-production-api-key-change-this

# App Configuration
SUPERTOKENS_APP_NAME=Skaftin

# IMPORTANT: These must match your actual domains
SUPERTOKENS_API_DOMAIN=https://skaftinplatform.bobosoftware.co.za
SUPERTOKENS_WEBSITE_DOMAIN=https://skaftin.bobosoftware.co.za

# ============================================================================
# COOKIE DOMAIN (CRITICAL FOR SESSION REFRESH)
# ============================================================================
# This allows cookies to work across subdomains
# Note: The dot (.) prefix is important!
COOKIE_DOMAIN=.bobosoftware.co.za

# ============================================================================
# EMAIL CONFIGURATION
# ============================================================================
EMAIL_USER=sibiya.bobo@gmail.com
EMAIL_PASS=alra nhff vmlp tyqt

# ============================================================================
# MINIO/S3 CONFIGURATION (Update with your Coolify MinIO details)
# ============================================================================
MINIO_ROOT_USER=minio_user
MINIO_ROOT_PASSWORD=your-minio-password
MINIO_ACCESS_KEY=minio_user
MINIO_SECRET_KEY=your-minio-password
MINIO_SERVER_URL=https://minio.bobosoftware.co.za
MINIO_ENDPOINT=minio.bobosoftware.co.za
MINIO_BUCKET=skaftin
MINIO_REGION=us-east-1
MINIO_USE_SSL=true
```

---

## 📋 Frontend Environment Variables

Copy these to your **Frontend Service** in Coolify:

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

## 🔐 Security Checklist

Before deploying, make sure:

- [ ] **SSL/HTTPS** is enabled on both domains ✅ (You already have this)
- [ ] **COOKIE_DOMAIN** is set to `.bobosoftware.co.za` in backend
- [ ] **NODE_ENV** is set to `production` in backend
- [ ] **SUPERTOKENS_API_DOMAIN** matches your backend URL exactly
- [ ] **SUPERTOKENS_WEBSITE_DOMAIN** matches your frontend URL exactly
- [ ] **SUPERTOKENS_API_KEY** is changed from default
- [ ] **JWT_SECRET** is a strong random string
- [ ] Database credentials are updated for production
- [ ] MinIO credentials are updated for production

---

## 🧪 Testing After Deployment

### 1. Check Backend Health
```bash
curl https://skaftinplatform.bobosoftware.co.za/api/health
```
Should return: `{"status":"ok",...}`

### 2. Check SuperTokens Connection
```bash
curl https://skaftinplatform.bobosoftware.co.za/auth/hello
```
Should return: `"Hello"` or SuperTokens response

### 3. Test in Browser
1. Open browser console (F12)
2. Go to `https://skaftin.bobosoftware.co.za`
3. Try to login
4. Check **Application → Cookies** tab
5. Look for cookies from `.bobosoftware.co.za` domain
6. Should see:
   - `sAccessToken`
   - `sRefreshToken`
   - `sFrontToken`

### 4. Check Backend Logs
In Coolify, check your backend logs for:
```
🔧 SuperTokens Cookie Configuration: {
  environment: 'production',
  cookieSameSite: 'none',
  cookieSecure: true,
  cookieDomain: '.bobosoftware.co.za',
  ...
}
```

### 5. Check CORS Logs
Look for:
```
🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
🔌 WebSocket CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cookies not being set"
**Cause**: `cookieSecure: false` or missing `COOKIE_DOMAIN`  
**Solution**: ✅ Already fixed in code - just set the env vars above

### Issue: "CORS error"
**Cause**: Frontend URL not matching `SUPERTOKENS_WEBSITE_DOMAIN`  
**Solution**: Double-check URLs - they must match exactly (https vs http, trailing slash, etc.)

### Issue: "Session refresh not working"
**Cause**: One of:
- `COOKIE_DOMAIN` not set
- `cookieSameSite: "lax"` instead of `"none"` for cross-subdomain
- `cookieSecure: false` on HTTPS

**Solution**: ✅ Already fixed - just deploy with correct env vars

### Issue: "SuperTokens connection error"
**Cause**: `SUPERTOKENS_CONNECTION_URI` incorrect  
**Solution**: 
- If in same Docker network: `http://supertokens:3567`
- If separate: `https://your-supertokens-domain.com`

---

## 📝 Quick Setup Steps

1. **In Coolify Backend Service**:
   - Go to Environment Variables
   - Paste the backend env vars above
   - Update database and MinIO credentials
   - **Save and redeploy**

2. **In Coolify Frontend Service**:
   - Go to Environment Variables
   - Paste the frontend env vars above
   - **Save and rebuild**

3. **Test**:
   - Visit `https://skaftin.bobosoftware.co.za`
   - Try logging in
   - Check browser console for errors
   - Check backend logs

---

## 🆘 Still Not Working?

If you still have issues after setting these, check:

1. **Browser Console** (F12):
   - Any CORS errors?
   - Cookie warnings?
   - Network tab → Check response headers

2. **Backend Logs** in Coolify:
   - Look for the configuration logs
   - Check for any errors during startup

3. **Network Tab** in DevTools:
   - Check if cookies are being sent with requests
   - Look at request/response headers

4. **SuperTokens Dashboard** (if enabled):
   - Check if sessions are being created
   - Verify user accounts exist

---

## 💡 Pro Tips

- **Always use HTTPS in production** (you already have this ✅)
- **Cookie domain must start with a dot** (`.bobosoftware.co.za`)
- **SameSite=none requires Secure=true**
- **Test in incognito mode** to avoid cached cookies
- **Check both domains use HTTPS** (no mixed content)
- **Keep API keys secret** - never commit to git

---

## 🎯 What Changed to Fix the Refresh Issue

1. **Cookie Security**: Now uses `cookieSecure: true` in production
2. **Cookie SameSite**: Changed to `"none"` for cross-subdomain cookies
3. **Cookie Domain**: Set to `.bobosoftware.co.za` to work across subdomains
4. **Environment Detection**: Auto-detects production vs development
5. **CORS Configuration**: Now accepts both frontend URLs
6. **WebSocket CORS**: Also updated to match frontend URL
7. **Logging Added**: Helps debug configuration issues

All these changes are **environment-aware** - they work locally AND in production!

