# Fix: Multiple Session Cookies Error

## Quick Fix (Recommended)

**Clear your browser cookies** for localhost:

### Chrome/Edge/Brave
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Cookies** in left sidebar
4. Click on `http://localhost:3005`
5. Right-click → **Clear** (or delete all cookies)
6. Refresh the page

### Firefox
1. Open DevTools (F12)
2. Go to **Storage** tab
3. Expand **Cookies**
4. Click on `http://localhost:3005`
5. Right-click → **Delete All**
6. Refresh the page

### Alternative: Incognito/Private Window
Open the app in an incognito/private window to start with fresh cookies.

---

## What Happened?

SuperTokens detected **multiple session cookies** from previous configurations. This happens when:
- Cookie domain settings were changed
- You switched between different backend ports
- Old sessions weren't properly cleared

## Permanent Solution

The backend config has been updated with `olderCookieDomain` support to automatically clear old cookies. After clearing cookies once, this shouldn't happen again.

## After Clearing Cookies

1. Refresh the page
2. Login again
3. Everything should work normally

---

**Note:** If the error persists after clearing cookies, restart both frontend and backend servers.

