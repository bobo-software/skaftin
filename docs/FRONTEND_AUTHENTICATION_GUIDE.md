# Frontend Authentication Guide

**Last Updated:** November 12, 2025

This guide explains how to implement authentication in the Skaftin frontend application using SuperTokens cookie-based authentication.

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [AuthService Usage](#authservice-usage)
- [Making Authenticated Requests](#making-authenticated-requests)
- [Protected Routes](#protected-routes)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Skaftin uses **SuperTokens** for authentication, which provides:
- 🍪 **Cookie-based sessions** (more secure than localStorage tokens)
- 🔄 **Automatic token refresh** (no manual refresh logic needed)
- 🔒 **HTTP-only cookies** (immune to XSS attacks)
- 🚀 **Built-in session management**

### Key Concept: Cookies, Not Tokens

Unlike traditional JWT authentication, Skaftin uses **HTTP-only cookies** for authentication. This means:
- ❌ **DO NOT** send `Authorization` headers with tokens
- ✅ **DO** use `credentials: 'include'` in all fetch requests
- ❌ **DO NOT** manually refresh tokens
- ✅ **DO** let SuperTokens handle everything automatically

---

## Authentication Flow

### Login Flow

```
User enters email/password
        ↓
POST /api/auth/login
        ↓
SuperTokens validates credentials
        ↓
SuperTokens sets HTTP-only cookies
        ↓
Response: { success: true, data: { user, token } }
        ↓
Store "token" in localStorage (for UX only)
        ↓
Redirect to dashboard
```

### Making Authenticated Requests

```
User makes API request
        ↓
Browser automatically sends cookies
        ↓
SuperTokens middleware validates session
        ↓
Request processed with user context
        ↓
Response returned
```

### Logout Flow

```
User clicks logout
        ↓
POST /api/auth/logout
        ↓
SuperTokens revokes session
        ↓
Clears cookies
        ↓
Remove token from localStorage
        ↓
Redirect to login
```

---

## API Endpoints

### Platform Authentication (Skaftin Managers)

These endpoints are for users who manage the Skaftin platform (not app users).

#### 1. Register

**Endpoint:** `POST /api/auth/register`

**Request:**
```typescript
{
  email: string;
  password: string;
  full_name?: string; // Optional
}
```

**Response (Success):**
```typescript
{
  success: true,
  message: "User registered successfully",
  data: {
    user: {
      id: string;
      email: string;
      name: string;
    },
    token: "session-managed-by-supertokens", // Not a real token!
    accessToken: "session-managed-by-supertokens",
    refreshToken: "session-managed-by-supertokens"
  }
}
```

**Response (Error):**
```typescript
{
  success: false,
  message: "Email already registered",
  error: "..."
}
```

**Example:**
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // 🔥 CRITICAL
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    full_name: 'John Doe'
  })
});
```

---

#### 2. Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```typescript
{
  email: string;
  password: string;
}
```

**Response (Success):**
```typescript
{
  success: true,
  message: "Login successful",
  data: {
    user: {
      id: string;
      email: string;
      name: string;
    },
    token: "session-managed-by-supertokens",
    accessToken: "session-managed-by-supertokens",
    refreshToken: "session-managed-by-supertokens"
  }
}
```

**Response (Error):**
```typescript
{
  success: false,
  message: "Invalid email or password",
  error: "..."
}
```

**Example:**
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // 🔥 CRITICAL
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
```

---

#### 3. Logout

**Endpoint:** `POST /api/auth/logout`

**Request:** No body required

**Response:**
```typescript
{
  success: true,
  message: "Logged out successfully"
}
```

**Example:**
```typescript
const response = await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include', // 🔥 CRITICAL
});
```

---

#### 4. Verify Session

**Endpoint:** `POST /api/auth/verify`

**Request:** No body required (session from cookies)

**Response:**
```typescript
{
  success: true,
  message: "Token is valid",
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      projectIds: string[];
      role: string;
    }
  }
}
```

**Example:**
```typescript
const response = await fetch('/api/auth/verify', {
  method: 'POST',
  credentials: 'include', // 🔥 CRITICAL
});
```

---

## AuthService Usage

The `AuthService` class (`frontend/src/services/AuthService.ts`) provides a convenient wrapper for authentication operations.

### Import

```typescript
import AuthService from '@/services/AuthService';
```

### Methods

#### `login(email: string, password: string)`

```typescript
const result = await AuthService.login('user@example.com', 'password123');

if (result.success) {
  console.log('Logged in as:', result.user);
  // Redirect to dashboard
} else {
  console.error('Login failed:', result.error);
  // Show error message
}
```

#### `register(email: string, password: string, fullName?: string)`

```typescript
const result = await AuthService.register(
  'newuser@example.com',
  'SecurePass123!',
  'John Doe'
);

if (result.success) {
  console.log('Registered and logged in:', result.user);
  // Redirect to dashboard
} else {
  console.error('Registration failed:', result.error);
}
```

#### `logout()`

```typescript
await AuthService.logout();
// User is now logged out
// Redirect to login page
```

#### `isAuthenticated()`

```typescript
if (AuthService.isAuthenticated()) {
  console.log('User is logged in');
} else {
  console.log('User is not logged in');
}
```

**Note:** This only checks if a token exists in localStorage (for UX). The actual session validation happens on the backend.

---

## Making Authenticated Requests

### Critical Rule: Always Use `credentials: 'include'`

**Every API request** that requires authentication must include `credentials: 'include'`:

```typescript
const response = await fetch('/api/projects', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // 🔥 CRITICAL: Sends auth cookies
});
```

### Using RequestUtils

The `RequestUtils` class (`frontend/src/utils/RequestUtils.ts`) already includes `credentials: 'include'` by default:

```typescript
import RequestUtils from '@/utils/RequestUtils';

// GET request
const data = await RequestUtils.get<Project[]>('/api/projects');

// POST request
const newProject = await RequestUtils.post<Project>(
  '/api/projects',
  null, // No access token needed
  { name: 'My Project', description: 'Test' }
);

// PUT request
const updated = await RequestUtils.put<Project>(
  `/api/projects/${projectId}`,
  null, // No access token needed
  { name: 'Updated Name' }
);

// DELETE request
await RequestUtils.delete(`/api/projects/${projectId}`);
```

### Using Services

Most API operations should go through service classes:

```typescript
import ProjectsService from '@/services/ProjectsService';
import DatabaseService from '@/services/DatabaseService';

// Fetch projects
const projects = await ProjectsService.getProjects();

// Create table
const table = await DatabaseService.createTable(projectId, {
  tableName: 'users',
  columns: [...]
});
```

---

## Protected Routes

### Using ProtectedRoute Component

Wrap protected pages with the `ProtectedRoute` component:

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

### ProtectedRoute Implementation

```typescript
import { Navigate } from 'react-router-dom';
import AuthService from '@/services/AuthService';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = AuthService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

---

## Common Patterns

### Pattern 1: Login Page

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '@/services/AuthService';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await AuthService.login(email, password);

    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Pattern 2: Register Page

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '@/services/AuthService';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await AuthService.register(email, password, fullName);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full Name"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Register'}
      </button>
    </form>
  );
}
```

### Pattern 3: Logout Button

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '@/services/AuthService';

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await AuthService.logout();
    navigate('/login');
  };

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}
```

### Pattern 4: Fetch Data on Component Mount

```typescript
import React, { useEffect, useState } from 'react';
import ProjectsService from '@/services/ProjectsService';

function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await ProjectsService.getProjects();
        setProjects(data);
      } catch (err) {
        setError('Failed to load projects');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {projects.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
}
```

### Pattern 5: Handle Unauthorized (401) Errors

```typescript
import RequestUtils from '@/utils/RequestUtils';
import AuthService from '@/services/AuthService';
import { useNavigate } from 'react-router-dom';

function SomeComponent() {
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const data = await RequestUtils.get('/api/projects');
      return data;
    } catch (error: any) {
      if (error.status === 401) {
        // Session expired or invalid
        AuthService.removeToken();
        navigate('/login');
      }
      throw error;
    }
  };
}
```

---

## Best Practices

### ✅ DO

1. **Always use `credentials: 'include'`** in fetch requests
   ```typescript
   fetch('/api/endpoint', { credentials: 'include' })
   ```

2. **Use AuthService for authentication operations**
   ```typescript
   await AuthService.login(email, password);
   ```

3. **Use service classes for API calls**
   ```typescript
   await ProjectsService.getProjects();
   ```

4. **Check authentication before protected routes**
   ```typescript
   <ProtectedRoute><Dashboard /></ProtectedRoute>
   ```

5. **Handle errors gracefully**
   ```typescript
   try {
     await fetchData();
   } catch (error) {
     console.error('Error:', error);
     setError('Failed to load data');
   }
   ```

6. **Clear localStorage on logout**
   ```typescript
   AuthService.removeToken();
   ```

### ❌ DON'T

1. **Don't send Authorization headers**
   ```typescript
   // ❌ WRONG
   fetch('/api/endpoint', {
     headers: { Authorization: `Bearer ${token}` }
   });
   ```

2. **Don't manually refresh tokens**
   ```typescript
   // ❌ WRONG - SuperTokens handles this automatically
   if (tokenExpired()) {
     await refreshToken();
   }
   ```

3. **Don't store sensitive data in localStorage**
   ```typescript
   // ❌ WRONG
   localStorage.setItem('password', password);
   localStorage.setItem('session', sessionData);
   ```

4. **Don't trust localStorage for authentication**
   ```typescript
   // ❌ WRONG - only use for UX
   if (localStorage.getItem('token')) {
     // User is authenticated
   }
   ```

5. **Don't forget error handling**
   ```typescript
   // ❌ WRONG
   const data = await fetch('/api/endpoint');
   // Always check response and handle errors
   ```

---

## Troubleshooting

### Issue 1: "Unauthorized" errors after login

**Symptoms:**
- Login succeeds
- But subsequent API calls return 401 Unauthorized

**Solution:**
Make sure you're using `credentials: 'include'` in all fetch requests:

```typescript
// ✅ CORRECT
fetch('/api/projects', {
  credentials: 'include'
});

// ❌ WRONG
fetch('/api/projects');
```

---

### Issue 2: CORS errors

**Symptoms:**
- Browser console shows CORS errors
- Requests fail with "No 'Access-Control-Allow-Origin' header"

**Solution:**
1. Make sure backend CORS is configured correctly (it should be)
2. Use the Vite proxy for development (already configured in `vite.config.ts`)
3. Ensure `credentials: 'include'` is present

---

### Issue 3: Session expired after page refresh

**Symptoms:**
- User is logged in
- After refresh, they're logged out

**Possible Causes:**
1. Cookies are being cleared
2. Cookie domain mismatch
3. Browser privacy settings blocking cookies

**Solution:**
1. Check browser console for cookie warnings
2. Verify `COOKIE_DOMAIN` in backend `.env` matches your domain
3. Disable ad blockers temporarily
4. Clear browser cookies and try again

---

### Issue 4: Login works but user data not persisted

**Symptoms:**
- Login successful
- User redirected to dashboard
- But user info not available

**Solution:**
Fetch user data after login or use session verification:

```typescript
const result = await AuthService.login(email, password);

if (result.success && result.user) {
  // Store user in state/context
  setUser(result.user);
  
  // Or verify session to get full user data
  const verifyResponse = await fetch('/api/auth/verify', {
    method: 'POST',
    credentials: 'include'
  });
  const verifyData = await verifyResponse.json();
  setUser(verifyData.data.user);
}
```

---

### Issue 5: "Multiple session cookies" error

**Symptoms:**
- Error: "The request contains multiple session cookies"

**Solution:**
1. Clear all cookies for the domain
2. Logout and login again
3. This happens when cookie domain changes - clear old cookies

---

## Additional Resources

### Backend Documentation
- [SuperTokens Integration](./SUPERTOKENS_INTEGRATION.md)
- [Auth System Implementation](./AUTH_SYSTEM_IMPLEMENTATION.md)
- [Backend Architecture](./BACKEND_ARCHITECTURE.md)

### Frontend Files
- `frontend/src/services/AuthService.ts` - Authentication service
- `frontend/src/utils/RequestUtils.ts` - HTTP request wrapper
- `frontend/src/components/auth/ProtectedRoute.tsx` - Route protection

### Backend Files
- `src/routers/AuthCompatibilityRouter.ts` - Authentication endpoints
- `src/config/supertokens.ts` - SuperTokens configuration
- `src/middleware/supertokensAuthMiddleware.ts` - Auth middleware

---

## Quick Reference

### Authentication Checklist

- [ ] Import `AuthService` for auth operations
- [ ] Use `credentials: 'include'` in all fetch requests
- [ ] Handle login/register success and error states
- [ ] Implement logout functionality
- [ ] Protect routes with authentication check
- [ ] Handle 401 errors (redirect to login)
- [ ] Clear localStorage on logout
- [ ] Use service classes for API calls
- [ ] Never send Authorization headers (cookies handle it)
- [ ] Test authentication flow end-to-end

### Common Imports

```typescript
// Authentication
import AuthService from '@/services/AuthService';

// API Utilities
import RequestUtils from '@/utils/RequestUtils';

// Services
import ProjectsService from '@/services/ProjectsService';
import DatabaseService from '@/services/DatabaseService';
import StorageService from '@/services/StorageService';

// Navigation
import { useNavigate, Navigate } from 'react-router-dom';
```

---

**Last Updated:** November 12, 2025

**Version:** 1.0.0

**Maintained by:** Skaftin Development Team

