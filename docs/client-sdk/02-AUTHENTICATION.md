# Client SDK - Platform Authentication Setup

> **Note:** This guide covers authenticating **your client application** with Skaftin's platform using API credentials. For authenticating **your app's end users**, see `07-APP-USER-AUTHENTICATION.md`.

## Authentication Overview

Skaftin uses **two separate authentication layers**:

1. **Platform Authentication** (This Guide)
   - Authenticates your client application with Skaftin
   - Uses API Keys (`sk_...`) or Access Tokens (`sat_...`)
   - Required for all API requests
   - Controls what your app can access

2. **App User Authentication** (`07-APP-USER-AUTHENTICATION.md`)
   - Authenticates your application's end users
   - Uses JWT tokens
   - Built on top of platform authentication
   - Manages user sessions and permissions

---

## Step 1: Create API Credentials in Skaftin

### Via Skaftin UI

1. Navigate to **Settings → API Credentials**
2. Click **"Create Credential"**
3. Fill in:
   - **Name:** "Production API Key" (or descriptive name)
   - **Type:** API Key or Access Token
   - **Permissions:** Select what your app needs
     - `database:read` - Read data
     - `database:write` - Create/update data
     - `database:delete` - Delete data
     - `storage:read` - View files
     - `storage:write` - Upload files
     - `auth:read` - Read user auth data
     - `auth:write` - Manage users/roles
     - etc.
4. Click **"Create Credential"**
5. **COPY THE TOKEN** - You'll only see it once!

### Recommended Permissions by App Type

**Read-Only Dashboard:**
```
✅ database:read
✅ storage:read
✅ auth:read (if showing user data)
```

**Full CRUD App:**
```
✅ database:read
✅ database:write
✅ database:delete
✅ storage:read
✅ storage:write
✅ auth:read
✅ auth:write (if managing users)
```

**Admin App:**
```
✅ Select all permissions
```

### Credential Types

**API Keys (`sk_...`)**
- Server-to-server communication
- Full project access (customizable)
- Long-lived, never expires
- Best for backend services

**Access Tokens (`sat_...`)**
- Client-side applications
- Granular permissions per resource
- Can have expiration dates
- Best for frontend apps

---

## Step 2: Configure Client App Environment

Create `.env` file in your React app:

```bash
# Skaftin Platform Configuration
REACT_APP_SKAFTIN_API_URL=http://localhost:4006
REACT_APP_SKAFTIN_API_KEY=sk_your_api_key_here

# OR use Access Token (alternative to API key)
# REACT_APP_SKAFTIN_ACCESS_TOKEN=sat_your_token_here

# Note: Project ID is automatically extracted from API key/token
# No need to set PROJECT_ID - it's identified from your credential
```

**Production:**
```bash
REACT_APP_SKAFTIN_API_URL=https://api.yourdomain.com
REACT_APP_SKAFTIN_API_KEY=sk_production_key_here
```

**Important Notes:**
- API Key/Token automatically identifies your project
- `PROJECT_ID` is no longer needed - project is extracted from credentials
- Never commit `.env` to version control

---

## Step 3: Create Config File

Create `src/backend/config/skaftin.config.ts`:

```typescript
export const SKAFTIN_CONFIG = {
  apiUrl: process.env.REACT_APP_SKAFTIN_API_URL || 'http://localhost:4006',
  apiKey: process.env.REACT_APP_SKAFTIN_API_KEY || '',
  accessToken: process.env.REACT_APP_SKAFTIN_ACCESS_TOKEN || '',
  // projectId is no longer needed - automatically extracted from API key/token
};

// Validation
if (!SKAFTIN_CONFIG.apiKey && !SKAFTIN_CONFIG.accessToken) {
  console.error('❌ No Skaftin credentials configured.');
  console.error('   Set REACT_APP_SKAFTIN_API_KEY or REACT_APP_SKAFTIN_ACCESS_TOKEN in .env');
  throw new Error('Skaftin credentials required');
}

export default SKAFTIN_CONFIG;
```

**Key Changes:**
- ✅ Credentials now automatically include project context
- ✅ No manual project ID required (unless multi-project)
- ✅ Simplified configuration

---

## Step 4: Create Auth Utils

Create `src/backend/utils/auth.ts`:

```typescript
import SKAFTIN_CONFIG from '../config/skaftin.config';

/**
 * Get authentication headers for Skaftin API requests
 * 
 * The API key/token automatically identifies your project,
 * so no need to include project ID separately.
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Use API key (preferred method)
  if (SKAFTIN_CONFIG.apiKey) {
    headers['x-api-key'] = SKAFTIN_CONFIG.apiKey;
    return headers;
  }
  
  // Use access token (alternative method)
  if (SKAFTIN_CONFIG.accessToken) {
    headers['x-access-token'] = SKAFTIN_CONFIG.accessToken;
    return headers;
  }

  throw new Error('No Skaftin credentials configured');
}

/**
 * Check if credentials are configured
 */
export function isAuthenticated(): boolean {
  return !!(SKAFTIN_CONFIG.apiKey || SKAFTIN_CONFIG.accessToken);
}

/**
 * Get project ID (deprecated - no longer needed)
 * Project is automatically extracted from API key/token in headers
 * This function is kept for backward compatibility only
 */
export function getProjectId(): string | null {
  // Project ID is now extracted from credentials automatically
  // This function is deprecated and returns null
  return null;
}
```

**Important Changes:**
- ✅ Headers use `x-api-key` and `x-access-token` (lowercase)
- ✅ Project automatically identified from credentials
- ✅ Simplified authentication flow

## Step 5: Create Request Wrapper

Create `src/backend/utils/request.ts`:

```typescript
import SKAFTIN_CONFIG from '../config/skaftin.config';
import { getAuthHeaders } from './auth';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Make authenticated request to Skaftin API
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${SKAFTIN_CONFIG.apiUrl}${endpoint}`;
  
  const headers = {
    ...getAuthHeaders(),
    ...options?.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }

    return data;
  } catch (error: any) {
    console.error(`API Request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function post<T>(
  endpoint: string,
  body: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request
 */
export async function put<T>(
  endpoint: string,
  body: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export async function del<T>(
  endpoint: string,
  body?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

## Testing Authentication

Create a test file to verify setup:

```typescript
// src/backend/test-auth.ts
import { isAuthenticated, getAuthHeaders } from './utils/auth';
import { get } from './utils/request';

async function testConnection() {
  console.log('🔐 Authentication configured:', isAuthenticated());
  console.log('📋 Headers:', getAuthHeaders());
  
  try {
    // Test API connection
    const response = await get('/api/health');
    console.log('✅ Connection successful:', response);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();
```

Run with:
```bash
npx ts-node src/backend/test-auth.ts
```

## Security Best Practices

### Never Commit Credentials
Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### Use Environment Variables
```bash
# Development
REACT_APP_SKAFTIN_API_KEY=sk_dev_key

# Production (set in hosting provider)
REACT_APP_SKAFTIN_API_KEY=sk_prod_key
```

### Rotate Keys Regularly
- Generate new key in Skaftin UI
- Update `.env` in client app
- Delete old key in Skaftin
- Deploy client app

### Separate Keys Per Environment
- Development: `sk_dev_...`
- Staging: `sk_staging_...`
- Production: `sk_prod_...`

## Troubleshooting

**"No credentials configured"**
- Check `.env` file exists
- Verify `REACT_APP_SKAFTIN_API_KEY` is set
- Restart dev server after changing `.env`

**"401 Unauthorized"**
- API key may be invalid
- Generate new key in Skaftin
- Check key is copied correctly

**"403 Forbidden"**
- API key lacks required permissions
- Edit credential in Skaftin
- Add missing permissions

**"Connection refused"**
- Check `REACT_APP_SKAFTIN_API_URL` is correct
- Verify Skaftin backend is running
- Check firewall/network settings

---

## Next Steps

Once platform authentication is working:

**For Data Access:**
- `03-TYPE-GENERATION.md` - Generate TypeScript types
- `04-SERVICE-GENERATION.md` - Create API services
- `06-USAGE-EXAMPLES.md` - Real-world examples

**For User Management:**
- `07-APP-USER-AUTHENTICATION.md` - App user authentication, roles, and sessions

---

## Authentication Quick Reference

### Platform Authentication (This Guide)
```typescript
// Headers for ALL API requests
headers: {
  'x-api-key': 'sk_your_api_key',        // API Key method
  // OR
  'x-access-token': 'sat_your_token'     // Access Token method
}
```

### App User Authentication (See 07-APP-USER-AUTHENTICATION.md)
```typescript
// After user login, include JWT token
headers: {
  'x-api-key': 'sk_your_api_key',        // Platform auth (required)
  'Authorization': 'Bearer eyJhbG...'    // User session (for user endpoints)
}
```

**Remember:** 
- Platform credentials authenticate YOUR APP
- JWT tokens authenticate YOUR APP'S USERS
- Both can work together in the same application

