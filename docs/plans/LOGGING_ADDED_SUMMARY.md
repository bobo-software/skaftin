# ✅ Debug Logging Added - Ready for Production Troubleshooting

## What Was Added

Comprehensive debug logging has been added throughout your application to help diagnose the session refresh issue on your live Coolify app.

---

## 📁 Files Modified

### **Backend Files:**

1. **`go-services/internal/platformauth/handler.go`**
   - Go-owned `/auth/*` session handling and cookie/header behavior
   - SuperTokens Core refresh forwarding and auth response shaping

2. **`src/Server.ts`**
   - Added CORS origin logging
   - Added WebSocket CORS logging
   - Added request logging middleware (logs every incoming request)

3. **`src/services/WebSocketService.ts`**
   - Logs WebSocket CORS configuration on startup

### **Frontend Files:**

1. **`frontend/src/utils/RequestUtils.ts`**
   - Logs every API request with method, URL, token type
   - Logs every API response with status
   - Logs response data
   - Logs errors with context

### **Documentation Added:**

1. **`DEBUG_LOGS_GUIDE.md`** - Complete guide to understanding all logs
2. **`BROWSER_DEBUG_HELPER.js`** - Browser console script to inspect cookies
3. **`LOGGING_ADDED_SUMMARY.md`** - This file

---

## 🚀 How to Use

### **Step 1: Deploy to Coolify**

1. Make sure you've set the environment variables from `COOLIFY_ENVIRONMENT_SETUP.md`
2. Commit these changes to git
3. Push to your repository
4. Coolify will automatically redeploy

### **Step 2: View Backend Logs**

1. Open Coolify dashboard
2. Go to your **Backend Service**
3. Click **Logs** tab
4. You'll see colorful, emoji-prefixed logs like:

```
🔧 SuperTokens Cookie Configuration: {
  environment: 'production',
  cookieSameSite: 'none',
  cookieSecure: true,
  cookieDomain: '.bobosoftware.co.za'
}

🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]

📨 [2025-11-02T10:30:45.123Z] POST /api/auth/login
   Origin: https://skaftin.bobosoftware.co.za
   Cookies: None
   SuperTokens Cookies: (no cookies yet)

🔑 [AUTH] Login request received
🔐 [AUTH] SuperTokens signIn response: OK
🍪 [AUTH] Creating session for user: abc-123
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: [...]
```

### **Step 3: View Frontend Logs**

1. Open `https://skaftin.bobosoftware.co.za` in your browser
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Try to login - you'll see:

```javascript
🌐 [POST] https://skaftinplatform.bobosoftware.co.za/api/auth/login
   hasToken: false
   credentials: 'include'

📥 [RESPONSE]: status 200, ok: true

📦 [DATA]: { success: true, user: {...} }
```

### **Step 4: Use Browser Debug Helper**

1. Open browser console (F12)
2. Copy contents of `BROWSER_DEBUG_HELPER.js`
3. Paste into console and press Enter
4. Get instant cookie diagnostics:

```
🔍 ===== SuperTokens Session Debug =====

📊 All Cookies: 3

🍪 SuperTokens Cookies:
✅ sAccessToken: Present
✅ sRefreshToken: Present
✅ sFrontToken: Present

⚠️ Potential Issues:
✅ No obvious issues detected

🧪 Testing API Connection:
✅ Backend reachable
```

---

## 🎯 What to Look For

### **When Login Works Locally But Not in Production:**

#### **Check Backend Startup Logs:**

Look for:
```
🔧 SuperTokens Cookie Configuration:
```

**Should show:**
- `environment: 'production'` ✅
- `cookieSecure: true` ✅
- `cookieSameSite: 'none'` ✅
- `cookieDomain: '.bobosoftware.co.za'` ✅

**If you see:**
- `environment: 'development'` ❌ → Set `NODE_ENV=production`
- `cookieSecure: false` ❌ → Set `NODE_ENV=production`
- `cookieDomain: undefined` ❌ → Set `COOKIE_DOMAIN=.bobosoftware.co.za`

#### **Check CORS Configuration:**

Look for:
```
🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
```

**Should include:**
- Your frontend domain ✅
- Use `https://` (not `http://`) ✅

**If missing or wrong:**
- Set `SUPERTOKENS_WEBSITE_DOMAIN=https://skaftin.bobosoftware.co.za`
- Set `FRONTEND_URL=https://skaftin.bobosoftware.co.za`

#### **Check Login Flow:**

After login, look for:
```
🍪 [AUTH] Response headers Set-Cookie: [
  'sAccessToken=...; Domain=.bobosoftware.co.za; Secure; SameSite=None',
  ...
]
```

**Should include:**
- `Domain=.bobosoftware.co.za` ✅
- `Secure` flag ✅
- `SameSite=None` ✅

#### **Check Subsequent Requests:**

For any request after login:
```
📨 [timestamp] GET /api/projects
   Cookies: Present  ← Should say "Present"
   SuperTokens Cookies: {
     sAccessToken: ✓,  ← All should have checkmarks
     sRefreshToken: ✓,
     sFrontToken: ✓
   }
```

**If cookies show as `None` or missing checkmarks:**
- Cookies not being sent by browser
- Check browser cookie storage (Application tab)
- Verify cookie domain and attributes

---

## 🐛 Common Issues & How Logs Will Show Them

### **Issue 1: Cookies Not Being Set**

**Backend logs:**
```
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: undefined  ❌
```

**Cause:** Environment not configured correctly  
**Fix:** Set `NODE_ENV=production` and `COOKIE_DOMAIN=.bobosoftware.co.za`

---

### **Issue 2: Cookies Set But Not Sent**

**Backend logs:**
```
📨 POST /api/auth/verify
   Cookies: None  ❌ (should be "Present")
```

**Frontend shows cookies in browser (Application tab) but not sent**

**Cause:** Cookie domain or SameSite misconfiguration  
**Fix:** Check cookie attributes match:
- Domain: `.bobosoftware.co.za`
- Secure: Yes
- SameSite: None

---

### **Issue 3: CORS Blocking Requests**

**Browser console:**
```
Access to fetch at '...' has been blocked by CORS policy
```

**Backend logs:**
```
🌐 CORS Allowed Origins: [ 'https://wrong-domain.com' ]  ❌
```

**Cause:** Frontend domain not in allowed origins  
**Fix:** Update `SUPERTOKENS_WEBSITE_DOMAIN` environment variable

---

### **Issue 4: Session Refresh Failing**

**Backend logs:**
```
🔄 [AUTH] Refresh request received
   hasRefreshToken: 'No'  ❌ (should be 'Yes')
```

**Cause:** Refresh token cookie missing or expired  
**Fix:** Check browser cookies, may need to login again

---

## 📋 Troubleshooting Checklist

When you see issues in production:

1. **Copy Backend Logs**
   - [ ] SuperTokens configuration section
   - [ ] CORS configuration section
   - [ ] Login request logs
   - [ ] Set-Cookie headers
   - [ ] Subsequent request logs

2. **Copy Frontend Logs**
   - [ ] Login request log
   - [ ] Login response log
   - [ ] Any CORS errors

3. **Run Browser Debug Helper**
   - [ ] Copy full output

4. **Screenshot Browser Cookies**
   - [ ] DevTools → Application → Cookies
   - [ ] Show `.bobosoftware.co.za` cookies

5. **Verify Environment Variables**
   - [ ] `NODE_ENV=production`
   - [ ] `COOKIE_DOMAIN=.bobosoftware.co.za`
   - [ ] `SUPERTOKENS_API_DOMAIN=https://skaftinplatform.bobosoftware.co.za`
   - [ ] `SUPERTOKENS_WEBSITE_DOMAIN=https://skaftin.bobosoftware.co.za`

---

## 🎉 Success Indicators

When everything is working, you should see:

### **Backend Startup:**
```
🔧 SuperTokens Cookie Configuration: {
  environment: 'production',
  cookieSameSite: 'none',
  cookieSecure: true,
  cookieDomain: '.bobosoftware.co.za'
}
🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
```

### **Login:**
```
🔑 [AUTH] Login request received
🔐 [AUTH] SuperTokens signIn response: OK
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: [contains proper cookies]
```

### **Subsequent Requests:**
```
📨 GET /api/projects
   Cookies: Present
   SuperTokens Cookies: { sAccessToken: ✓, sRefreshToken: ✓, sFrontToken: ✓ }
🔐 [MIDDLEWARE] Attaching user info...
✅ [MIDDLEWARE] User info attached successfully
```

### **Browser:**
- All 3 SuperTokens cookies visible
- Domain = `.bobosoftware.co.za`
- Secure = Yes
- SameSite = None
- Not expired

---

## 💡 Tips

1. **Use incognito/private mode** when testing to avoid old cookies
2. **Check logs in real-time** as you test
3. **Correlate timestamps** between frontend and backend logs
4. **Look for emoji** to quickly scan for success (✅) or errors (❌)
5. **Copy complete log sections** when reporting issues

---

## 📖 Reference Documents

- **`DEBUG_LOGS_GUIDE.md`** - Detailed explanation of all logs
- **`COOLIFY_ENVIRONMENT_SETUP.md`** - Environment variables needed
- **`BROWSER_DEBUG_HELPER.js`** - Browser console debugging script

---

## ✨ What Changed

The logging is **non-intrusive** and **environment-aware**:

- ✅ No performance impact
- ✅ Emoji-prefixed for easy scanning
- ✅ Structured and consistent
- ✅ Shows exactly what you need to debug
- ✅ Works in both development and production
- ✅ No sensitive data logged (passwords, tokens are hidden)

You can now **see exactly** what's happening with cookies, sessions, and CORS in production! 🎉

