# 🎉 API Key & Access Token Authentication

**Date:** November 12, 2025  
**Status:** ✅ Implemented

## 🚀 What's New

You can now authenticate app users **without including the project ID in the URL**!

### ✨ Before
```bash
POST /api/app-auth/123/auth/register  # projectId hardcoded in URL
POST /api/app-auth/123/auth/login
```

### ✨ After
```bash
POST /api/app-auth/auth/register      # No projectId! 🎉
POST /api/app-auth/auth/login

Headers:
  x-api-key: sk_live_your_api_key_here  # ← Project detected from this!
```

---

## 🎯 How It Works

### The Magic: Automatic Project Detection

```
Request with x-api-key header
        ↓
Middleware looks up API key in database
        ↓
Finds: api_key → project_id → schema_name
        ↓
Attaches to request: req.projectId, req.schemaName
        ↓
Controller uses project context
        ↓
Response
```

---

## 🔑 Three Ways to Authenticate

### Method 1: API Key (Recommended for Register/Login)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-api-key: sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**When to use:** First-time registration, login from apps

---

### Method 2: Access Token

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-access-token: your-access-token" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**When to use:** Using generated access tokens

---

### Method 3: JWT Token (After Login)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." 
```

**When to use:** User already has a JWT token (after successful login)

**Why it works:** JWT token contains `projectId` in its payload!

---

## 📋 Complete Workflow

### Step 1: Get API Key (One-time setup)

```bash
# Login as platform admin
POST /api/auth/login
{
  "email": "admin@mycompany.com",
  "password": "AdminPass123!"
}

# Create API key for your project
POST /api/projects/123/credentials
{
  "name": "Production API Key",
  "type": "production"
}

# Response:
{
  "api_key": "sk_live_abc123...",
  "access_token": "..."
}

# Save the API key!
```

---

### Step 2: User Registration (No projectId in URL!)

```bash
POST /api/app-auth/auth/register
Headers:
  x-api-key: sk_live_abc123...
  Content-Type: application/json

Body:
{
  "name": "John Customer",
  "email": "john@customer.com",
  "password": "SecurePass123!",
  "phone": "+1234567890"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."  ← Contains projectId!
  }
}
```

---

### Step 3: User Login (No projectId in URL!)

```bash
POST /api/app-auth/auth/login
Headers:
  x-api-key: sk_live_abc123...
  Content-Type: application/json

Body:
{
  "email": "john@customer.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."  ← Save this!
  }
}
```

---

### Step 4: Subsequent Requests (Use JWT token)

```bash
POST /api/app-auth/auth/verify
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# No API key needed! projectId is in the token.
```

---

## 💡 Benefits for Your Use Case

### What You Wanted:
> "Can we not use those [API key and access token] to identify which project instead of having to paste in the project ID"

### What You Got:
✅ **API Key identifies project** - No projectId in URL  
✅ **Access Token identifies project** - No projectId in URL  
✅ **JWT Token identifies project** - Contains projectId in payload  
✅ **Cleaner URLs** - `/auth/register` vs `/123/auth/register`  
✅ **More secure** - Project from credentials, not URL  
✅ **Backward compatible** - Old URLs still work  

---

## 🎨 Frontend Example

```typescript
// config.ts
export const API_KEY = import.meta.env.VITE_API_KEY;

// AppUserAuthService.ts
class AppUserAuthService {
  async register(name: string, email: string, password: string) {
    const response = await fetch('/api/app-auth/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,  // ← Project detected from this
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Store JWT token (contains projectId)
      localStorage.setItem('auth-token', data.data.token);
      return data.data;
    }
  }

  async login(email: string, password: string) {
    const response = await fetch('/api/app-auth/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,  // ← Project detected from this
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('auth-token', data.data.token);
      return data.data;
    }
  }

  async verify() {
    const token = localStorage.getItem('auth-token');
    
    const response = await fetch('/api/app-auth/auth/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,  // ← Project from token!
      },
    });

    return await response.json();
  }
}
```

**No more projectId management in your frontend code!** 🎉

---

## 🔒 Security Improvements

### 1. Project Context from Trusted Source
**Before:** ProjectId from URL (can be manipulated)  
**After:** ProjectId from API key/token (trusted, validated)

### 2. API Key Validation
Every request validates:
- ✅ API key exists
- ✅ API key is active
- ✅ API key belongs to valid project
- ✅ Project exists and is accessible

### 3. Token-Project Binding
JWT tokens are bound to specific projects:
- ✅ Token contains projectId
- ✅ Can't use token for different project
- ✅ Validated on every request

---

## 📊 Comparison

| Feature | Old Way | New Way |
|---------|---------|---------|
| **URL** | `/api/app-auth/123/auth/login` | `/api/app-auth/auth/login` |
| **Project Detection** | From URL parameter | From headers (API key/token) |
| **Security** | URL can be manipulated | Headers validated |
| **Frontend Code** | Pass projectId everywhere | Set API key once |
| **Cleanliness** | ❌ URLs cluttered | ✅ URLs clean |
| **Backward Compatible** | - | ✅ Yes! Old URLs still work |

---

## 🎯 For Your Testing

### Quick Test with API Key

```bash
# 1. Create API key (if you don't have one)
# Login to Skaftin → Projects → Your Project → Settings → API Credentials → Create

# 2. Register user (NO PROJECT ID!)
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "name": "Gift Sibiya",
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf"
  }'

# 3. Login (NO PROJECT ID!)
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf"
  }'
```

---

## 📚 Documentation

**New Guide:**
- [App User Auth Without Project ID](./APP_USER_AUTH_NO_PROJECT_ID.md) - Complete guide

**Related Docs:**
- [Authentication Complete](../AUTHENTICATION_COMPLETE.md) - Overview
- [Which Auth Route](./WHICH_AUTH_ROUTE.md) - Decision guide
- [Auth Routes Reference](./AUTH_ROUTES_REFERENCE.md) - All endpoints

---

## ✅ Summary

**What was implemented:**
- ✅ Middleware to extract project from API key
- ✅ Middleware to extract project from access token
- ✅ Middleware to extract project from JWT token
- ✅ New routes without projectId in URL
- ✅ Backward compatibility with old routes
- ✅ Updated controllers to use middleware-provided project
- ✅ Comprehensive documentation

**Benefits:**
- 🎯 Cleaner, simpler URLs
- 🔐 More secure (project from headers)
- 🚀 Better developer experience
- 📦 Backward compatible
- ✨ Industry-standard API design

**Your request:**
> "Can we not use those [API key and access token] to identify which project"

**Answer:**
✅ **YES! Implemented and ready to use!**

---

**Last Updated:** November 12, 2025  
**Status:** ✅ Production Ready

