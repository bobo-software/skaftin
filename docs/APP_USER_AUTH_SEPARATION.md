# App User Authentication Separation

**Date:** November 12, 2025  
**Version:** 3.0.0

## 🎯 Overview

Skaftin now has **two completely separate authentication systems:**

1. **Platform Authentication** - For Skaftin administrators (uses SuperTokens)
2. **App User Authentication** - For application end-users (uses JWT)

This separation allows you to:
- ✅ Use the same email for both systems
- ✅ Manage Skaftin platform with one account
- ✅ Be a user in your own application with the same email

---

## 🏗️ Authentication Architecture

### Platform Authentication (SuperTokens)
```
Platform Admins → SuperTokens → Cookie-based Sessions
├─ Manage Skaftin platform
├─ Create/manage projects
├─ Configure settings
└─ Manage teams/organizations
```

**Endpoints:**
- `POST /api/auth/register` - Register platform admin
- `POST /api/auth/login` - Platform admin login
- `POST /api/auth/logout` - Platform admin logout

### App User Authentication (JWT)
```
App Users → Database (app_users) → JWT Tokens
├─ End-users of your applications
├─ Project-specific authentication
├─ Role-based access control
└─ Custom user fields
```

**Endpoints:**
- `POST /api/app-auth/:projectId/auth/register` - Register app user
- `POST /api/app-auth/:projectId/auth/login` - App user login
- `POST /api/app-auth/:projectId/auth/verify` - Verify JWT token
- `POST /api/app-auth/:projectId/auth/logout` - App user logout

---

## 🔐 How It Works

### Platform Admin Example

```bash
# Register as platform admin (SuperTokens)
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "AdminPass123!",
  "full_name": "John Admin"
}

# Login as platform admin
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "AdminPass123!"
}

# Response: Sets HTTP-only cookies
# Now you can manage Skaftin platform
```

### App User Example (Same Email!)

```bash
# Register as app user in YOUR project (JWT)
POST /api/app-auth/123/auth/register
{
  "name": "John User",
  "email": "admin@example.com",  // Same email! ✅
  "password": "UserPass123!",     // Different password
  "phone": "+1234567890"
}

# Login as app user
POST /api/app-auth/123/auth/login
{
  "email": "admin@example.com",
  "password": "UserPass123!"
}

# Response: Returns JWT token
{
  "success": true,
  "data": {
    "user": { "id": 5, "email": "admin@example.com", ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}

# Use token in subsequent requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📊 Database Structure

### Platform Admins (SuperTokens)
Stored in SuperTokens tables (managed by SuperTokens):
```
supertokens_emailpassword_users
├─ user_id (UUID)
├─ email
└─ password_hash (managed by SuperTokens)
```

### App Users (Per Project)
Stored in project-specific schemas:
```
project_1.app_users
├─ id
├─ name
├─ email
├─ password (bcrypt hashed)
├─ phone
├─ metadata (JSONB)
├─ is_active
└─ ...

project_2.app_users (separate table!)
├─ id
├─ name
├─ email
└─ ...
```

**Key Point:** Each project has its own `app_users` table, so:
- User "john@example.com" in Project 1 is different from
- User "john@example.com" in Project 2

---

## 🔑 Authentication Flow Comparison

### Platform Admin Login
```
1. POST /api/auth/login
2. SuperTokens validates credentials
3. SuperTokens creates session
4. HTTP-only cookies set
5. Browser automatically sends cookies
6. Access granted to platform features
```

### App User Login
```
1. POST /api/app-auth/:projectId/auth/login
2. Check project's auth_settings
3. Query project's app_users table
4. Verify bcrypt password hash
5. Generate JWT token
6. Return token to client
7. Client sends token in Authorization header
8. Access granted to app features
```

---

## 🛡️ Security Differences

### Platform Authentication (SuperTokens)
- ✅ HTTP-only cookies (XSS immune)
- ✅ Automatic CSRF protection
- ✅ Built-in session management
- ✅ Automatic token refresh
- ✅ Managed by SuperTokens service

### App User Authentication (JWT)
- ✅ Stateless authentication
- ✅ Project-specific tokens
- ✅ Configurable session duration per role
- ✅ Client manages token storage
- ⚠️ Client must securely store token
- ⚠️ Token in localStorage (XSS risk if compromised)

---

## 🔄 Migration Guide

### For Existing Projects

Run the migration script to add password column:

```bash
npx ts-node scripts/add-password-column.ts
```

This adds the `password` column to all existing `app_users` tables.

### For Existing Users

Users created via the platform admin interface (before this update) will:
- ✅ Still exist in the database
- ❌ Not have passwords set
- 🔧 Need to either:
  - Register again via app user registration
  - Have password set by admin
  - Use password reset flow (when implemented)

---

## 📝 API Documentation

### App User Registration

**Endpoint:** `POST /api/app-auth/:projectId/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "phone": "+1234567890",
  "metadata": {
    "department": "Engineering"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "+1234567890",
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Checks:**
- Auth enabled for project
- Registration enabled for project
- Email not already taken
- Default role assigned automatically

---

### App User Login

**Endpoint:** `POST /api/app-auth/:projectId/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "roles": [
        {
          "id": 2,
          "role_name": "User",
          "role_key": "user"
        }
      ],
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Checks:**
- Auth enabled for project
- User exists and is active
- Password is correct
- Session duration from user's primary role

---

### Token Verification

**Endpoint:** `POST /api/app-auth/:projectId/auth/verify`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "roles": [...],
      "is_active": true
    }
  }
}
```

---

### Logout

**Endpoint:** `POST /api/app-auth/:projectId/auth/logout`

For JWT authentication, logout is handled client-side by removing the token. The endpoint exists for API consistency.

---

## 🎯 Use Cases

### Use Case 1: Platform Admin Managing Their Own App

```bash
# 1. Login to Skaftin platform
POST /api/auth/login
{
  "email": "admin@mycompany.com",
  "password": "PlatformPass123!"
}
# → Manage projects, settings, etc.

# 2. Register as user in your own app
POST /api/app-auth/123/auth/register
{
  "name": "Admin User",
  "email": "admin@mycompany.com",  // Same email!
  "password": "AppPass123!"        // Different password
}
# → Test your application as a user

# 3. Login to your app
POST /api/app-auth/123/auth/login
{
  "email": "admin@mycompany.com",
  "password": "AppPass123!"
}
# → Use your application
```

### Use Case 2: End User Only

```bash
# Regular user of your application
POST /api/app-auth/123/auth/register
{
  "name": "Jane Customer",
  "email": "jane@customer.com",
  "password": "CustomerPass123!"
}

# Login and use app
POST /api/app-auth/123/auth/login
{
  "email": "jane@customer.com",
  "password": "CustomerPass123!"
}
```

---

## 🔧 Configuration

### Auth Settings

Control app user authentication per project:

```typescript
// GET /api/app-auth/:projectId/settings
{
  "auth_enabled": true,              // Master toggle
  "registration_enabled": true,      // Allow new registrations
  "require_email_verification": false,
  "enable_password_reset": true,
  "default_role_id": 2,              // Auto-assigned role
  "email_provider_id": 1             // For auth emails
}
```

### Session Duration by Role

```typescript
// Configured in app_roles table
{
  "role_name": "Admin",
  "session_duration_minutes": 60     // 1 hour
}

{
  "role_name": "User",
  "session_duration_minutes": 10080  // 7 days
}
```

---

## 🚨 Important Notes

### 1. Password Storage

**Platform Admins:**
- Passwords managed by SuperTokens
- Industry-standard security
- Automatic updates

**App Users:**
- Passwords hashed with bcrypt (salt rounds: 10)
- Stored in project database
- You manage security

### 2. Session Management

**Platform Admins:**
- Automatic refresh
- Managed by SuperTokens
- No client-side handling needed

**App Users:**
- JWT tokens expire based on role
- Client must handle refresh (or re-login)
- Store token securely (recommended: localStorage with XSS protection)

### 3. Email Uniqueness

**Platform:**
- Email must be unique across all platform admins

**App Users:**
- Email must be unique per project (by default)
- Can be configured via `allow_duplicate_emails` setting
- Same email can exist in different projects

---

## 🔮 Future Enhancements

### Planned Features

1. **Password Reset Flow**
   - Email-based password reset for app users
   - Secure token generation
   - Integration with email providers

2. **Email Verification**
   - Send verification emails to app users
   - Verify email ownership
   - Require verification before login

3. **Token Refresh**
   - Automatic JWT token refresh
   - Refresh tokens for long-lived sessions
   - Revocation support

4. **OAuth/Social Login**
   - Google/Facebook/GitHub login
   - SAML/SSO support
   - Multi-factor authentication

5. **Session Management**
   - View active sessions
   - Revoke sessions
   - Device management

---

## 🧪 Testing

### Test Separation

```bash
# 1. Create platform admin
POST /api/auth/register
{"email": "test@example.com", "password": "Platform123!", "full_name": "Test Admin"}

# 2. Create app user with SAME email
POST /api/app-auth/1/auth/register
{"name": "Test User", "email": "test@example.com", "password": "App123!"}

# 3. Login as platform admin
POST /api/auth/login
{"email": "test@example.com", "password": "Platform123!"}
# ✅ Success - returns cookies

# 4. Login as app user
POST /api/app-auth/1/auth/login
{"email": "test@example.com", "password": "App123!"}
# ✅ Success - returns JWT token

# Both work independently! ✅
```

---

## 📚 Related Documentation

- [Frontend Authentication Guide](./FRONTEND_AUTHENTICATION_GUIDE.md)
- [Backend Auth Improvements](./BACKEND_AUTH_IMPROVEMENTS.md)
- [Auth System Implementation](./AUTH_SYSTEM_IMPLEMENTATION.md)
- [SuperTokens Integration](./SUPERTOKENS_INTEGRATION.md)

---

## ✅ Summary

**What Changed:**
- ✅ Two separate authentication systems
- ✅ Platform auth uses SuperTokens (cookies)
- ✅ App user auth uses JWT (tokens)
- ✅ Same email can be used for both
- ✅ Password column added to app_users
- ✅ New app user auth endpoints
- ✅ Bcrypt password hashing
- ✅ Configurable session durations

**Benefits:**
- 🎯 Clear separation of concerns
- 🔐 Better security isolation
- 🚀 Same email for platform & app
- 📊 Project-specific user management
- ⚡ Flexible authentication options

**Breaking Changes:**
- ⚠️ Existing app users need passwords set
- ⚠️ Platform admin creation route changed (now does NOT create in SuperTokens)
- ✅ Migration script provided

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

