# Client SDK - Application User Authentication

## Overview

This guide covers authenticating **your application's end users** (not the client app itself). The app user system provides complete user management, role-based access control, and customizable user profiles.

> **Prerequisites:** Complete `02-AUTHENTICATION.md` first to set up platform authentication with API keys/tokens.

---

## Architecture

### Two-Layer Authentication

**Layer 1: Platform Authentication** (Required - See `02-AUTHENTICATION.md`)
- Uses API keys (`sk_...`) or access tokens (`sat_...`)
- Authenticates your client application with Skaftin
- Required in headers for ALL requests
- Example: `x-api-key: sk_your_key`

**Layer 2: App User Authentication** (This Guide)
- Authenticates your app's end users
- Email/password authentication with SuperTokens sessions
- Session-based with configurable durations
- Role-based access control
- Secure HTTP-only session management
- Built on top of platform authentication

**Key Concept:** Your API key identifies the project, so you don't need to include project ID in URLs anymore!

---

## 🔐 Password Reset / Forgot Password

If users forget their password, use the secure OTP-based password reset flow:

**See:** [`08-FORGOT-PASSWORD.md`](./08-FORGOT-PASSWORD.md) for complete documentation.

**Quick Example:**
```typescript
// 1. Send OTP
await AuthService.sendForgotPasswordOTP('user@example.com', {
  apiKey: 'sk_your_key',
  method: 'email'
});

// 2. Verify OTP
const result = await AuthService.verifyForgotPasswordOTP('user@example.com', '123456', {
  apiKey: 'sk_your_key'
});
const resetToken = result.data.reset_token;

// 3. Reset Password
await AuthService.resetPassword('user@example.com', resetToken, 'NewPassword123!', {
  apiKey: 'sk_your_key'
});
```

**Security:** App users are completely isolated from platform admins. The same email can exist as both.

---

## Authentication Endpoints

These endpoints allow your app's users to register and log in. **No authentication required** for these endpoints, but you must include your API key/token to identify the project.

### Register New User

```typescript
POST /app-api/auth/auth/register

Headers:
{
  "X-API-Key": "sk_your_api_key",     // Your platform credential (capital X)
  "Content-Type": "application/json"
}

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "phone": "+1234567890",              // Optional
  "role_key": "user",                   // Optional - role to assign
  "otp_method": "email",                // Optional: "email" | "sms" | null
  "metadata": {                         // Optional custom data
    "department": "Engineering",
    "employee_id": "EMP001"
  }
}

Response (No OTP):
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "is_active": true
    },
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."  // SuperTokens access token
      // Refresh token is handled automatically via /auth/session/refresh
    },
    "requires_otp_verification": false
  }
}

Response (With OTP):
{
  "success": true,
  "message": "User registered successfully. Please check your email for the OTP code to activate your account.",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "is_active": false                // User inactive until OTP verified
    },
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."
    },
    "requires_otp_verification": true,
    "otp_method": "email",
    "message": "Check your email for OTP code. Your account will be activated after verification."
  }
}
```

**OTP Method Options:**
- `"email"` - Send OTP via email (requires email provider configured)
- `"sms"` - Send OTP via SMS (requires SMS provider configured and phone number)
- `null` or omitted - No OTP, user activated immediately

### Login User

```typescript
POST /app-api/auth/auth/login

Headers:
{
  "X-API-Key": "sk_your_api_key",
  "Content-Type": "application/json"
}

Body:
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "roles": [
        {
          "id": 2,
          "role_name": "User",
          "role_key": "user"
        }
      ],
      "is_active": true
    },
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."  // SuperTokens access token
      // Refresh token is handled automatically via /auth/session/refresh
    }
  }
}
```

### Verify Session

```typescript
POST /app-api/auth/auth/verify

Headers:
{
  "X-API-Key": "sk_your_api_key",
  "Authorization": "Bearer <accessToken>"  // SuperTokens access token
}

Response:
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "roles": [...],
      "is_active": true
    }
  }
}
```

### Logout

```typescript
POST /app-api/auth/auth/logout

Headers:
{
  "X-API-Key": "sk_your_api_key",
  "Authorization": "Bearer <accessToken>"  // SuperTokens access token
}

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note:** This endpoint revokes the SuperTokens session server-side. You should also remove the access token from client storage.

### Verify OTP

After registration with `otp_method`, users must verify their OTP code to activate their account.

```typescript
POST /app-api/auth/auth/verify-otp

Headers:
{
  "X-API-Key": "sk_your_api_key",
  "Content-Type": "application/json"
}

Body (Option 1 - Using user_id):
{
  "user_id": 123,
  "code": "123456"
}

Body (Option 2 - Using email):
{
  "email": "john@example.com",
  "code": "123456"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully. Your account is now active!",
  "data": {
    "user": {
      "id": 123,
      "email": "john@example.com",
      "is_active": true,
      "email_verified": true  // or phone_verified: true for SMS
    }
  }
}

Response (Invalid OTP):
{
  "success": false,
  "message": "Invalid OTP code. 2 attempt(s) remaining.",
  "statusCode": 400
}

Response (Expired OTP):
{
  "success": false,
  "message": "OTP code has expired. Please request a new OTP code.",
  "statusCode": 400
}

Response (Max Attempts):
{
  "success": false,
  "message": "Maximum verification attempts exceeded. Please request a new OTP code.",
  "statusCode": 400
}
```

**OTP Details:**
- 6-digit numeric code
- Valid for 10 minutes
- Maximum 3 verification attempts
- After verification, user is activated and can log in

### Refresh Session Token

When the access token expires, refresh it using SuperTokens' refresh endpoint:

```typescript
POST /auth/session/refresh

Headers:
{
  "Authorization": "Bearer <accessToken>"  // Current access token
}

Response:
{
  "status": "OK",
  "accessToken": "...",  // New access token
  "refreshToken": "..."  // New refresh token (if using cookies, handled automatically)
}
```

**Note:** SuperTokens automatically handles token refresh. Your client should implement retry logic to refresh tokens when API calls return 401 (Unauthorized).

---

## User Management API

All user management endpoints require **both** platform authentication (API key) **and** platform admin authorization (SuperTokens session).

Base URL: `/app-api/auth`

> **Note:** These endpoints are for **platform admins** managing users, not for end-user self-service. Project ID is automatically extracted from your API key.

### List Users

```typescript
GET /app-api/auth/users

Query Parameters:
- search?: string         // Search by name or email
- role_id?: number        // Filter by role
- is_active?: boolean     // Filter by status
- page?: number           // Page number (default: 1)
- limit?: number          // Items per page (default: 50)

Response:
{
  success: true,
  data: {
    users: AppUser[],
    pagination: {
      page: 1,
      limit: 50,
      total: 100,
      totalPages: 2
    }
  }
}
```

### Get Single User

```typescript
GET /app-api/auth/users/:userId

Response:
{
  success: true,
  data: {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    metadata: { department: "Engineering" },
    is_active: true,
    email_verified: true,
    roles: [
      { id: 2, role_name: "User", role_key: "user" }
    ],
    created_at: "2025-11-12T10:00:00Z",
    updated_at: "2025-11-12T10:00:00Z"
  }
}
```

### Create User

```typescript
POST /app-api/auth/users

Body:
{
  name: "John Doe",
  email: "john@example.com",
  password: "securePassword123",
  phone: "+1234567890",           // Optional
  metadata: {                      // Custom fields
    department: "Engineering",
    employee_id: "EMP001"
  },
  role_ids: [2]                    // Optional, defaults to default role
}

Response:
{
  success: true,
  message: "User created successfully",
  data: { /* User object */ }
}
```

### Update User

```typescript
PUT /app-api/auth/users/:userId

Body:
{
  name?: "Updated Name",
  email?: "newemail@example.com",
  phone?: "+9876543210",
  metadata?: { department: "Sales" },
  is_active?: false
}

Response:
{
  success: true,
  message: "User updated successfully",
  data: { /* Updated user object */ }
}
```

### Delete User

```typescript
DELETE /app-api/auth/users/:userId?permanent=false

Query Parameters:
- permanent=true   // Permanent deletion (also removes from SuperTokens)
- permanent=false  // Soft delete (deactivates user, default)

Response:
{
  success: true,
  message: "User deactivated successfully"
}
```

---

## Role Management API

### List Roles

```typescript
GET /app-api/auth/roles?include_user_count=true

Response:
{
  success: true,
  data: [
    {
      id: 1,
      role_name: "Admin",
      role_key: "admin",
      description: "Administrator with full access",
      permissions: ["*"],
      session_duration_minutes: 60,
      is_system_role: true,
      user_count: 5,
      created_at: "2025-11-12T10:00:00Z"
    }
  ]
}
```

### Create Role

```typescript
POST /app-api/auth/roles

Body:
{
  role_name: "Manager",
  role_key: "manager",              // Lowercase, alphanumeric + underscore
  description: "Department manager",
  permissions: ["read", "write"],    // Custom permission array
  session_duration_minutes: 1440     // 1 day
}

Response:
{
  success: true,
  data: { /* Role object */ }
}
```

### Assign Role to User

```typescript
POST /app-api/auth/users/:userId/roles

Body:
{
  role_id: 3
}

Response:
{
  success: true,
  message: "Role assigned successfully"
}
```

### Remove Role from User

```typescript
DELETE /app-api/auth/users/:userId/roles/:roleId

Response:
{
  success: true,
  message: "Role removed successfully"
}
```

---

## Custom Fields API

### List Custom Fields

```typescript
GET /app-api/auth/fields?include_inactive=false

Response:
{
  success: true,
  data: [
    {
      id: 1,
      field_name: "department",
      field_label: "Department",
      field_type: "select",
      is_required: true,
      options: ["Engineering", "Sales", "Marketing"],
      is_active: true
    }
  ]
}
```

### Create Custom Field

```typescript
POST /app-api/auth/fields

Body:
{
  field_name: "employee_id",
  field_label: "Employee ID",
  field_type: "text",               // text, number, boolean, date, select, multi_select, reference
  is_required: true,
  options: ["Option1", "Option2"],  // For select/multi_select
  reference_table: "departments",   // For reference type
  reference_column: "id"            // For reference type
}

Response:
{
  success: true,
  data: { /* Custom field object */ }
}
```

### Apply Custom Field (Add DB Column)

```typescript
POST /app-api/auth/fields/:fieldId/apply

Response:
{
  success: true,
  message: "Column 'employee_id' added to app_users table successfully"
}
```

---

## Auth Settings API

### Get Auth Settings

```typescript
GET /app-api/auth/settings

Response:
{
  success: true,
  data: {
    allow_duplicate_emails: false,
    require_email_verification: false,
    enable_password_reset: true,
    registration_enabled: true,
    auth_enabled: true,
    default_role_id: 2,
    email_provider_id: 1
  }
}
```

### Update Auth Settings

```typescript
PUT /app-api/auth/settings

Body:
{
  allow_duplicate_emails?: boolean,
  require_email_verification?: boolean,
  enable_password_reset?: boolean,
  registration_enabled?: boolean,
  auth_enabled?: boolean,
  default_role_id?: number,
  email_provider_id?: number
}
```

---

## SuperTokens Integration (Recommended)

The current implementation uses **SuperTokens React SDK** for session management, which provides automatic token refresh, secure cookie handling, and built-in session management. Here's how to set it up:

### Step 1: Install SuperTokens

```bash
npm install supertokens-auth-react
```

### Step 2: Configure SuperTokens

Create `src/config/supertokens.ts`:

```typescript
/**
 * SuperTokens Configuration
 * 
 * Configures SuperTokens React SDK for session management with Skaftin backend
 */
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import Session from 'supertokens-auth-react/recipe/session';

const apiUrl = import.meta.env.VITE_SKAFTIN_API_URL || 'http://localhost:4006';
const websiteDomain = window.location.origin;

// Initialize SuperTokens with Skaftin configuration
SuperTokens.init({
  appInfo: {
    appName: 'Your App Name',
    apiDomain: apiUrl,
    websiteDomain: websiteDomain,
    apiBasePath: '/app-api/auth', // Important: Use /app-api/auth
    websiteBasePath: '/auth',
  },
  recipeList: [
    EmailPassword.init({
      // Override API endpoints to match Skaftin's custom structure
      override: {
        apis: (originalImplementation) => {
          return {
            ...originalImplementation,
            signInPOST: async (input) => {
              // Use Skaftin's custom login endpoint
              const response = await fetch(`${apiUrl}/app-api/auth/auth/login`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': import.meta.env.VITE_SKAFTIN_API_KEY || import.meta.env.VITE_SKAFTIN_API || '',
                },
                credentials: 'include',
                body: JSON.stringify({
                  email: input.formFields.find((f) => f.id === 'email')?.value,
                  password: input.formFields.find((f) => f.id === 'password')?.value,
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                return {
                  status: 'GENERAL_ERROR',
                  message: data.message || data.error || 'Login failed',
                };
              }

              if (data.success && data.data?.session?.accessToken) {
                // Store accessToken in AuthStore for use in API requests
                const useAuthStore = (await import('@/stores/data/AuthStore')).default;
                const user = data.data.user;
                const accessToken = data.data.session.accessToken;
                
                const primaryRole = user.roles?.[0]?.role_key || 'user';
                await useAuthStore.getState().login({
                  id: user.id.toString(),
                  name: user.name || '',
                  email: user.email || '',
                  role: primaryRole,
                  accessToken: accessToken,
                  surname: '',
                  roles: user.roles || [],
                });

                return {
                  status: 'OK',
                  user: {
                    id: user.id.toString(),
                    email: user.email,
                  },
                };
              }

              return {
                status: 'GENERAL_ERROR',
                message: data.message || 'Login failed',
              };
            },
          };
        },
      },
    }),
    Session.init({
      // Session will automatically handle token refresh
      // It will call /app-api/auth/session/refresh automatically
    }),
  ],
});

export default SuperTokens;
export { Session, EmailPassword };
```

### Step 3: Initialize SuperTokens in main.tsx

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './config/supertokens' // Initialize SuperTokens

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### Step 4: Create Zustand AuthStore

Create `src/stores/data/AuthStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { SessionUser, UserChurchType } from '@/types/Types';
import { skaftinClient } from '@/backend';
import ApiRoutes from '@/constants/ApiRoutes';
import Session from 'supertokens-auth-react/recipe/session';

interface AuthState {
  sessionUser: SessionUser | null;
  login: (userData: SessionUser) => void;
  logout: () => void;
  isAdmin: () => boolean;
  fetchUserChurchId: (userId: number) => Promise<number | null>;
  getUserChurchId: () => number | null;
}

// Custom storage object to handle localStorage operations
const storage: PersistStorage<AuthState> = {
  getItem: (key: string) => {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as StorageValue<AuthState>) : null;
  },
  setItem: (key: string, value: StorageValue<AuthState>) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionUser: null,
      login: async (userData: SessionUser) => {
        set({ sessionUser: userData });
        // Fetch church_id for non-admin users
        if (!userData.roles?.some(role => role.role_key === 'admin')) {
          const userId = parseInt(userData.id);
          if (!isNaN(userId)) {
            const churchId = await get().fetchUserChurchId(userId);
            if (churchId) {
              set({ sessionUser: { ...userData, churchId } });
            }
          }
        }
        toast.success('Login successful');
      },
      logout: async () => {
        try {
          // Sign out from SuperTokens session (handles server-side logout)
          await Session.signOut();
        } catch (error) {
          console.error('Error during logout:', error);
        } finally {
          set({ sessionUser: null });
          toast.success('Logout successful');
        }
      },
      isAdmin: () => {
        const { sessionUser } = get();
        if (!sessionUser || !sessionUser.roles) return false;
        return sessionUser.roles.some(role => role.role_key === 'admin');
      },
      fetchUserChurchId: async (userId: number): Promise<number | null> => {
        try {
          const response = await skaftinClient.post<UserChurchType[]>(
            ApiRoutes.userChurches.getAll,
            {
              where: { user_id: userId }
            }
          );
          if (response.success && response.data.length > 0) {
            return response.data[0].church_id;
          }
          return null;
        } catch (error) {
          console.error('Failed to fetch user church_id:', error);
          return null;
        }
      },
      getUserChurchId: (): number | null => {
        const { sessionUser } = get();
        return sessionUser?.churchId || null;
      },
    }),
    {
      name: 'auth',
      storage,
    }
  )
);

export default useAuthStore;
```

### Step 5: Login Component Example

```typescript
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import useAuthStore from '@/stores/data/AuthStore';
import { useNavigate } from 'react-router-dom';
import ApiRoutes from '@/constants/ApiRoutes';
import RequestUtils from '@/utils/RequestUtils';
import { LoginResponse } from '@/types/Types';

const LoginPage = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    method: 'email',
  });

  const handleLogin = async () => {
    setLoading(true);

    try {
      const response: LoginResponse = await RequestUtils.fetch(
        ApiRoutes.login, 
        'POST', 
        form
      );

      if (response && response.success) {
        const user = response.data?.user;
        const accessToken = response.data?.session?.accessToken;
        
        if (!user || !accessToken) {
          toast.error('Invalid response from server');
          return;
        }
        
        const primaryRole = user.roles?.[0]?.role_key || 'user';
        
        // Store user data and accessToken in auth store
        await login({
          id: user.id?.toString() || '',
          name: user.name || '',
          username: user.email || '',
          role: primaryRole,
          method: 'email',
          accessToken: accessToken,
          surname: '',
          roles: user.roles || []
        });

        toast.success('Login successful!');
        const isAdmin = user.roles?.some(role => role.role_key === 'admin');
        navigate(isAdmin ? '/admin/dashboard' : '/admin/home');
      } else {
        toast.error(response?.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <input
        type="email"
        name="username"
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
        placeholder="Email"
        required
      />
      <input
        type="password"
        name="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Sign in'}
      </button>
    </form>
  );
};

export default LoginPage;
```

**Key Benefits of SuperTokens Integration:**
- ✅ Automatic token refresh handling
- ✅ Secure HTTP-only cookies (optional)
- ✅ Built-in session management
- ✅ CSRF protection
- ✅ Seamless integration with Skaftin backend

---

## Usage Examples

### Example 1: Create App User Auth Service (Alternative - Direct API)

```typescript
// src/backend/services/AppUserAuthService.ts
import { post } from '../utils/request';
import { getAuthHeaders } from '../utils/auth';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  metadata?: any;
  is_active: boolean;
  roles?: Role[];
}

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  metadata?: any;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AppUser;
  session: {
    accessToken: string;
  };
}

/**
 * Service for app user authentication (register, login, verify, logout)
 */
class AppUserAuthService {
  private basePath = '/app-api/auth/auth';

  /**
   * Register a new app user
   */
  async register(data: RegisterRequest) {
    return post<AuthResponse>(`${this.basePath}/register`, data);
  }

  /**
   * Login an existing app user
   */
  async login(credentials: LoginRequest) {
    return post<AuthResponse>(`${this.basePath}/login`, credentials);
  }

  /**
   * Verify a SuperTokens session token
   */
  async verify(accessToken: string) {
    const response = await fetch(`${this.basePath}/verify`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.json();
  }

  /**
   * Logout and revoke session
   */
  async logout(accessToken: string) {
    // Call logout endpoint to revoke session server-side
    const result = await post(`${this.basePath}/logout`, {}, {
      'Authorization': `Bearer ${accessToken}`,
    });
    
    // Remove token client-side
    this.removeToken();
    
    return result;
  }

  /**
   * Refresh access token using SuperTokens refresh endpoint
   */
  async refreshToken(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('/auth/session/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for SuperTokens
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.accessToken) {
        // Store new access token
        this.storeToken(data.accessToken);
        return data.accessToken;
      }

      return null;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Token refresh failed - user needs to log in again
      this.removeToken();
      return null;
    }
  }

  /**
   * Store access token in localStorage
   */
  storeToken(accessToken: string) {
    localStorage.setItem('app_user_access_token', accessToken);
  }

  /**
   * Get stored access token
   */
  getToken(): string | null {
    return localStorage.getItem('app_user_access_token');
  }

  /**
   * Remove stored token
   */
  removeToken() {
    localStorage.removeItem('app_user_access_token');
  }

  /**
   * Check if user is logged in (has access token)
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Make authenticated request with automatic token refresh on 401
   */
  async authenticatedFetch(url: string, options: RequestInit = {}) {
    let accessToken = this.getToken();

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    // Add authorization header
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      const newToken = await this.refreshToken(accessToken);
      
      if (newToken) {
        // Retry request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // Refresh failed - redirect to login
        this.removeToken();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  }
}

export default new AppUserAuthService();
```

### Example 2: Create Admin User Management Service

For platform admins to manage users (requires SuperTokens authentication):

```typescript
// src/backend/services/UserManagementService.ts
import { post, get, put, del } from '../utils/request';
// Note: getProjectId is no longer needed - project is extracted from API key

export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  metadata?: any;
  is_active: boolean;
  roles?: Role[];
}

/**
 * Service for platform admins to manage app users
 * Requires SuperTokens authentication (platform admin session)
 */
class UserManagementService {
  private getBasePath() {
    // Project ID is automatically extracted from API key
    return `/app-api/auth`;
  }

  async listUsers(options?: {
    search?: string;
    role_id?: number;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.role_id) params.append('role_id', String(options.role_id));
    if (options?.is_active !== undefined) params.append('is_active', String(options.is_active));
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));

    const query = params.toString() ? `?${params}` : '';
    return get<{ users: AppUser[]; pagination: any }>(`${this.getBasePath()}/users${query}`);
  }

  async getUser(userId: number) {
    return get<AppUser>(`${this.getBasePath()}/users/${userId}`);
  }

  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    metadata?: any;
    role_ids?: number[];
  }) {
    return post<AppUser>(`${this.getBasePath()}/users`, userData);
  }

  async updateUser(userId: number, updates: {
    name?: string;
    email?: string;
    phone?: string;
    metadata?: any;
    is_active?: boolean;
  }) {
    return put<AppUser>(`${this.getBasePath()}/users/${userId}`, updates);
  }

  async deleteUser(userId: number, permanent: boolean = false) {
    return del(`${this.getBasePath()}/users/${userId}?permanent=${permanent}`);
  }

  async assignRole(userId: number, roleId: number) {
    return post(`${this.getBasePath()}/users/${userId}/roles`, { role_id: roleId });
  }

  async removeRole(userId: number, roleId: number) {
    return del(`${this.getBasePath()}/users/${userId}/roles/${roleId}`);
  }
}

export default new UserManagementService();
```

### Example 3: User Registration Flow (No OTP)

```typescript
// In your React component
import AppUserAuthService from './backend/services/AppUserAuthService';

const RegisterForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (formData: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await AppUserAuthService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        otp_method: null,  // No OTP - user activated immediately
        metadata: {
          company: formData.company,
          department: formData.department
        }
      });

      if (response.success) {
        // Store the SuperTokens access token
        AppUserAuthService.storeToken(response.data.session.accessToken);
        
        console.log('User registered:', response.data.user);
        console.log('Access token stored');
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      {error && <div className="error">{error}</div>}
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};
```

### Example 3b: User Registration Flow with OTP

```typescript
// In your React component
import AppUserAuthService from './backend/services/AppUserAuthService';

const RegisterWithOTPForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [otpMethod, setOtpMethod] = useState<'email' | 'sms'>('email');

  const handleRegister = async (formData: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await AppUserAuthService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role_key: 'user',
        otp_method: otpMethod  // 'email' or 'sms'
      });

      if (response.success) {
        if (response.data.requires_otp_verification) {
          // Show OTP input form
          setUserId(response.data.user.id);
          setShowOTPInput(true);
          console.log(`OTP sent via ${response.data.otp_method}`);
        } else {
          // User activated immediately
          AppUserAuthService.storeToken(response.data.session.accessToken);
          window.location.href = '/dashboard';
        }
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otpCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/app-api/auth/auth/verify-otp', {
        method: 'POST',
        headers: {
          'X-API-Key': 'sk_your_api_key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          code: otpCode
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('OTP verified! User activated.');
        // Now login the user
        const loginResponse = await AppUserAuthService.login({
          email: formData.email,
          password: formData.password
        });
        
        if (loginResponse.success) {
          AppUserAuthService.storeToken(loginResponse.data.session.accessToken);
          window.location.href = '/dashboard';
        }
      } else {
        setError(data.message || 'Invalid OTP code');
      }
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      setError(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (showOTPInput) {
    return (
      <div>
        <h2>Verify Your {otpMethod === 'email' ? 'Email' : 'Phone'}</h2>
        <p>Enter the 6-digit code sent to your {otpMethod}</p>
        {error && <div className="error">{error}</div>}
        <input 
          type="text" 
          maxLength={6}
          placeholder="123456"
          onInput={(e) => {
            const value = e.currentTarget.value;
            if (value.length === 6) {
              handleVerifyOTP(value);
            }
          }}
        />
        <button onClick={() => setShowOTPInput(false)}>Back</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister}>
      {error && <div className="error">{error}</div>}
      
      {/* OTP Method Selection */}
      <div>
        <label>Verification Method:</label>
        <select value={otpMethod} onChange={(e) => setOtpMethod(e.target.value as 'email' | 'sms')}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
      </div>
      
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};
```

### Example 4: User Login Flow

```typescript
// In your React component
import AppUserAuthService from './backend/services/AppUserAuthService';

const LoginForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await AppUserAuthService.login({ email, password });

      if (response.success) {
        // Store the SuperTokens access token
        AppUserAuthService.storeToken(response.data.session.accessToken);
        
        console.log('User logged in:', response.data.user);
        console.log('Roles:', response.data.user.roles);
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleLogin(
        formData.get('email') as string,
        formData.get('password') as string
      );
    }}>
      {error && <div className="error">{error}</div>}
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

### Example 5: Protected Route with Token Verification

```typescript
// Protected route component
import AppUserAuthService from './backend/services/AppUserAuthService';
import { useEffect, useState } from 'react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      const token = AppUserAuthService.getToken();
      
      if (!token) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await AppUserAuthService.verify(token);
        
        if (response.success) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
          AppUserAuthService.removeToken();
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        setAuthenticated(false);
        AppUserAuthService.removeToken();
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authenticated) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

### Example 6: Role-Based UI

```typescript
// Check user role and show different UI
import AppUserAuthService from './backend/services/AppUserAuthService';
import { useEffect, useState } from 'react';

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = AppUserAuthService.getToken();
      
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        const response = await AppUserAuthService.verify(token);
        if (response.success) {
          setUser(response.data.user);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  const isAdmin = user.roles?.some((r: any) => r.role_key === 'admin');
  const isManager = user.roles?.some((r: any) => r.role_key === 'manager');

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      {isAdmin && <AdminPanel />}
      {isManager && <ManagerPanel />}
      <UserPanel user={user} />
    </div>
  );
};
```

### Example 7: Using Custom Fields

```typescript
// Access custom field data from metadata
const UserProfile = ({ user }: { user: AppUser }) => {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      
      {/* Custom fields from metadata */}
      {user.metadata?.department && (
        <p>Department: {user.metadata.department}</p>
      )}
      {user.metadata?.employee_id && (
        <p>Employee ID: {user.metadata.employee_id}</p>
      )}
      {user.metadata?.hire_date && (
        <p>Hire Date: {user.metadata.hire_date}</p>
      )}
    </div>
  );
};
```

---

## Session Management

### Session Durations

Each role has a configurable session duration that determines how long JWT tokens remain valid:
- **Admin:** 60 minutes (default)
- **User:** 7 days (default)
- **Custom roles:** Define your own

### How It Works

1. User logs in → Backend generates JWT token
2. Token includes user ID, email, project ID, and roles
3. Token expires based on user's primary role session duration
4. Client stores token (localStorage or cookie)
5. Client includes token in Authorization header for protected requests
6. Backend validates token on each request

### JWT Token Structure

```typescript
{
  userId: 123,
  email: "user@example.com",
  projectId: 1,
  roles: [
    { id: 2, role_name: "User", role_key: "user" }
  ],
  iat: 1699800000,  // Issued at
  exp: 1700404800   // Expires at (7 days later for User role)
}
```

### Configure Session Durations

Platform admins can configure session durations per role:

```typescript
// Via API (requires platform admin authentication)
PUT /app-api/auth/roles/:roleId/session-duration

Headers:
{
  "Cookie": "sAccessToken=...; sIdRefreshToken=..."  // Platform admin session
}

Body:
{
  session_duration_minutes: 1440  // 1 day
}
```

### Token Storage Best Practices

**Option 1: localStorage (Simple)**
```typescript
// Store token
localStorage.setItem('app_user_token', token);

// Retrieve token
const token = localStorage.getItem('app_user_token');

// Remove token (logout)
localStorage.removeItem('app_user_token');
```

**Option 2: Secure Cookie (Better for XSS protection)**
```typescript
// Set cookie with httpOnly flag (server-side)
res.cookie('app_user_token', token, {
  httpOnly: true,
  secure: true,     // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

**Option 3: Memory + Refresh Token (Most Secure)**
```typescript
// Store in memory (lost on refresh)
let authToken = token;

// Use refresh token to get new access token
// (Requires implementing refresh token endpoint)
```

---

## Email Integration

### Available Email Endpoints

**Send Verification Email:**
```typescript
POST /app-api/auth/settings/send-verification

Body:
{
  user_id?: number,
  email?: string
}
```

**Send Password Reset Email:**
```typescript
POST /app-api/auth/settings/send-reset

Body:
{
  email: "user@example.com"
}
```

**Verify OTP:**
```typescript
POST /app-api/auth/settings/verify-otp

Body:
{
  user_id: 1,
  code: "123456"
}
```

### Email Templates

All emails use professional templates included in the system:
- **Registration Email** - Welcome with OTP code
- **Email Verification** - Verification link (24h expiry)
- **Password Reset** - Reset link (1h expiry)
- **Welcome Email** - Post-registration welcome

Template variables:
- `{{userName}}` - User's name
- `{{userEmail}}` - User's email
- `{{projectName}}` - Your project name
- `{{otpCode}}` - OTP/verification code
- `{{verificationLink}}` - Verification URL
- `{{resetLink}}` - Password reset URL

---

## TypeScript Types

### Generated Types

```typescript
export interface AppUser {
  id: number;
  supertokens_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  roles?: Role[];
}

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
  description?: string;
  permissions: any[];
  session_duration_minutes: number;
  is_system_role: boolean;
}

export interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select' | 'reference';
  is_required: boolean;
  options?: any;
  reference_table?: string;
  reference_column?: string;
  is_active: boolean;
}

export interface AuthSettings {
  allow_duplicate_emails: boolean;
  require_email_verification: boolean;
  require_phone_verification: boolean;
  enable_password_reset: boolean;
  enable_mfa: boolean;
  registration_enabled: boolean;
  auth_enabled: boolean;
  default_role_id?: number;
  email_provider_id?: number;
}
```

---

## Complete Service Example

Below is a comprehensive service that combines **all** app user functionality. For production use, consider splitting this into:
- `AppUserAuthService.ts` - Authentication (register/login/verify) - See Example 1
- `UserManagementService.ts` - Admin user management - See Example 2  
- `RoleManagementService.ts` - Role operations
- `AuthSettingsService.ts` - Settings configuration

```typescript
// src/backend/services/ComprehensiveAppAuthService.ts
import { get, post, put, del } from '../utils/request';
import { getAuthHeaders } from '../utils/auth';
// Note: getProjectId is no longer needed - project is extracted from API key

export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  metadata?: any;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  roles?: Role[];
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
  session_duration_minutes: number;
  is_system_role: boolean;
}

export interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  options?: any;
}

class ComprehensiveAppAuthService {
  // Project ID is automatically extracted from API key
  private basePath = '/app-api/auth';
  private authBasePath = '/app-api/auth/auth';

  // ============================================
  // APP USER AUTHENTICATION (No platform admin auth required)
  // ============================================

  async register(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    metadata?: any;
  }) {
    return post<{ user: AppUser; token: string }>(`${this.authBasePath}/register`, data);
  }

  async login(credentials: { email: string; password: string }) {
    return post<{ user: AppUser; token: string }>(`${this.authBasePath}/login`, credentials);
  }

  async verifyToken(token: string) {
    const response = await fetch(`${this.authBasePath}/verify`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  }

  async logout() {
    localStorage.removeItem('app_user_token');
    return post(`${this.authBasePath}/logout`, {});
  }

  // ============================================
  // USER MANAGEMENT (Requires platform admin auth)
  // ============================================

  async listUsers(filters?: {
    search?: string;
    role_id?: number;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.role_id) params.append('role_id', String(filters.role_id));
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const query = params.toString() ? `?${params}` : '';
    return get<{ users: AppUser[]; pagination: any }>(`${this.basePath}/users${query}`);
  }

  async getUser(userId: number) {
    return get<AppUser>(`${this.basePath}/users/${userId}`);
  }

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    metadata?: any;
    role_ids?: number[];
  }) {
    return post<AppUser>(`${this.basePath}/users`, data);
  }

  async updateUser(userId: number, updates: {
    name?: string;
    email?: string;
    phone?: string;
    metadata?: any;
    is_active?: boolean;
  }) {
    return put<AppUser>(`${this.basePath}/users/${userId}`, updates);
  }

  async deleteUser(userId: number, permanent = false) {
    return del(`${this.basePath}/users/${userId}?permanent=${permanent}`);
  }

  async assignRole(userId: number, roleId: number) {
    return post(`${this.basePath}/users/${userId}/roles`, { role_id: roleId });
  }

  async removeRole(userId: number, roleId: number) {
    return del(`${this.basePath}/users/${userId}/roles/${roleId}`);
  }

  // ============================================
  // ROLE MANAGEMENT
  // ============================================

  async listRoles(includeUserCount = false) {
    const query = includeUserCount ? '?include_user_count=true' : '';
    return get<Role[]>(`${this.basePath}/roles${query}`);
  }

  async getRole(roleId: number) {
    return get<Role>(`${this.basePath}/roles/${roleId}`);
  }

  async createRole(data: {
    role_name: string;
    role_key: string;
    description?: string;
    permissions?: any[];
    session_duration_minutes?: number;
  }) {
    return post<Role>(`${this.basePath}/roles`, data);
  }

  async updateRole(roleId: number, updates: {
    role_name?: string;
    description?: string;
    permissions?: any[];
    session_duration_minutes?: number;
  }) {
    return put<Role>(`${this.basePath}/roles/${roleId}`, updates);
  }

  async deleteRole(roleId: number) {
    return del(`${this.basePath}/roles/${roleId}`);
  }

  // ============================================
  // CUSTOM FIELDS
  // ============================================

  async listCustomFields(includeInactive = false) {
    const query = includeInactive ? '?include_inactive=true' : '';
    return get<CustomField[]>(`${this.basePath}/fields${query}`);
  }

  async createCustomField(data: {
    field_name: string;
    field_label: string;
    field_type: string;
    is_required?: boolean;
    options?: any;
    reference_table?: string;
    reference_column?: string;
  }) {
    return post<CustomField>(`${this.basePath}/fields`, data);
  }

  async applyCustomField(fieldId: number) {
    return post(`${this.basePath}/fields/${fieldId}/apply`, {});
  }

  async deleteCustomField(fieldId: number, permanent = false) {
    return del(`${this.basePath}/fields/${fieldId}?permanent=${permanent}`);
  }

  // ============================================
  // AUTH SETTINGS
  // ============================================

  async getAuthSettings() {
    return get(`${this.basePath}/settings`);
  }

  async updateAuthSettings(settings: {
    allow_duplicate_emails?: boolean;
    require_email_verification?: boolean;
    enable_password_reset?: boolean;
    registration_enabled?: boolean;
    default_role_id?: number;
    email_provider_id?: number;
  }) {
    return put(`${this.basePath}/settings`, settings);
  }

  async sendVerificationEmail(userId: number) {
    return post(`${this.basePath}/settings/send-verification`, { user_id: userId });
  }

  async sendPasswordResetEmail(email: string) {
    return post(`${this.basePath}/settings/send-reset`, { email });
  }
}

export default new ComprehensiveAppAuthService();
```

---

## Common Patterns

### Pattern 1: User Registration with Default Role

```typescript
import AppUserAuthService from './backend/services/AppUserAuthService';

const registerUser = async (data: any) => {
  // Register user (default role assigned automatically)
  const response = await AppUserAuthService.register({
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    metadata: data.metadata
  });

  if (response.success) {
    // Store token
    AppUserAuthService.storeToken(response.data.token);
    return response.data.user;
  }
  
  throw new Error(response.message);
};
```

### Pattern 1b: Admin Creating User with Specific Role

```typescript
import UserManagementService from './backend/services/UserManagementService';
import RoleManagementService from './backend/services/RoleManagementService';

const createUserWithRole = async (data: any, roleKey: string) => {
  // Get the role ID
  const rolesResponse = await RoleManagementService.listRoles();
  const role = rolesResponse.data.find((r: any) => r.role_key === roleKey);

  // Create user with specific role
  const userResponse = await UserManagementService.createUser({
    ...data,
    role_ids: role ? [role.id] : []
  });

  return userResponse.data;
};
```

### Pattern 2: Check User Permission

```typescript
const hasPermission = (user: AppUser, permission: string): boolean => {
  if (!user.roles || user.roles.length === 0) return false;
  
  return user.roles.some(role => 
    role.permissions.includes('*') || role.permissions.includes(permission)
  );
};

// Usage
if (hasPermission(currentUser, 'admin')) {
  // Show admin features
}
```

### Pattern 3: Multi-Tenant with Custom Fields

```typescript
import AppUserAuthService from './backend/services/AppUserAuthService';
import UserManagementService from './backend/services/UserManagementService';

// User self-registration with tenant information
await AppUserAuthService.register({
  name: "John Doe",
  email: "john@tenant1.com",
  password: "secure123",
  metadata: {
    tenant_id: 5,           // Custom field: reference to tenants table
    department: "Sales",     // Custom field: select
    employee_id: "EMP001"    // Custom field: text
  }
});

// Admin query: List users by tenant (if you have tenant_id custom field)
const users = await UserManagementService.listUsers();
const tenant5Users = users.data.users.filter(u => u.metadata?.tenant_id === 5);
```

---

## Best Practices

### Security
1. **Never expose API keys** in frontend code
2. **Use environment variables** for credentials
3. **Validate user input** before sending to API
4. **Enable email verification** for production
5. **Use HTTPS** in production

### User Management
1. **Assign default role** to new users automatically
2. **Use soft delete** to preserve data
3. **Hash passwords** (handled by SuperTokens)
4. **Verify emails** before granting access
5. **Set appropriate session durations** (shorter for admins)

### Custom Fields
1. **Define fields in metadata first** before applying to DB
2. **Use reference fields** for relationships
3. **Validate field values** in your app
4. **Don't delete applied fields** without checking data

### Roles
1. **Start with default roles** (Admin, User)
2. **Create specific roles** for your use case
3. **Use role keys** for permission checks
4. **Set shorter sessions** for privileged roles

---

## Error Handling

### Common Errors

**400 Bad Request**
```json
{
  "success": false,
  "message": "Email is required"
}
```
→ Check request body has all required fields

**401 Unauthorized**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```
→ Check API key is valid and included in headers

**403 Forbidden**
```json
{
  "success": false,
  "message": "Access denied: You do not have permission to access this project"
}
```
→ API key doesn't have access to this project

**404 Not Found**
```json
{
  "success": false,
  "message": "User not found"
}
```
→ User ID doesn't exist or was deleted

---

## Quick Start Summary

### For End-User Authentication

1. **Include API key in all requests** (identifies your project):
```typescript
headers: { 'X-API-Key': 'sk_your_key' }  // Note: Capital X
```

2. **Use auth endpoints WITHOUT project ID** (simpler URLs):
```typescript
POST /app-api/auth/auth/register    // NOT /app-api/auth/:projectId/auth/register
POST /app-api/auth/auth/login
POST /app-api/auth/auth/verify
POST /app-api/auth/auth/verify-otp  // Verify OTP after registration
POST /app-api/auth/auth/logout
```

3. **Store JWT tokens returned from login/register**:
```typescript
const { token } = response.data;
localStorage.setItem('app_user_token', token);
```

4. **Include JWT token for protected user actions**:
```typescript
headers: {
  'X-API-Key': 'sk_your_key',  // Note: Capital X
  'Authorization': 'Bearer ' + token
}
```

### For Admin User Management

Use project-scoped endpoints (requires platform admin session):
```typescript
GET /app-api/auth/users
POST /app-api/auth/users
PUT /app-api/auth/users/:userId
DELETE /app-api/auth/users/:userId
GET /app-api/auth/users/:userId/otp-status      // View OTP history
POST /app-api/auth/users/:userId/resend-otp     // Resend OTP
POST /app-api/auth/users/:userId/manual-verify  // Manual verification
```

---

## Quick Reference - Authentication Endpoints

### Public Endpoints (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/app-api/auth/auth/register` | Register new user with optional OTP |
| POST | `/app-api/auth/auth/login` | Login user |
| POST | `/app-api/auth/auth/verify` | Verify session token |
| POST | `/app-api/auth/auth/logout` | Logout user |
| POST | `/app-api/auth/auth/verify-otp` | Verify OTP code (email/SMS) |

### Admin Endpoints (Requires Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/app-api/auth/users` | List all users |
| GET | `/app-api/auth/users/:userId` | Get user details |
| POST | `/app-api/auth/users` | Create new user |
| PUT | `/app-api/auth/users/:userId` | Update user |
| DELETE | `/app-api/auth/users/:userId` | Delete user |
| GET | `/app-api/auth/users/:userId/otp-status` | Get OTP verification history |
| POST | `/app-api/auth/users/:userId/resend-otp` | Resend OTP to user |
| POST | `/app-api/auth/users/:userId/manual-verify` | Manually verify user |

---

## Key Concepts

✅ **API Key** → Identifies your project (required for all requests)  
✅ **JWT Token** → Authenticates individual users (from login/register)  
✅ **No Project ID in Auth URLs** → Extracted from API key automatically  
✅ **Two Service Types** → `AppUserAuthService` (end-users) + `UserManagementService` (admins)  
✅ **SuperTokens Integration** → Recommended for automatic session management and token refresh  
✅ **OTP Verification** → Optional email/SMS verification for enhanced security

---

## Next Steps

1. ✅ Set up API credentials (`02-AUTHENTICATION.md`)
2. ✅ Create `AppUserAuthService` (Example 1)
3. ✅ Create `UserManagementService` (Example 2)
4. ✅ Implement user registration flow (Example 3)
5. ✅ Implement login flow (Example 4)
6. ✅ Add protected routes (Example 5)
7. ✅ Add role-based UI (Example 6)

---

## Related Documentation

- **Platform Auth:** `02-AUTHENTICATION.md` - API credentials setup
- **Database Access:** `04-SERVICE-GENERATION.md` - CRUD operations
- **GraphQL:** `05-GRAPHQL-INTEGRATION.md` - Alternative to REST
- **Examples:** `06-USAGE-EXAMPLES.md` - Real-world use cases

---

**Your app now has complete user management capabilities!** 🎉

