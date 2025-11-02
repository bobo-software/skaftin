# 🐛 Debug Logs Guide - Production Troubleshooting

## Overview

Comprehensive logging has been added throughout the application to help debug production issues, especially cookie/session handling and CORS problems.

---

## 📍 Where to Find Logs

### **Backend Logs (Coolify)**
1. Go to your Coolify dashboard
2. Select your **Backend Service**
3. Click **Logs** tab
4. Logs will stream in real-time

### **Frontend Logs (Browser)**
1. Open your live site: `https://skaftin.bobosoftware.co.za`
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Logs will appear as you interact with the app

---

## 🔍 Backend Logging Structure

All backend logs use emoji prefixes for easy scanning:

### **Startup Logs**

```
🔧 SuperTokens Cookie Configuration: {
  environment: 'production',
  cookieSameSite: 'none',
  cookieSecure: true,
  cookieDomain: '.bobosoftware.co.za',
  apiDomain: 'https://skaftinplatform.bobosoftware.co.za',
  websiteDomain: 'https://skaftin.bobosoftware.co.za'
}
```

**What to check:**
- ✅ `environment` should be `'production'`
- ✅ `cookieSecure` should be `true`
- ✅ `cookieSameSite` should be `'none'`
- ✅ `cookieDomain` should be `'.bobosoftware.co.za'`

```
🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
🔌 WebSocket CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]
```

**What to check:**
- ✅ Should include your frontend URL
- ✅ Should use `https://` (not `http://`)

---

### **Request Logs**

Every incoming request is logged:

```
📨 [2025-11-02T10:30:45.123Z] POST /api/auth/login
   Origin: https://skaftin.bobosoftware.co.za
   Cookies: Present
   SuperTokens Cookies: {
     sAccessToken: ✓,
     sRefreshToken: ✓,
     sFrontToken: ✓
   }
```

**What to check:**
- ✅ `Origin` matches your frontend domain
- ✅ `Cookies: Present` (at least after login)
- ✅ SuperTokens cookies show checkmarks after login

---

### **Authentication Logs**

#### **Login Flow**

```
🔑 [AUTH] Login request received: {
  email: 'user@example.com',
  hasPassword: true,
  origin: 'https://skaftin.bobosoftware.co.za',
  userAgent: 'Mozilla/5.0...',
  cookies: 'None'  // First time, no cookies yet
}
🔐 [AUTH] Calling SuperTokens signIn...
🔐 [AUTH] SuperTokens signIn response: OK
🍪 [AUTH] Creating session for user: abc-123-def
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: [
  'sAccessToken=...; Path=/; HttpOnly; Secure; SameSite=None; Domain=.bobosoftware.co.za',
  'sRefreshToken=...; Path=/; HttpOnly; Secure; SameSite=None; Domain=.bobosoftware.co.za'
]
```

**What to check:**
- ✅ `origin` matches your frontend
- ✅ SignIn response is `OK`
- ✅ Session created successfully
- ✅ Set-Cookie headers include:
  - `Secure` flag
  - `SameSite=None`
  - `Domain=.bobosoftware.co.za`
  - `HttpOnly` flag

#### **Verify/Refresh Flow**

```
🔍 [AUTH] Verify request received: {
  origin: 'https://skaftin.bobosoftware.co.za',
  cookies: 'Present',
  hasCookie: 'Yes'  // Should be 'Yes' after login
}
✅ [AUTH] Session verified for user: abc-123-def
📦 [AUTH] Session data: {
  email: 'user@example.com',
  name: 'User',
  projectIds: [ 1, 2, 3 ],
  role: 'user'
}
```

**What to check:**
- ✅ `cookies: 'Present'`
- ✅ `hasCookie: 'Yes'`
- ✅ Session verified successfully
- ✅ projectIds populated

#### **Common Errors**

```
❌ [AUTH] Login failed: Wrong credentials
❌ [AUTH] Verify failed: Session not found
❌ [AUTH] Session not found in request
```

---

### **Middleware Logs**

```
🔐 [MIDDLEWARE] Attaching user info...
👤 [MIDDLEWARE] User ID: abc-123-def
📂 [MIDDLEWARE] User projects: [ 1, 2, 3 ]
✅ [MIDDLEWARE] User info attached successfully

🔒 [MIDDLEWARE] Verifying project access...
🎯 [MIDDLEWARE] Checking access to project: 1
✅ [MIDDLEWARE] Project access granted
```

**What to check:**
- ✅ User ID retrieved from session
- ✅ Projects loaded from database
- ✅ Access granted to requested project

---

## 🌐 Frontend Logging Structure

### **Request Logs**

```javascript
🌐 [REQUEST] POST https://skaftinplatform.bobosoftware.co.za/api/auth/login {
  hasToken: false,
  tokenType: 'SuperTokens',
  credentials: 'include'
}
📥 [RESPONSE] POST /api/auth/login: {
  status: 200,
  ok: true,
  headers: { set-cookie: '...' }
}
📦 [DATA]: {
  success: true,
  message: 'Login successful',
  data: { user: {...}, token: '...' }
}
```

**What to check:**
- ✅ URL is correct (`https://`, correct domain)
- ✅ `credentials: 'include'` is set
- ✅ Response status is `200` or expected code
- ✅ `ok: true` for successful requests

---

## 🔥 Troubleshooting Scenarios

### **Scenario 1: Cookies Not Being Set**

**Backend logs show:**
```
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: undefined
```

**Problem:** Cookies not being set in response  
**Solution:** Check environment variables:
- `NODE_ENV=production`
- `COOKIE_DOMAIN=.bobosoftware.co.za`

---

### **Scenario 2: Cookies Not Sent on Subsequent Requests**

**Backend logs show:**
```
📨 [2025-11-02T10:30:45.123Z] POST /api/auth/verify
   Cookies: None  ❌ Should be "Present"
   SuperTokens Cookies: (not shown because no cookies)
```

**Frontend logs show:**
```
🌐 [REQUEST] POST https://skaftinplatform.bobosoftware.co.za/api/auth/verify
```

**Problem:** Cookies stored but not sent  
**Check in Browser:**
1. Open DevTools → Application tab
2. Click **Cookies** → `.bobosoftware.co.za`
3. Look for `sAccessToken`, `sRefreshToken`, `sFrontToken`

**If cookies exist but not sent:**
- Check cookie `Domain` field = `.bobosoftware.co.za`
- Check cookie `Secure` field = `Yes`
- Check cookie `SameSite` field = `None`

**If cookies don't exist:**
- Check backend logs for Set-Cookie headers
- Verify CORS origin matches exactly

---

### **Scenario 3: CORS Errors**

**Browser console shows:**
```
Access to fetch at 'https://skaftinplatform.bobosoftware.co.za/api/auth/login' 
from origin 'https://skaftin.bobosoftware.co.za' has been blocked by CORS policy
```

**Backend logs should show:**
```
🌐 CORS Allowed Origins: [ 'https://skaftin.bobosoftware.co.za' ]  ✅
```

**If origin not in list:**
- Check `SUPERTOKENS_WEBSITE_DOMAIN` env var
- Check `FRONTEND_URL` env var
- Redeploy backend after setting

---

### **Scenario 4: Session Refresh Not Working**

**Backend logs:**
```
🔄 [AUTH] Refresh request received: {
  cookies: 'Present',
  hasRefreshToken: 'No'  ❌ Should be 'Yes'
}
```

**Problem:** Refresh token not present  
**Solution:** 
- Check if `sRefreshToken` cookie exists in browser
- Check cookie domain and expiry
- May need to login again

---

## 📊 Complete Login Flow - Expected Logs

### **Step 1: User Clicks Login**

**Frontend:**
```
🌐 [POST] https://skaftinplatform.bobosoftware.co.za/api/auth/login {
  hasToken: false,
  credentials: 'include'
}
```

**Backend:**
```
📨 [2025-11-02T10:30:45.123Z] POST /api/auth/login
   Origin: https://skaftin.bobosoftware.co.za
   Cookies: None
🔑 [AUTH] Login request received
🔐 [AUTH] SuperTokens signIn response: OK
🍪 [AUTH] Creating session
✅ [AUTH] Session created successfully
🍪 [AUTH] Response headers Set-Cookie: [cookies here]
```

**Frontend:**
```
📥 [RESPONSE]: { status: 200, ok: true }
📦 [DATA]: { success: true, user: {...} }
```

---

### **Step 2: User Navigates to Dashboard**

**Frontend:**
```
🌐 [GET] https://skaftinplatform.bobosoftware.co.za/api/projects {
  hasToken: true,
  tokenType: 'SuperTokens',
  credentials: 'include'
}
```

**Backend:**
```
📨 [2025-11-02T10:30:46.456Z] GET /api/projects
   Origin: https://skaftin.bobosoftware.co.za
   Cookies: Present
   SuperTokens Cookies: {
     sAccessToken: ✓,
     sRefreshToken: ✓,
     sFrontToken: ✓
   }
🔐 [MIDDLEWARE] Attaching user info...
👤 [MIDDLEWARE] User ID: abc-123-def
📂 [MIDDLEWARE] User projects: [ 1, 2, 3 ]
✅ [MIDDLEWARE] User info attached successfully
```

---

## 🎯 Quick Checklist

When debugging production, check these logs in order:

### **1. Backend Startup**
- [ ] SuperTokens config shows `production` environment
- [ ] `cookieSecure: true`
- [ ] `cookieSameSite: 'none'`
- [ ] `cookieDomain: '.bobosoftware.co.za'`
- [ ] CORS origins include frontend URL

### **2. Login Request**
- [ ] Request received with correct origin
- [ ] SuperTokens signIn returns `OK`
- [ ] Session created successfully
- [ ] Set-Cookie headers include all flags

### **3. Browser Cookies**
- [ ] Cookies visible in Application tab
- [ ] Domain = `.bobosoftware.co.za`
- [ ] Secure = Yes
- [ ] SameSite = None
- [ ] Not expired

### **4. Subsequent Requests**
- [ ] Cookies sent with request (logs show "Present")
- [ ] SuperTokens cookies all present (✓✓✓)
- [ ] User info attached successfully
- [ ] Project access granted

---

## 💡 Tips

1. **Use incognito mode** when testing to avoid cached cookies
2. **Check both backend AND frontend logs** together
3. **Look for the emoji** - they make scanning easier:
   - ✅ = Success
   - ❌ = Error
   - 🍪 = Cookie-related
   - 🔐 = Auth-related
   - 🌐 = CORS/Network
4. **Copy the full log output** when asking for help
5. **Check timestamps** to correlate frontend/backend logs

---

## 🆘 Still Stuck?

If logs don't show what you expect:

1. **Copy the complete log section** (backend startup + login flow)
2. **Copy browser console logs** (the network request logs)
3. **Screenshot browser Application → Cookies** tab
4. **Check environment variables** in Coolify are set correctly
5. Share all of the above for debugging

---

Good luck! The logs should tell you exactly what's happening. 🎉

