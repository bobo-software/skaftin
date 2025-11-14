# 🎨 Authentication Endpoints - Visual Guide

---

## 🏗️ Two Separate Authentication Systems

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SKAFTIN PLATFORM                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  🔷 PLATFORM ADMIN AUTH                                       │ │
│  │  Route: /api/auth                                             │ │
│  │  Tech: SuperTokens (cookies)                                  │ │
│  │  ─────────────────────────────────────────────────────────────│ │
│  │  POST /api/auth/register                                      │ │
│  │  POST /api/auth/login                                         │ │
│  │  POST /api/auth/logout                                        │ │
│  │  POST /api/auth/verify                                        │ │
│  │  ─────────────────────────────────────────────────────────────│ │
│  │  Who: Platform admins managing Skaftin                        │ │
│  │  Database: SuperTokens tables                                 │ │
│  │  Scope: Global (all projects)                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                              ↓↓↓                                    │
│                         Creates Projects                            │
│                              ↓↓↓                                    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Project 1            Project 2            Project 3          │ │
│  │  ────────────          ────────────          ────────────      │ │
│  │                                                                │ │
│  │  🔶 APP USER AUTH     🔶 APP USER AUTH     🔶 APP USER AUTH   │ │
│  │  /api/app-auth/1      /api/app-auth/2      /api/app-auth/3    │ │
│  │  Tech: JWT tokens     Tech: JWT tokens     Tech: JWT tokens   │ │
│  │  ──────────────────   ──────────────────   ──────────────────│ │
│  │  POST /auth/register  POST /auth/register  POST /auth/register│ │
│  │  POST /auth/login     POST /auth/login     POST /auth/login   │ │
│  │  POST /auth/verify    POST /auth/verify    POST /auth/verify  │ │
│  │  POST /auth/logout    POST /auth/logout    POST /auth/logout  │ │
│  │  ──────────────────   ──────────────────   ──────────────────│ │
│  │  Who: App end-users   Who: App end-users   Who: App end-users │ │
│  │  DB: project_1        DB: project_2        DB: project_3      │ │
│  │  Scope: Project 1     Scope: Project 2     Scope: Project 3   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Your Testing Scenario

### ✅ CORRECT Way to Test App User Auth

```bash
# Step 1: Get your project ID
curl http://localhost:4006/api/projects
# Look for "id" in the response, e.g., 1

# Step 2: Register as APP USER (replace 1 with your actual project ID)
curl -X POST http://localhost:4006/api/app-auth/1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gift Sibiya",
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf"
  }'

# Step 3: Login as APP USER
curl -X POST http://localhost:4006/api/app-auth/1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf"
  }'

# You'll get a JWT token in response - use it in future requests!
```

---

### ❌ WRONG Way (What you were doing)

```bash
# ❌ This registers a PLATFORM ADMIN (SuperTokens)
POST http://localhost:4006/api/auth/register
{
  "email": "sibiya.bobo@gmail.com",
  "password": "asdfasdf",
  "full_name": "Gift Sibiya"
}

# This creates a user in SuperTokens, NOT in app_users!
```

---

## 📋 Route Cheat Sheet

### Platform Admin Routes
```
Base: /api/auth

POST   /api/auth/register      → Register platform admin
POST   /api/auth/login         → Login platform admin
POST   /api/auth/logout        → Logout platform admin
POST   /api/auth/verify        → Verify session
```

### App User Routes
```
Base: /api/app-auth/:projectId/auth

POST   /api/app-auth/:projectId/auth/register   → Register app user
POST   /api/app-auth/:projectId/auth/login      → Login app user
POST   /api/app-auth/:projectId/auth/verify     → Verify JWT token
POST   /api/app-auth/:projectId/auth/logout     → Logout app user
```

### User Management Routes (Platform Admin Only)
```
Base: /api/app-auth/:projectId

GET    /api/app-auth/:projectId/users           → List users
POST   /api/app-auth/:projectId/users           → Create user (admin creates)
GET    /api/app-auth/:projectId/users/:userId   → Get user
PUT    /api/app-auth/:projectId/users/:userId   → Update user
DELETE /api/app-auth/:projectId/users/:userId   → Delete user
```

---

## 🔥 For Your Current Test

**Email:** sibiya.bobo@gmail.com  
**Status:** ✅ Cleaned from SuperTokens  
**Now available for:** Both platform admin AND app user registration

### Choose One:

**Option A: Register as Platform Admin**
```bash
curl -X POST http://localhost:4006/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf",
    "full_name": "Gift Sibiya"
  }'
```

**Option B: Register as App User (Recommended for testing)**
```bash
# First, find your project ID:
curl http://localhost:4006/api/projects

# Then register (replace 1 with your actual project ID):
curl -X POST http://localhost:4006/api/app-auth/1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gift Sibiya",
    "email": "sibiya.bobo@gmail.com",
    "password": "asdfasdf",
    "phone": "+27..."
  }'
```

---

## 💡 Pro Tip: Use Both!

You can use the SAME email for BOTH systems:

```bash
# 1. Register as platform admin
POST /api/auth/register
{
  "email": "sibiya.bobo@gmail.com",
  "password": "PlatformPass123!",
  "full_name": "Gift Sibiya"
}

# 2. Also register as app user (same email!)
POST /api/app-auth/1/auth/register
{
  "name": "Gift Sibiya",
  "email": "sibiya.bobo@gmail.com",
  "password": "AppPass123!"  # Different password!
}

# 3. Login as platform admin
POST /api/auth/login
{
  "email": "sibiya.bobo@gmail.com",
  "password": "PlatformPass123!"  # Platform password
}

# 4. Login as app user
POST /api/app-auth/1/auth/login
{
  "email": "sibiya.bobo@gmail.com",
  "password": "AppPass123!"  # App password
}
```

Both work independently! ✅

---

## 📚 Quick Reference URLs

| Purpose | URL Pattern | Example |
|---------|------------|---------|
| Platform Register | `/api/auth/register` | `http://localhost:4006/api/auth/register` |
| Platform Login | `/api/auth/login` | `http://localhost:4006/api/auth/login` |
| App Register | `/api/app-auth/:projectId/auth/register` | `http://localhost:4006/api/app-auth/1/auth/register` |
| App Login | `/api/app-auth/:projectId/auth/login` | `http://localhost:4006/api/app-auth/1/auth/login` |

---

**Remember:**
- 🔷 Platform = `/api/auth` (no projectId needed)
- 🔶 App Users = `/api/app-auth/:projectId/auth` (projectId required)

🚀 **Your email is now free - choose the right endpoint and register!**

