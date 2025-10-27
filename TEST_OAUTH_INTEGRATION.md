# Testing OAuth Integration

## ✅ Pre-Test Checklist

- [x] OAuth credentials added to `.env`
- [ ] Redirect URLs configured in Google Cloud Console
- [ ] Callback URL configured in GitHub Developer Settings
- [ ] SuperTokens running (`docker compose up -d`)
- [ ] Backend running (`npm run dev:backend`)
- [ ] Frontend running (`npm run dev:frontend`)

## OAuth App Configuration

### Google OAuth ✅
- Client ID: `1077615239855-rq69lu20k07i5pnmnog01u7gghe3o6j1.apps.googleusercontent.com`
- Client Secret: `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`

**Required Settings:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your OAuth client
3. Add to **Authorized JavaScript origins**:
   - `http://localhost:4005`
   - `http://localhost:3005`
4. Add to **Authorized redirect URIs**:
   - `http://localhost:4005/auth/callback/google`
5. Click **Save**

### GitHub OAuth ✅
- Client ID: `Ov23liNJfKVfMuJslYO7`
- Client Secret: `3459aa7b20582bcee7660f2c3d473aab47e88240`

**Required Settings:**
1. Go to https://github.com/settings/developers
2. Click on your OAuth app
3. Set **Authorization callback URL**:
   - `http://localhost:4005/auth/callback/github`
4. Click **Update application**

## Testing Steps

### 1. Start Services

```bash
# Terminal 1: SuperTokens
docker compose up -d

# Terminal 2: Backend
cd /media/bobo/samsung_drive/Development/Skaftin
npm run dev:backend

# Terminal 3: Frontend
cd src/frontend
npm run dev
```

### 2. Test Google OAuth

1. Open browser to `http://localhost:3005`
2. Navigate to login page
3. Click **Google** button
4. Expected:
   - Redirects to Google login page
   - Shows "Sign in with Google"
   - After login, redirects back to your app
   - Should be logged in and redirected to projects page

### 3. Test GitHub OAuth

1. On login page, click **GitHub** button
2. Expected:
   - Redirects to GitHub login page
   - Shows "Authorize Skaftin"
   - After authorization, redirects back to your app
   - Should be logged in and redirected to projects page

### 4. Test Email/Password (Verify Existing Works)

1. Try logging in with email/password
2. Should still work as before

## Expected Behavior

### Successful OAuth Flow
1. Click OAuth button
2. Redirect to provider's login page
3. Authorize the app
4. Loading spinner appears ("Completing sign in...")
5. Redirect to projects page
6. User is logged in

### Error Handling
1. If OAuth fails, error message appears
2. Redirects to login page after 3 seconds
3. User can try again

## Troubleshooting

### "redirect_uri_mismatch"
**Problem:** Google/GitHub doesn't recognize the redirect URL

**Solution:**
1. Double-check redirect URLs in OAuth app settings
2. Make sure they match exactly (including http vs https)
3. Save the changes
4. Wait 1-2 minutes for changes to propagate

### "invalid_client"
**Problem:** Client ID or Secret is incorrect

**Solution:**
1. Verify credentials in `.env`
2. Check for extra spaces or quotes
3. Make sure you're using the correct credentials for localhost (not production)

### OAuth Button Not Working
**Problem:** Clicking button doesn't redirect

**Solution:**
1. Check browser console for errors
2. Verify backend is running on port 4005
3. Check SuperTokens is running
4. Make sure frontend can reach backend

### Session Not Created
**Problem:** Redirects back but not logged in

**Solution:**
1. Check browser cookies (should see SuperTokens session cookies)
2. Verify SuperTokens is running
3. Check backend logs for errors
4. Make sure CORS is configured correctly

## Debug Commands

```bash
# Check SuperTokens is running
docker compose ps

# View SuperTokens logs
docker compose logs -f supertokens

# Check backend logs
# Look for OAuth-related errors

# Check if ports are in use
lsof -i :4005  # Backend
lsof -i :3005  # Frontend
lsof -i :3567  # SuperTokens
```

## Success Indicators

✅ OAuth buttons appear on login page
✅ Clicking button redirects to provider
✅ Authorization page appears
✅ Redirects back to your app
✅ Loading spinner shows
✅ Redirects to projects page
✅ User is logged in (can access protected routes)
✅ Session persists on page refresh

## Next Steps

Once OAuth is working:
- [ ] Test user profile data (name, email, avatar)
- [ ] Test account creation (new users)
- [ ] Test account linking (existing users)
- [ ] Test logout with OAuth
- [ ] Test OAuth on mobile device

---

**Ready to test!** 🚀

Start the services and try clicking the OAuth buttons on the login page.
