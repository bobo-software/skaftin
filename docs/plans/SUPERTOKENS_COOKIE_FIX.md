# 🍪 SuperTokens Cookie Domain Error Fix

## Error Message

```
Error: The request contains multiple session cookies. 
This may happen if you've changed the 'cookieDomain' value in your configuration. 
To clear tokens from the previous domain, set 'olderCookieDomain' in your config.
```

---

## What Causes This?

This error occurs when:
1. You've changed the cookie domain configuration in SuperTokens
2. Your browser has session cookies from both the old and new domains
3. SuperTokens doesn't know which cookies to use

Common scenarios:
- Switching from `localhost` to a custom domain
- Changing from undefined cookie domain to specific domain
- Development environment changes

---

## Quick Fix: Clear Browser Cookies ✅

The fastest solution is to manually clear cookies:

### Chrome / Edge / Brave

1. **Open DevTools** - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Opt+I` (Mac)
2. **Go to Application tab** (might be under >> if hidden)
3. **Expand Cookies** in the left sidebar
4. **Click on your domain** (`http://localhost:3005`)
5. **Delete these cookies:**
   - `sAccessToken`
   - `sRefreshToken`
   - `sFrontToken`
   - Or just select all and delete

6. **Refresh the page** and login again

### Firefox

1. **Open DevTools** - Press `F12`
2. **Go to Storage tab**
3. **Expand Cookies**
4. **Click on** `http://localhost:3005`
5. **Right-click** → **Delete All**
6. **Refresh and login again**

### Safari

1. **Open Web Inspector** - `Cmd+Opt+I`
2. **Go to Storage tab**
3. **Select Cookies**
4. **Delete SuperTokens cookies**
5. **Refresh and login**

---

## Configuration Fix: Handle Old Cookies Automatically

If you want SuperTokens to automatically clean up old cookies, configure the `OLDER_COOKIE_DOMAIN` environment variable.

### Step 1: Add to `.env` file

```bash
# Older Cookie Domain (for cleaning up cookies after domain changes)
# Uncomment temporarily to clean up old cookies
OLDER_COOKIE_DOMAIN=localhost
```

### Step 2: Restart Backend

```bash
# Stop the server
# Ctrl+C in your terminal

# Start it again
npm run dev
```

### Step 3: Login Again

Visit your application and login. SuperTokens will automatically:
1. Detect cookies from the old domain
2. Clear them
3. Create new cookies with the current domain

### Step 4: Remove the Configuration (Optional)

After the cookies are cleaned up, you can comment out or remove `OLDER_COOKIE_DOMAIN`:

```bash
# OLDER_COOKIE_DOMAIN=localhost
```

This prevents SuperTokens from continuously checking for old cookies.

---

## Understanding Cookie Domains

### Local Development (Current Setup)

```bash
# .env
COOKIE_DOMAIN=  # Empty (defaults to localhost)
```

**Cookies created:** `localhost:3005`
- ✅ Works for: `http://localhost:3005`
- ❌ Won't work for: `http://127.0.0.1:3005` (different domain)

### Production Setup

```bash
# .env (Production)
COOKIE_DOMAIN=.bobosoftware.co.za
```

**Cookies created:** `.bobosoftware.co.za`
- ✅ Works for: `https://skaftin.bobosoftware.co.za` (frontend)
- ✅ Works for: `https://skaftinplatform.bobosoftware.co.za` (backend)
- ✅ Shared across subdomains

---

## Why SuperTokens Uses Multiple Cookies?

SuperTokens creates 3 cookies for security:

1. **`sAccessToken`** - Short-lived access token (1 hour default)
2. **`sRefreshToken`** - Long-lived refresh token (100 days default)
3. **`sFrontToken`** - Frontend helper token

When the domain changes, old cookies remain in the browser, causing conflicts.

---

## Testing After Fix

### 1. Clear All Cookies
```bash
# In DevTools Console
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});
```

### 2. Login Again
- Navigate to login page
- Enter credentials
- Should work without errors

### 3. Check Session Refresh
- Wait for access token to expire (or manually delete `sAccessToken` cookie)
- Make an authenticated request
- Should automatically refresh without errors

---

## Troubleshooting

### Error Still Occurs After Clearing Cookies

**Check:**
1. Make sure you cleared ALL cookies for the domain
2. Try incognito/private browsing mode
3. Check if cookies are being set from multiple domains

**Solution:**
```bash
# Add to .env temporarily
OLDER_COOKIE_DOMAIN=localhost

# Restart backend
# Login again
# Remove OLDER_COOKIE_DOMAIN after successful login
```

---

### Cookies Not Being Set

**Check:**
1. Cookie settings in browser (allow cookies)
2. CORS configuration
3. Backend and frontend on same domain (or CORS properly configured)

**For cross-domain setup:**
```bash
# .env
COOKIE_SAME_SITE=none
COOKIE_SECURE=true  # Requires HTTPS
```

---

### Session Expires Too Quickly

**Configure token lifetimes in SuperTokens Core:**

```bash
# Add to SuperTokens Core environment
ACCESS_TOKEN_VALIDITY_SECONDS=3600       # 1 hour
REFRESH_TOKEN_VALIDITY_SECONDS=8640000   # 100 days
```

---

## Prevention

### Best Practices

1. **Consistent Cookie Domain**
   - Don't change `COOKIE_DOMAIN` in development
   - Use `.env` files for different environments

2. **Document Changes**
   - If you change cookie domain, document it
   - Inform team members to clear cookies

3. **Environment Separation**
   - Use different databases for dev/staging/prod
   - Different cookie domains won't conflict

4. **Use Incognito for Testing**
   - No cookie conflicts
   - Fresh session every time

---

## Related Configuration Files

### Platform Auth Handler: `go-services/internal/platformauth/handler.go`

```typescript
const cookieSettings = {
  cookieSameSite: isProduction ? "none" as const : "lax" as const,
  cookieSecure: isProduction,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  olderCookieDomain: process.env.OLDER_COOKIE_DOMAIN || undefined, // 👈 Cleanup config
};
```

### Environment Variables: `.env`

```bash
# Cookie settings
COOKIE_DOMAIN=              # Empty for localhost
OLDER_COOKIE_DOMAIN=        # Set temporarily for cleanup
```

---

## Summary

**Quick Fix:** Clear browser cookies manually ✅  
**Auto Fix:** Set `OLDER_COOKIE_DOMAIN=localhost` temporarily  
**Prevention:** Don't change cookie domain frequently  

**Most Common Solution:** Just clear your browser cookies! 🍪

---

## Additional Resources

- [SuperTokens Cookie Documentation](https://supertokens.com/docs/session/common-customizations/sessions/cookie-domain)
- [Session Management Guide](https://supertokens.com/docs/session/introduction)
- [CORS Configuration](https://supertokens.com/docs/session/common-customizations/sessions/cors)

---

**Last Updated:** December 3, 2025  
**Issue:** Multiple session cookies error  
**Status:** ✅ Fixed with cookie cleanup

