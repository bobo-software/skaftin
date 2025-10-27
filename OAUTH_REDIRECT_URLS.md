# OAuth Redirect URLs for Localhost

## Quick Reference

### Google OAuth
- **Redirect URI**: `http://localhost:4005/auth/callback/google`
- **Authorized JavaScript Origins**: 
  - `http://localhost:4005`
  - `http://localhost:3005`

### GitHub OAuth
- **Authorization Callback URL**: `http://localhost:4005/auth/callback/github`

## Setup Instructions

### Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Select your project → APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Add to **Authorized JavaScript origins**:
   ```
   http://localhost:4005
   http://localhost:3005
   ```
5. Add to **Authorized redirect URIs**:
   ```
   http://localhost:4005/auth/callback/google
   ```
6. Click **Save**

### GitHub Developer Settings
1. Go to https://github.com/settings/developers
2. Click your OAuth App
3. Update **Authorization callback URL**:
   ```
   http://localhost:4005/auth/callback/github
   ```
4. Click **Update application**

## URL Breakdown

```
http://localhost:4005/auth/callback/google
│           │         │        │       │
│           │         │        │       └─ Provider (google/github)
│           │         │        └────────── SuperTokens endpoint
│           │         └───────────────────── Auth path
│           └────────────────────────────── Backend port
└────────────────────────────────────────── Protocol & host
```

## Why Port 4005?

- **4005** = Backend port (SuperTokens handles OAuth)
- **3005** = Frontend port (where users see the UI)

SuperTokens processes the OAuth callback on the backend, then the frontend receives the authentication state.

## Production URLs

When deploying to production, use:
```
https://yourdomain.com/auth/callback/google
https://yourdomain.com/auth/callback/github
```

## Testing

After setting up:
1. Click Google/GitHub button on login page
2. Authorize the app
3. Should redirect back to your app
4. Should be logged in automatically

## Troubleshooting

**"redirect_uri_mismatch"**
- Check URLs match exactly
- No trailing slashes
- Use exact same protocol (http vs https)

**"invalid_client"**
- Verify client ID and secret
- Check they're for the right environment
