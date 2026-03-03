# 🚦 Which Authentication Route Should I Use?

**Quick decision guide for choosing the correct authentication endpoint**

---

## ❓ What are you trying to do?

### 🔷 Option 1: I want to manage the Skaftin platform

**You are:** Platform administrator, project manager, Skaftin user  
**You want to:** Create projects, manage settings, configure the platform

**Use:** `/api/auth` routes (Platform Admin Auth)

```bash
# Register
POST http://localhost:4006/api/auth/register
{
  "email": "admin@mycompany.com",
  "password": "AdminPass123!",
  "full_name": "Your Name"
}

# Login
POST http://localhost:4006/api/auth/login
{
  "email": "admin@mycompany.com",
  "password": "AdminPass123!"
}
```

**Authentication Method:** SuperTokens (cookies)  
**Where stored:** SuperTokens database  
**Access to:** Skaftin platform features

---

### 🔶 Option 2: I want to use an application built on Skaftin

**You are:** End-user, customer, application user  
**You want to:** Use an app/service built on Skaftin platform

**Use:** `/api/app-auth/:projectId/auth` routes (App User Auth)

```bash
# Register (replace 123 with your actual projectId)
POST http://localhost:4006/api/app-auth/123/auth/register
{
  "name": "Your Name",
  "email": "user@example.com",
  "password": "UserPass123!",
  "phone": "+1234567890"
}

# Login
POST http://localhost:4006/api/app-auth/123/auth/login
{
  "email": "user@example.com",
  "password": "UserPass123!"
}

# Use the returned JWT token for subsequent requests
Authorization: Bearer <jwt-token>
```

**Authentication Method:** JWT tokens  
**Where stored:** Project database (`project_123.app_users`)  
**Access to:** Application features (based on roles)

---

## 🎯 Decision Tree

```
Are you building/managing Skaftin itself?
│
├─ YES → Use /api/auth (Platform Admin)
│         • Register: POST /api/auth/register
│         • Login: POST /api/auth/login
│         • Uses SuperTokens cookies
│
└─ NO → Use /api/app-auth/:projectId/auth (App User)
          • Register: POST /api/app-auth/:projectId/auth/register
          • Login: POST /api/app-auth/:projectId/auth/login
          • Uses JWT tokens
```

---

## 💡 Real-World Examples

### Example 1: E-commerce Platform

**You (Platform Admin):**
```bash
POST /api/auth/register  # ← You register HERE
{
  "email": "owner@myshop.com",
  "password": "OwnerPass123!",
  "full_name": "Shop Owner"
}
```

**Your Customers (App Users):**
```bash
POST /api/app-auth/123/auth/register  # ← Your customers register HERE
{
  "name": "John Customer",
  "email": "john@customer.com",
  "password": "CustomerPass123!"
}
```

---

### Example 2: SaaS Application

**You (Platform Admin):**
```bash
POST /api/auth/register  # ← Manage Skaftin
{
  "email": "founder@saas.com",
  "password": "FounderPass123!",
  "full_name": "SaaS Founder"
}
```

**Your Subscribers (App Users):**
```bash
POST /api/app-auth/456/auth/register  # ← Use your SaaS
{
  "name": "Subscriber Name",
  "email": "subscriber@company.com",
  "password": "SubscriberPass123!"
}
```

---

### Example 3: Internal Company Tool

**You (Platform Admin):**
```bash
POST /api/auth/register  # ← Configure the tool
{
  "email": "it@company.com",
  "password": "ITPass123!",
  "full_name": "IT Admin"
}
```

**Your Employees (App Users):**
```bash
POST /api/app-auth/789/auth/register  # ← Use the tool
{
  "name": "Employee Name",
  "email": "employee@company.com",
  "password": "EmployeePass123!"
}
```

---

## 🚨 IMPORTANT: For Your Current Issue

**You said:** "i am still getting email already exists"

**The problem:** You're trying to register at the WRONG endpoint!

**What you're doing:**
```bash
POST /api/auth/register  # ❌ This is for PLATFORM ADMINS
{
  "email": "sibiya.bobo@gmail.com",
  ...
}
```

**What you should do:**

**IF** you want to test app user authentication:
```bash
POST /api/app-auth/YOUR_PROJECT_ID/auth/register  # ✅ This is for APP USERS
{
  "name": "Gift Sibiya",
  "email": "sibiya.bobo@gmail.com",
  "password": "asdfasdf"
}

# Replace YOUR_PROJECT_ID with actual project ID (e.g., 1, 2, 123, etc.)
```

**IF** you want to be a platform admin:
```bash
# I just deleted sibiya.bobo@gmail.com from SuperTokens
# So you can now register again at:
POST /api/auth/register  # ✅ Platform admin registration
{
  "email": "sibiya.bobo@gmail.com",
  "password": "asdfasdf",
  "full_name": "Gift Sibiya"
}
```

---

## 🔍 How to Find Your Project ID

```bash
# Login as platform admin first
POST /api/auth/login
{
  "email": "your-admin@email.com",
  "password": "your-password"
}

# Then get projects
GET /api/projects

# Response will show project IDs:
[
  {
    "id": 123,  # ← This is your projectId
    "name": "My Project",
    ...
  }
]
```

Then use that ID:
```bash
POST /api/app-auth/123/auth/register  # ← Use the ID here
```

---

## 📞 Quick Help

**Error:** "Email already exists" at `/api/auth/register`  
**Fix:** Email exists in SuperTokens. Either:
1. Use a different email
2. Delete the stale user via database/admin tooling
3. Or login instead of register

**Error:** "Email already exists" at `/api/app-auth/:projectId/auth/register`  
**Fix:** Email exists in that project's app_users. Either:
1. Use a different email
2. Login instead of register
3. Delete the user via Skaftin dashboard (Auth → Users)

**Error:** "Project not found"  
**Fix:** Invalid projectId in URL. Check your project ID via `/api/projects`

---

**TL;DR:**
- Platform admin? → `/api/auth/register`
- App user? → `/api/app-auth/:projectId/auth/register`

🔥 **Don't mix them up!** 🔥

