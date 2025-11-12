# App User Authentication Without Project ID

**Date:** November 12, 2025  
**Version:** 4.0.0

## 🎯 Overview

App user authentication now supports **automatic project detection** from API keys and access tokens, eliminating the need to include `projectId` in the URL!

---

## 🚀 New Simplified Routes

### ✨ Before (Old Way)
```bash
POST /api/app-auth/123/auth/register  # projectId in URL
POST /api/app-auth/123/auth/login
POST /api/app-auth/123/auth/verify
```

### ✨ After (New Way)
```bash
POST /api/app-auth/auth/register      # No projectId needed!
POST /api/app-auth/auth/login
POST /api/app-auth/auth/verify

# Project detected from:
# - x-api-key header
# - x-access-token header  
# - Authorization: Bearer <jwt-token> header
```

---

## 🔑 How Project Detection Works

The middleware automatically extracts the project from your credentials in this order:

### Priority 1: API Key Header
```bash
POST /api/app-auth/auth/register
Headers:
  x-api-key: your-api-key-here
  Content-Type: application/json

Body:
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

The API key is looked up in the database → project ID extracted → request processed.

---

### Priority 2: Access Token Header
```bash
POST /api/app-auth/auth/register
Headers:
  x-access-token: your-access-token-here
  Content-Type: application/json

Body:
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

---

### Priority 3: JWT Token (for login/verify)
```bash
POST /api/app-auth/auth/verify
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The JWT token contains `projectId` in its payload → automatically extracted.

---

### Priority 4: URL Parameter (Backward Compatibility)
```bash
POST /api/app-auth/123/auth/register  # Still works!
```

Old URL format still supported for backward compatibility.

---

## 📊 Complete Examples

### Example 1: Register with API Key

```bash
# Get your API key from Skaftin dashboard (Settings → API Credentials)

curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_abc123..." \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phone": "+1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 456,
      "name": "John Doe",
      "email": "john@example.com",
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Example 2: Login with API Key

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_abc123..." \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Response includes JWT token** - save it for future requests!

---

### Example 3: Verify with JWT Token Only

```bash
# No API key needed - projectId is in the JWT token!

curl -X POST http://localhost:4006/api/app-auth/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 456,
      "name": "John Doe",
      "email": "john@example.com",
      "roles": [...],
      "is_active": true
    }
  }
}
```

---

## 🎯 Complete User Flow

### Step 1: Get API Key

```bash
# Login as platform admin
POST /api/auth/login
{
  "email": "admin@mycompany.com",
  "password": "AdminPass123!"
}

# Get or create API key
POST /api/projects/123/credentials
{
  "name": "My App API Key",
  "type": "production"
}

# Save the returned API key
```

---

### Step 2: Register App User (No Project ID!)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_your_api_key_here" \
  -d '{
    "name": "Customer Name",
    "email": "customer@example.com",
    "password": "CustomerPass123!",
    "phone": "+1234567890"
  }'
```

**Returns:**
- User object
- JWT token (contains projectId)

---

### Step 3: Login (No Project ID!)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_your_api_key_here" \
  -d '{
    "email": "customer@example.com",
    "password": "CustomerPass123!"
  }'
```

**Save the JWT token from response!**

---

### Step 4: Use JWT Token (No API Key Needed!)

```bash
# All future requests can use JUST the JWT token
# No API key needed because projectId is in the token

curl -X POST http://localhost:4006/api/app-auth/auth/verify \
  -H "Authorization: Bearer <your-jwt-token>"

# The token contains:
# - userId
# - email  
# - projectId  ← Automatically extracted!
# - roles
```

---

## 🔐 Security Benefits

### 1. API Key Security
- API key identifies the project
- Stored in database with project association
- Can be revoked by platform admin
- Activity tracked per API key

### 2. JWT Token Security
- Token contains projectId (can't be used for other projects)
- Signed with secret key (can't be forged)
- Expires based on role (configurable per role)
- Stateless (no server-side session storage)

### 3. Project Isolation
- Middleware validates project exists
- Queries scoped to project schema
- No cross-project data leakage

---

## 📋 Supported Header Combinations

### Option 1: API Key (Best for Registration/Login)
```http
POST /api/app-auth/auth/register
Headers:
  x-api-key: sk_live_abc123...
  Content-Type: application/json
```

**Use when:** Initial registration or login

---

### Option 2: Access Token
```http
POST /api/app-auth/auth/register
Headers:
  x-access-token: your-access-token
  Content-Type: application/json
```

**Use when:** Using generated access tokens

---

### Option 3: JWT Bearer Token (Best for Authenticated Requests)
```http
POST /api/app-auth/auth/verify
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Use when:** User already logged in (has JWT token)

---

### Option 4: URL Parameter (Backward Compatible)
```http
POST /api/app-auth/123/auth/register
Headers:
  Content-Type: application/json
```

**Use when:** Migrating from old code, or explicit project specification needed

---

## 🎨 Frontend Integration

### Using API Key

```typescript
// frontend/src/config.ts
export const API_KEY = 'sk_live_your_api_key_here'; // From env variables

// Register user
const response = await fetch('/api/app-auth/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,  // ← Project detected from this
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecurePass123!',
  }),
});

const { token } = await response.json();
localStorage.setItem('app-auth-token', token);
```

---

### Using JWT Token

```typescript
// Login response contains token with projectId
const loginResponse = await fetch('/api/app-auth/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
  body: JSON.stringify({ email, password }),
});

const { token } = await loginResponse.json();

// Now use JUST the token (no API key needed!)
const verifyResponse = await fetch('/api/app-auth/auth/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,  // ← Project detected from token
  },
});
```

---

## 🧪 Testing

### Test 1: Register with API Key

```bash
# Get API key first
curl -X POST http://localhost:4006/api/projects/1/credentials \
  -H "Content-Type: application/json" \
  --cookie cookies.txt \
  -d '{"name": "Test Key", "type": "development"}'

# Save the API key, then:
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_API_KEY>" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

---

### Test 2: Login and Verify with Token

```bash
# Login (with API key)
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_API_KEY>" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'

# Save the token from response, then:

# Verify (with JUST the token - no API key!)
curl -X POST http://localhost:4006/api/app-auth/auth/verify \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

### Test 3: Backward Compatibility

```bash
# Old URL format still works
curl -X POST http://localhost:4006/api/app-auth/1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test2@example.com",
    "password": "TestPass123!"
  }'
```

---

## 🎯 Benefits

### For Developers
- ✅ **Simpler URLs** - No need to include projectId everywhere
- ✅ **One API key** - Use the same key for all auth operations
- ✅ **Cleaner code** - Less parameter passing
- ✅ **Better security** - Project context from credentials, not URL

### For End Users
- ✅ **Seamless experience** - No exposed project IDs
- ✅ **Single token** - JWT contains everything needed
- ✅ **Automatic routing** - Backend figures out the project

### For Security
- ✅ **API key validation** - Every request validates the key
- ✅ **Project isolation** - Token locked to specific project
- ✅ **No URL manipulation** - Project from trusted source (headers)

---

## 📝 Migration Guide

### From Old Code (with projectId in URL)

**Before:**
```typescript
// Hard-coded projectId in URL
const response = await fetch(`/api/app-auth/${projectId}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData),
});
```

**After:**
```typescript
// Project detected from API key
const response = await fetch('/api/app-auth/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,  // ← Add this
  },
  body: JSON.stringify(userData),
});
```

**Benefit:** If you change project, just change the API key - no code changes needed!

---

## 🔧 Implementation Details

### Middleware Chain

```
Request
  ↓
extractProjectFromCredentials  ← Checks API key, JWT token, URL
  ↓
Sets req.projectId and req.schemaName
  ↓
AppAuthController (uses req.projectId)
  ↓
Response
```

### Project Extraction Logic

```typescript
1. Check x-api-key header
   ├─ Query: SELECT project_id FROM api_credentials WHERE api_key = ?
   └─ If found: req.projectId = result.project_id

2. If not found, check Authorization: Bearer token
   ├─ Decode JWT
   └─ Extract: req.projectId = decoded.projectId

3. If not found, check URL parameter
   └─ Extract: req.projectId = req.params.projectId

4. Load project schema
   ├─ Query: SELECT schema_name FROM projects WHERE id = ?
   └─ Set: req.schemaName = result.schema_name

5. Continue to controller with context set
```

---

## 🎨 Frontend Service Example

### Create an App User Service

```typescript
// frontend/src/services/AppUserAuthService.ts

class AppUserAuthService {
  private apiKey: string;
  private baseUrl = '/api/app-auth';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async register(name: string, email: string, password: string, phone?: string) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,  // ← Project detected from this
      },
      body: JSON.stringify({ name, email, password, phone }),
    });

    const data = await response.json();
    
    if (data.success && data.data.token) {
      // Store JWT token
      localStorage.setItem('app-user-token', data.data.token);
      return { success: true, user: data.data.user, token: data.data.token };
    }

    return { success: false, error: data.message };
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,  // ← Project detected from this
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (data.success && data.data.token) {
      localStorage.setItem('app-user-token', data.data.token);
      return { success: true, user: data.data.user, token: data.data.token };
    }

    return { success: false, error: data.message };
  }

  async verify() {
    const token = localStorage.getItem('app-user-token');
    
    if (!token) {
      return { success: false, error: 'No token found' };
    }

    const response = await fetch(`${this.baseUrl}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,  // ← Project detected from token
      },
    });

    const data = await response.json();
    return data.success ? { success: true, user: data.data.user } : { success: false, error: data.message };
  }

  async logout() {
    localStorage.removeItem('app-user-token');
    
    await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
    });
  }
}

export default AppUserAuthService;
```

---

### Usage

```typescript
import AppUserAuthService from '@/services/AppUserAuthService';

// Initialize with your API key
const authService = new AppUserAuthService('sk_live_your_api_key_here');

// Register
const result = await authService.register(
  'John Doe',
  'john@example.com',
  'SecurePass123!',
  '+1234567890'
);

if (result.success) {
  console.log('Registered:', result.user);
  console.log('Token:', result.token);
}

// Login
const loginResult = await authService.login(
  'john@example.com',
  'SecurePass123!'
);

// Verify (uses stored token)
const verifyResult = await authService.verify();

// Logout
await authService.logout();
```

---

## 🔒 Security Considerations

### API Key Best Practices

1. **Store securely**
   ```typescript
   // ✅ Good: Environment variables
   const API_KEY = import.meta.env.VITE_API_KEY;
   
   // ❌ Bad: Hard-coded
   const API_KEY = 'sk_live_abc123...';
   ```

2. **Use different keys for environments**
   ```
   Development: sk_dev_...
   Staging: sk_staging_...
   Production: sk_live_...
   ```

3. **Rotate regularly**
   - Create new key
   - Update app
   - Revoke old key

---

### JWT Token Best Practices

1. **Store securely**
   ```typescript
   // ✅ Better: localStorage with XSS protection
   localStorage.setItem('app-user-token', token);
   
   // ✅ Best: httpOnly cookie (if possible)
   // ❌ Bad: Global variable
   window.token = token;
   ```

2. **Handle expiration**
   ```typescript
   try {
     await verifyToken();
   } catch (error) {
     if (error.message === 'Token expired') {
       // Redirect to login
       redirectToLogin();
     }
   }
   ```

3. **Clear on logout**
   ```typescript
   localStorage.removeItem('app-user-token');
   ```

---

## 📊 Route Comparison

| Method | Old Route | New Route | Headers Required |
|--------|-----------|-----------|------------------|
| Register | `POST /api/app-auth/123/auth/register` | `POST /api/app-auth/auth/register` | `x-api-key` |
| Login | `POST /api/app-auth/123/auth/login` | `POST /api/app-auth/auth/login` | `x-api-key` |
| Verify | `POST /api/app-auth/123/auth/verify` | `POST /api/app-auth/auth/verify` | `Authorization: Bearer <token>` |
| Logout | `POST /api/app-auth/123/auth/logout` | `POST /api/app-auth/auth/logout` | None (client-side) |

**Both formats supported for backward compatibility!**

---

## 🆘 Troubleshooting

### Error: "Project not found. Provide x-api-key..."

**Cause:** No project context found

**Solutions:**
1. Add `x-api-key` header with valid API key
2. Add `x-access-token` header
3. Use old URL format with projectId: `/api/app-auth/123/auth/register`

---

### Error: "Invalid API key"

**Cause:** API key not found or inactive

**Solutions:**
1. Verify API key is correct
2. Check key is active (not revoked)
3. Create new API key via platform

---

### Error: "Token does not match project context"

**Cause:** JWT token projectId doesn't match API key's project

**Solution:** Don't mix credentials from different projects

```bash
# ❌ Wrong: API key from project 1, but token from project 2
-H "x-api-key: project-1-key"
-H "Authorization: Bearer project-2-token"

# ✅ Correct: Use one or the other
-H "Authorization: Bearer project-2-token"
```

---

## ✅ Summary

**What Changed:**
- ✅ New routes without projectId in URL
- ✅ Automatic project detection from headers
- ✅ Middleware extracts project from API key/token
- ✅ Backward compatible with old URLs
- ✅ Cleaner, more secure authentication flow

**Benefits:**
- 🎯 Simpler URLs
- 🔐 Better security
- 🚀 Easier to use
- 📦 Backward compatible
- ✨ More professional API design

**Breaking Changes:**
- None! Old routes still work

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

