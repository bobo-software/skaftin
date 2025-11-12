# Authentication Routes Reference

**Last Updated:** November 12, 2025

## 🎯 Two Separate Authentication Systems

Skaftin has **TWO completely independent authentication systems** with **different routes**:

---

## 🔷 PLATFORM ADMIN AUTHENTICATION

**Who:** Skaftin platform managers, project creators, team administrators  
**Technology:** SuperTokens (cookie-based sessions)  
**Base Route:** `/api/auth`

### Endpoints

#### 1. Register Platform Admin
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "admin@mycompany.com",
  "password": "PlatformPass123!",
  "full_name": "John Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "admin@mycompany.com",
      "name": "John Admin"
    },
    "token": "session-managed-by-supertokens"
  }
}
```

**What you can do:**
- Create/manage projects
- Configure settings
- Manage teams
- Access Skaftin platform features

---

#### 2. Login Platform Admin
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@mycompany.com",
  "password": "PlatformPass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "admin@mycompany.com",
      "name": "John Admin"
    },
    "token": "session-managed-by-supertokens"
  }
}
```

**Authentication:** HTTP-only cookies (automatically set)

---

#### 3. Verify Platform Admin Session
```http
POST /api/auth/verify
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "admin@mycompany.com",
      "name": "John Admin",
      "projectIds": [],
      "role": "user"
    }
  }
}
```

---

#### 4. Logout Platform Admin
```http
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🔶 APP USER AUTHENTICATION

**Who:** End-users of YOUR applications (customers, clients, users)  
**Technology:** JWT tokens + bcrypt  
**Base Route:** `/api/app-auth/:projectId/auth`

### Endpoints

#### 1. Register App User
```http
POST /api/app-auth/:projectId/auth/register
Content-Type: application/json

{
  "name": "Jane Customer",
  "email": "customer@example.com",
  "password": "UserPass123!",
  "phone": "+1234567890",
  "metadata": {
    "department": "Sales"
  }
}
```

**Example with real project ID:**
```http
POST /api/app-auth/123/auth/register
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 456,
      "name": "Jane Customer",
      "email": "customer@example.com",
      "phone": "+1234567890",
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**What you can do:**
- Use YOUR application
- Access project-specific features
- Role-based access control

---

#### 2. Login App User
```http
POST /api/app-auth/:projectId/auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "UserPass123!"
}
```

**Example with real project ID:**
```http
POST /api/app-auth/123/auth/login
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 456,
      "name": "Jane Customer",
      "email": "customer@example.com",
      "roles": [
        {
          "id": 2,
          "role_name": "User",
          "role_key": "user"
        }
      ],
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Authentication:** JWT token (store in localStorage, send in Authorization header)

---

#### 3. Verify App User Token
```http
POST /api/app-auth/:projectId/auth/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 456,
      "name": "Jane Customer",
      "email": "customer@example.com",
      "roles": [...],
      "is_active": true
    }
  }
}
```

---

#### 4. Logout App User
```http
POST /api/app-auth/:projectId/auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note:** For JWT, logout is client-side (remove token from storage)

---

## 📊 Quick Comparison

| Feature | Platform Admin Auth | App User Auth |
|---------|-------------------|---------------|
| **Route** | `/api/auth/*` | `/api/app-auth/:projectId/auth/*` |
| **Technology** | SuperTokens | JWT + bcrypt |
| **Storage** | SuperTokens tables | `project_X.app_users` |
| **Session** | HTTP-only cookies | JWT tokens |
| **Scope** | Global (all projects) | Project-specific |
| **Purpose** | Manage Skaftin | Use applications |
| **Same Email?** | ✅ Can use same email in both systems |

---

## 🎯 When to Use Which?

### Use Platform Admin Auth (`/api/auth`) When:
- ✅ Building Skaftin admin dashboard
- ✅ Creating project management UI
- ✅ Managing teams and organizations
- ✅ Configuring platform settings
- ✅ You need access to Skaftin features

### Use App User Auth (`/api/app-auth/:projectId/auth`) When:
- ✅ Building YOUR application
- ✅ Your customers/users need to login
- ✅ Implementing user registration for YOUR app
- ✅ Project-specific authentication
- ✅ Role-based access control for YOUR app

---

## 🔥 Common Mistakes

### ❌ WRONG: Registering app user at platform endpoint
```http
# This creates a PLATFORM ADMIN, not an app user!
POST /api/auth/register
{
  "email": "customer@example.com",
  "password": "password"
}
```

### ✅ CORRECT: Registering app user at app endpoint
```http
# This creates an APP USER for your project
POST /api/app-auth/123/auth/register
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "password": "password"
}
```

---

## 📝 Full Example Workflow

### Scenario: You are building an e-commerce app

```bash
# Step 1: Register yourself as platform admin (to manage Skaftin)
POST /api/auth/register
{
  "email": "admin@myshop.com",
  "password": "AdminPass123!",
  "full_name": "Shop Owner"
}

# Step 2: Login to Skaftin platform
POST /api/auth/login
{
  "email": "admin@myshop.com",
  "password": "AdminPass123!"
}

# Step 3: Create a project (projectId = 123)
# Use Skaftin dashboard or API...

# Step 4: Your customer registers to use YOUR shop
POST /api/app-auth/123/auth/register
{
  "name": "John Customer",
  "email": "john@customer.com",
  "password": "CustomerPass123!",
  "phone": "+1234567890"
}

# Step 5: Customer logs into YOUR shop
POST /api/app-auth/123/auth/login
{
  "email": "john@customer.com",
  "password": "CustomerPass123!"
}

# Step 6: Customer browses YOUR shop
# Include token in all requests:
GET /api/app-auth/123/products
Authorization: Bearer <jwt-token>
```

---

## 🔐 Using Same Email for Both

You CAN use the same email for both systems:

```bash
# 1. Register as platform admin
POST /api/auth/register
{
  "email": "gift@example.com",
  "password": "PlatformPass123!",
  "full_name": "Gift Sibiya"
}

# 2. Also register as app user (same email!)
POST /api/app-auth/123/auth/register
{
  "name": "Gift Sibiya",
  "email": "gift@example.com",  # Same email!
  "password": "AppPass123!"      # Different password
}

# 3. Login as platform admin
POST /api/auth/login
{
  "email": "gift@example.com",
  "password": "PlatformPass123!"  # Platform password
}

# 4. Login as app user
POST /api/app-auth/123/auth/login
{
  "email": "gift@example.com",
  "password": "AppPass123!"  # App password
}

# ✅ Both work independently!
```

---

## 🧪 Testing Commands

### Test Platform Admin Auth
```bash
# Register
curl -X POST http://localhost:4006/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "AdminPass123!",
    "full_name": "Test Admin"
  }'

# Login
curl -X POST http://localhost:4006/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "AdminPass123!"
  }' \
  --cookie-jar cookies.txt

# Verify (uses cookies)
curl -X POST http://localhost:4006/api/auth/verify \
  --cookie cookies.txt
```

### Test App User Auth
```bash
# Register
curl -X POST http://localhost:4006/api/app-auth/123/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "user@test.com",
    "password": "UserPass123!"
  }'

# Login
curl -X POST http://localhost:4006/api/app-auth/123/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "UserPass123!"
  }'

# Save the token from response, then verify
curl -X POST http://localhost:4006/api/app-auth/123/auth/verify \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

## 📚 Related Documentation

- [App User Auth Separation](./APP_USER_AUTH_SEPARATION.md)
- [Frontend Authentication Guide](./FRONTEND_AUTHENTICATION_GUIDE.md)
- [Backend Auth Improvements](./BACKEND_AUTH_IMPROVEMENTS.md)
- [SuperTokens Integration](./SUPERTOKENS_INTEGRATION.md)

---

## ✅ Summary

**Platform Admin Routes:** `/api/auth/*`
- Register/login to manage Skaftin
- SuperTokens authentication
- HTTP-only cookies
- Access to platform features

**App User Routes:** `/api/app-auth/:projectId/auth/*`
- Register/login to use YOUR applications
- JWT authentication
- Token-based
- Project-specific access

**Remember:** Always use the correct route for your use case! 🎯

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

