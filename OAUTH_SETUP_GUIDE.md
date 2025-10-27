# OAuth Setup Guide for Google & GitHub

This guide will help you set up Google and GitHub OAuth applications for Skaftin.

## Prerequisites

- Google account
- GitHub account
- Access to your application's environment variables

## 1. Google OAuth Setup

### Step 1: Create Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth client ID"
6. Choose "Web application"
7. Configure the OAuth consent screen if prompted

### Step 2: Configure OAuth Client

**Authorized JavaScript origins:**
```
http://localhost:3005
http://localhost:4005
```

**Authorized redirect URIs:**
```
http://localhost:4005/auth/callback/google
```

### Step 3: Get Credentials

After creating the OAuth client, you'll get:
- Client ID
- Client Secret

## 2. GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:

**Application name:** `Skaftin Development`
**Homepage URL:** `http://localhost:3005`
**Authorization callback URL:** `http://localhost:4005/auth/callback/github`

### Step 2: Get Credentials

After creating the OAuth app, you'll get:
- Client ID
- Client Secret (click "Generate a new client secret")

## 3. Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

## 4. Production Setup

For production, update the redirect URIs:

### Google OAuth
- **Authorized JavaScript origins:** `https://yourdomain.com`
- **Authorized redirect URIs:** `https://yourdomain.com/auth/callback/google`

### GitHub OAuth
- **Authorization callback URL:** `https://yourdomain.com/auth/callback/github`

## 5. Testing

1. Start your backend: `npm run dev:backend`
2. Start your frontend: `npm run dev:frontend`
3. Go to `http://localhost:3005`
4. You should see Google and GitHub login buttons
5. Test both login flows

## 6. Troubleshooting

### Common Issues

**"redirect_uri_mismatch"**
- Check that your redirect URIs match exactly
- Make sure there are no trailing slashes
- Verify the protocol (http vs https)

**"invalid_client"**
- Check that your client ID and secret are correct
- Make sure there are no extra spaces in your .env file

**"access_denied"**
- User cancelled the OAuth flow
- Check OAuth consent screen configuration

### Debug Steps

1. Check browser console for errors
2. Check backend logs for OAuth errors
3. Verify environment variables are loaded:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.GOOGLE_CLIENT_ID)"
   ```

## 7. Security Notes

- Never commit OAuth secrets to version control
- Use different OAuth apps for development and production
- Regularly rotate your OAuth secrets
- Monitor OAuth usage in your provider dashboards

## 8. Additional Providers

To add more OAuth providers (Discord, Microsoft, etc.), follow the same pattern:

1. Create OAuth app with the provider
2. Add credentials to environment config
3. Add provider to SuperTokens config
4. Update redirect URIs

## Next Steps

Once OAuth is working:

1. **Customize UI** - Style the OAuth buttons to match your design
2. **Add user info** - Access user profile data from OAuth providers
3. **Account linking** - Allow users to link multiple OAuth accounts
4. **Email verification** - Verify emails from OAuth providers

## Support

If you encounter issues:

1. Check SuperTokens logs: `docker compose logs supertokens`
2. Check backend logs for OAuth errors
3. Verify OAuth app configuration in provider dashboards
4. Test with a simple OAuth flow first

---

**OAuth setup completed!** 🚀

Your users can now sign in with Google and GitHub accounts.
