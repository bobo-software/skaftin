# Client SDK Authentication Update Summary

**Date:** November 14, 2025  
**Status:** ✅ Complete (Updated for SuperTokens Migration)

---

## 🎯 Overview

The Skaftin Client SDK authentication documentation has been updated to reflect the new simplified authentication architecture. The key improvement is that project context is now automatically extracted from API credentials, eliminating the need for explicit project IDs in most endpoints.

---

## 📋 What Changed

### 1. Simplified Auth Endpoints

**Before:**
```typescript
POST /app-api/auth/:projectId/auth/register
POST /app-api/auth/:projectId/auth/login
POST /app-api/auth/:projectId/auth/verify
```

**After:**
```typescript
POST /app-api/auth/auth/register
POST /app-api/auth/auth/login
POST /app-api/auth/auth/verify
```

**Why:** Project ID is now extracted from the API key/token in the request headers, simplifying the API surface.

### 2. Updated Header Format

**Before:**
```typescript
headers: {
  'X-API-Key': 'sk_your_key',
  'X-Project-ID': '1'  // Redundant!
}
```

**After:**
```typescript
headers: {
  'x-api-key': 'sk_your_key'  // Project auto-detected
}
```

**Why:** Lowercase headers are more standard, and explicit project IDs are no longer needed.

### 3. Clarified Two-Layer Authentication

The documentation now clearly separates:

**Layer 1: Platform Authentication** (`02-AUTHENTICATION.md`)
- Authenticates your client application with Skaftin
- Uses API Keys (`sk_...`) or Access Tokens (`sat_...`)
- Required for ALL requests
- Identifies which project you're accessing

**Layer 2: App User Authentication** (`07-APP-USER-AUTHENTICATION.md`)
- Authenticates your application's end users
- Uses **SuperTokens sessions** (migrated from JWT)
- Secure HTTP-only session management
- Automatic token refresh
- Built on top of platform authentication
- Optional - only needed if your app has users

### 4. Service Architecture Updates

The documentation now provides separate service examples:

**AppUserAuthService** - For end-user authentication
```typescript
- register(data)           // User signs up
- login(credentials)       // User logs in
- verify(accessToken)      // Verify SuperTokens session
- logout(accessToken)      // Log out and revoke session
- refreshToken()           // Refresh access token
- storeToken()             // Save access token
- getToken()               // Retrieve access token
- isLoggedIn()             // Check if logged in
- authenticatedFetch()     // Make requests with auto-refresh
```

**UserManagementService** - For admin user management
```typescript
- listUsers(filters)          // List all users
- getUser(userId)             // Get single user
- createUser(data)            // Create user (admin)
- updateUser(userId, updates) // Update user
- deleteUser(userId)          // Delete user
- assignRole(userId, roleId)  // Assign role
- removeRole(userId, roleId)  // Remove role
```

### 5. Enhanced Examples

Added comprehensive React component examples:
- ✅ Registration form with error handling
- ✅ Login form with loading states
- ✅ Protected routes with token verification
- ✅ Role-based UI rendering
- ✅ Token storage patterns
- ✅ Logout functionality

---

## 📚 Updated Documentation Files

### Modified Files

1. **`02-AUTHENTICATION.md`** ⭐
   - Added two-layer authentication explanation
   - Updated configuration examples (removed project ID)
   - Updated auth headers (lowercase, no project ID)
   - Added authentication quick reference
   - Clarified credential types

2. **`07-APP-USER-AUTHENTICATION.md`** ⭐
   - Updated all endpoint URLs (removed project ID)
   - Added comprehensive service examples
   - Added JWT token structure documentation
   - Enhanced session management section
   - Added token storage best practices
   - Updated all code examples
   - Added Quick Start Summary section

3. **`README.md`** ⭐
   - Added "What's New" section
   - Updated file descriptions
   - Highlighted key improvements

4. **`01-OVERVIEW.md`** ⭐
   - Updated authentication flow
   - Added note about auto-detection

### New Files

5. **`AUTHENTICATION_UPDATE_SUMMARY.md`** (this file)
   - Complete changelog
   - Migration guide
   - Quick reference

---

## 🔑 Key Concepts for Developers

### For Client Apps Using Skaftin

```typescript
// 1. Set up config (once)
const SKAFTIN_CONFIG = {
  apiUrl: process.env.REACT_APP_SKAFTIN_API_URL,
  apiKey: process.env.REACT_APP_SKAFTIN_API_KEY,
  // projectId is optional - auto-detected from apiKey
};

// 2. Include API key in all requests
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': SKAFTIN_CONFIG.apiKey
  };
}

// 3. For app user auth, use simplified endpoints
const response = await fetch('/app-api/auth/auth/login', {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify({ email, password })
});

// 4. Store and use SuperTokens access tokens for user sessions
const { session } = await response.json();
localStorage.setItem('app_user_access_token', session.accessToken);
```

### Understanding the Flow

```
Your Client App
    ↓
    ├─ Include x-api-key header (identifies project)
    ↓
    ├─ POST /app-api/auth/auth/register (user signs up)
    ↓
    ├─ Receive SuperTokens access token
    ↓
    ├─ Store access token
    ↓
    ├─ Include access token in Authorization header
    ↓
    └─ Automatically refresh token on 401 responses
```

---

## 🚀 Migration Guide

### If You're Starting Fresh

Follow the guides in order:
1. Read `02-AUTHENTICATION.md` - Set up platform credentials
2. Read `07-APP-USER-AUTHENTICATION.md` - Implement user auth
3. Use the service examples provided

### If You Have Existing Code

**Step 1: Update Auth Headers**
```typescript
// OLD
headers: {
  'X-API-Key': apiKey,
  'X-Project-ID': projectId
}

// NEW
headers: {
  'x-api-key': apiKey
}
```

**Step 2: Update Auth Endpoint URLs**
```typescript
// OLD
POST /app-api/auth/${projectId}/auth/login

// NEW
POST /app-api/auth/auth/login
```

**Step 3: Update Your Config**
```typescript
// Remove projectId requirement
export const SKAFTIN_CONFIG = {
  apiUrl: process.env.REACT_APP_SKAFTIN_API_URL,
  apiKey: process.env.REACT_APP_SKAFTIN_API_KEY,
  // projectId optional - only for multi-project apps
};
```

**Step 4: Update Service Methods**
```typescript
// OLD
class UserService {
  private basePath = `/app-api/auth/${projectId}`;
  // ...
}

// NEW - Split into two services
class AppUserAuthService {
  private basePath = '/app-api/auth/auth';  // No project ID!
  // register, login, verify, logout
}

class UserManagementService {
  private basePath = '/app-api/auth';  // Project ID auto-extracted from API key
  // listUsers, createUser, updateUser, etc (admin operations)
}
```

---

## ✅ Important Note

**Project ID is now automatically extracted from API keys**, so you no longer need to include it in URLs. This applies to:
- Database routes: `/app-api/database/tables/...` (not `/app-api/database/:projectId/tables/...`)
- Storage routes: `/app-api/storage/files` (not `/app-api/storage/:projectId/files`)
- Auth management routes: `/app-api/auth/users` (not `/app-api/auth/:projectId/users`)

All routes now automatically identify the project from your `x-api-key` or `x-access-token` header.

---

## 🔍 Quick Reference

### Platform Authentication

```typescript
// All requests need this
headers: {
  'x-api-key': 'sk_your_api_key'
}
```

### App User Registration

```typescript
POST /app-api/auth/auth/register

Headers: { 'x-api-key': 'sk_your_key' }
Body: { name, email, password, phone?, metadata? }
Response: { user, session: { accessToken } }
```

### App User Login

```typescript
POST /app-api/auth/auth/login

Headers: { 'x-api-key': 'sk_your_key' }
Body: { email, password }
Response: { user, session: { accessToken } }
```

### Session Verification

```typescript
POST /app-api/auth/auth/verify

Headers: {
  'x-api-key': 'sk_your_key',
  'Authorization': 'Bearer <accessToken>'  // SuperTokens access token
}
Response: { user }
```

### Refresh Session Token

```typescript
POST /auth/session/refresh

Headers: {
  'Authorization': 'Bearer <accessToken>'
}
Response: { status: 'OK', accessToken, refreshToken }
```

### Admin User Management

```typescript
GET /app-api/auth/users

Headers: {
  'Cookie': 'sAccessToken=...'  // Platform admin session
  'x-api-key': 'sk_your_key'    // Project auto-detected from API key
}
Response: { users[], pagination }
```

---

## 💡 Best Practices

1. **Always include API key** - Required for project identification
2. **Store JWT tokens securely** - Use localStorage or httpOnly cookies
3. **Verify tokens on app start** - Check if user is still logged in
4. **Handle token expiration** - Redirect to login when expired
5. **Separate services** - AppUserAuthService vs UserManagementService
6. **Use TypeScript** - Full type safety from examples
7. **Implement protected routes** - Verify tokens before rendering sensitive content

---

## 🆘 Troubleshooting

### "Project not found"
- ❌ Missing `x-api-key` header
- ✅ Include your API key in every request

### "Unauthorized"
- ❌ Invalid API key
- ✅ Regenerate key in Skaftin UI

### "Token expired"
- ❌ JWT token has expired
- ✅ User needs to log in again

### "User not found"
- ❌ User ID doesn't exist in the database
- ✅ Check user was created successfully

---

## 📞 Support

For issues or questions:
1. Check troubleshooting sections in each guide
2. Review examples in `07-APP-USER-AUTHENTICATION.md`
3. Test with provided code snippets
4. Verify API key is valid

---

## 🎉 Summary

The updated authentication documentation provides:
- ✅ Simpler API endpoints
- ✅ Clearer separation of concerns
- ✅ Better code examples
- ✅ Comprehensive React patterns
- ✅ Type-safe service implementations
- ✅ Production-ready patterns

---

## 🔄 SuperTokens Migration (November 14, 2025)

### What Changed

**Before (JWT):**
- JWT tokens stored in localStorage
- Manual token management
- No automatic refresh
- Client-side logout only

**After (SuperTokens):**
- SuperTokens access tokens
- Secure session management
- Automatic token refresh
- Server-side session revocation

### Response Format Change

**Before:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIs..."  // JWT token
  }
}
```

**After:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."  // SuperTokens access token
    }
  }
}
```

### Migration Steps

1. **Update response handling:**
   ```typescript
   // OLD
   const token = response.data.token;
   
   // NEW
   const accessToken = response.data.session.accessToken;
   ```

2. **Update storage key:**
   ```typescript
   // OLD
   localStorage.setItem('app_user_token', token);
   
   // NEW
   localStorage.setItem('app_user_access_token', accessToken);
   ```

3. **Add token refresh logic:**
   ```typescript
   // NEW - Handle 401 responses with automatic refresh
   if (response.status === 401) {
     const newToken = await AppUserAuthService.refreshToken(accessToken);
     // Retry request with new token
   }
   ```

4. **Update logout:**
   ```typescript
   // OLD - Only remove client-side
   localStorage.removeItem('app_user_token');
   
   // NEW - Revoke server-side session
   await AppUserAuthService.logout(accessToken);
   ```

### Benefits of SuperTokens

✅ **Enhanced Security**
- HTTP-only session support
- CSRF protection built-in
- Session revocation capability

✅ **Better User Experience**
- Automatic token refresh
- Seamless session management
- Reduced login prompts

✅ **Production Ready**
- Industry-standard authentication
- Built-in security best practices
- Scalable architecture

---

**Next Steps:**
1. Read `02-AUTHENTICATION.md` for platform setup
2. Read `07-APP-USER-AUTHENTICATION.md` for user auth
3. Use the updated service examples to build your integration
4. Test with your application

---

**Documentation Updated By:** Skaftin Development Team  
**Last Updated:** November 14, 2025  
**Version:** 2.0 (SuperTokens Migration)

