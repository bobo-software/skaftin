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

## Step 3: Create Unified Client ⭐ NEW SIMPLIFIED APPROACH

Create `src/backend/client/SkaftinClient.ts`:

```typescript
/**
 * Skaftin SDK Client
 * 
 * Unified client for all Skaftin API interactions.
 * Handles configuration, authentication, and requests in one place.
 */

import useAuthStore from '../../stores/data/AuthStore'; // For JWT token injection

export interface SkaftinConfig {
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
  projectId?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data: T;
}

class SkaftinClient {
  private config: Required<Omit<SkaftinConfig, 'projectId'>> & { projectId: string | null };
  private initialized = false;

  constructor() {
    // Load configuration from environment
    const apiUrl = import.meta.env.VITE_SKAFTIN_API_URL || 'http://localhost:4006';
    const apiKey = import.meta.env.VITE_SKAFTIN_API_KEY || import.meta.env.VITE_SKAFTIN_API || '';
    const accessToken = import.meta.env.VITE_SKAFTIN_ACCESS_TOKEN || '';
    const projectId = import.meta.env.VITE_SKAFTIN_PROJECT_ID || null;

    this.config = {
      apiUrl,
      apiKey,
      accessToken,
      projectId,
    };

    // Validate configuration
    if (!this.config.apiKey && !this.config.accessToken) {
      console.error(
        '❌ No Skaftin credentials configured!\n' +
        '   Set VITE_SKAFTIN_API_KEY or VITE_SKAFTIN_ACCESS_TOKEN in .env'
      );
      throw new Error('Skaftin credentials required');
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log('🔧 Skaftin Client initialized:', {
        apiUrl: this.config.apiUrl,
        hasApiKey: !!this.config.apiKey,
        hasAccessToken: !!this.config.accessToken,
        projectId: this.config.projectId || 'auto-detected',
      });
    }

    this.initialized = true;
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  getProjectId(): string | null {
    return this.config.projectId;
  }

  isAuthenticated(): boolean {
    return !!(this.config.apiKey || this.config.accessToken);
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    // Always include X-API-Key header (platform authentication)
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.accessToken) {
      headers['x-access-token'] = this.config.accessToken;
    }
    
    return headers;
  }

  private buildHeaders(customHeaders: Record<string, string> = {}, isFormData = false): HeadersInit {
    const headers: Record<string, string> = {
      ...(this.getAuthHeaders() as Record<string, string>),
      ...customHeaders,
    };

    // Always add Authorization Bearer token if user is authenticated
    // Get token from AuthStore (stored after login)
    const authState = useAuthStore.getState();
    const jwtToken = authState.sessionUser?.accessToken || authState.sessionUser?.access;
    if (jwtToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    // Don't set Content-Type for FormData (browser will set it with boundary)
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (!this.initialized) {
      throw new Error('Skaftin client not initialized');
    }

    const url = `${this.config.apiUrl}${endpoint}`;
    const method = options.method || 'GET';
    const isFormData = options.body instanceof FormData;

    const headers = this.buildHeaders(
      (options.headers as Record<string, string>) || {},
      isFormData
    );

    // Prepare body
    let requestBody: any = options.body;
    let finalBody: BodyInit | undefined;

    if (isFormData) {
      finalBody = options.body as FormData;
    } else if (requestBody) {
      if (typeof requestBody === 'string') {
        finalBody = requestBody;
      } else {
        finalBody = JSON.stringify(requestBody);
      }
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[${method}] ${endpoint}`, requestBody || '');
    }

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: finalBody,
      });

      const data = await response.json();

      // Handle 401 Unauthorized - SuperTokens SDK handles refresh automatically
      // But we can retry the request after a short delay to allow refresh
      if (response.status === 401 && this.isUserAuthenticated()) {
        try {
          // Check if SuperTokens session exists (it will auto-refresh)
          const { Session } = await import('supertokens-auth-react/recipe/session');
          const sessionExists = await Session.doesSessionExist();
          
          if (sessionExists) {
            // Wait a bit for SuperTokens to refresh the token
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Retry the original request (SuperTokens will have refreshed the token)
            const retryResponse = await fetch(url, {
              ...options,
              method,
              headers: this.buildHeaders(
                (options.headers as Record<string, string>) || {},
                isFormData
              ),
              credentials: 'include',
              body: finalBody,
            });

            const retryData = await retryResponse.json();
            if (retryResponse.ok) {
              return retryData;
            }
          }
        } catch (refreshError) {
          console.error('Failed to refresh session:', refreshError);
        }
      }

      if (import.meta.env.DEV) {
        console.log(`[${method}] ${endpoint} →`, response.status, data);
      }

      if (!response.ok) {
        const errorMsg = data.message || data.error || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

      return data;
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error(`[${method}] ${endpoint} ❌`, error);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();
      url += `?${queryString}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async postFormData<T>(endpoint: string, body: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', body });
  }

  private isUserAuthenticated(): boolean {
    const authState = useAuthStore.getState();
    return !!authState.sessionUser?.accessToken;
  }
}

// Export singleton instance
export const skaftinClient = new SkaftinClient();
export default skaftinClient;
```

**Key Benefits:**
- ✅ **Single file** - All configuration, auth, and requests in one place
- ✅ **Auto-initialization** - No manual setup needed
- ✅ **Automatic JWT injection** - Adds user tokens when available
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Development logging** - Helpful console logs in dev mode

---

## Step 4: Create Folder Structure

Your `src/backend/` folder should look like this:

```
src/
└── backend/
    ├── client/
    │   └── SkaftinClient.ts    ← Main unified client (REQUIRED)
    └── index.ts                 ← Main export file (REQUIRED)
```

**Complete Structure (with optional backward compatibility files):**

```
src/
└── backend/
    ├── client/
    │   └── SkaftinClient.ts    ← Unified client (REQUIRED)
    ├── config/
    │   └── skaftin.config.ts   ← Optional (for backward compatibility)
    ├── utils/
    │   ├── auth.ts             ← Optional (delegates to client)
    │   └── request.ts          ← Optional (delegates to client)
    ├── services/               ← Optional (create as needed)
    │   ├── TableService.ts
    │   └── ...
    ├── types/                  ← Optional (create as needed)
    │   └── api.types.ts
    └── index.ts                ← Main export (REQUIRED)
```

**File Purposes:**
- `client/SkaftinClient.ts` - **REQUIRED** - Unified client for all API interactions
- `index.ts` - **REQUIRED** - Main export point
- `config/skaftin.config.ts` - Optional - Backward compatibility wrapper
- `utils/auth.ts` - Optional - Backward compatibility utilities
- `utils/request.ts` - Optional - Backward compatibility request wrappers
- `services/` - Optional - Create service classes as needed (see `04-SERVICE-GENERATION.md`)
- `types/` - Optional - TypeScript type definitions

## Step 5: Create Main Export

Create `src/backend/index.ts` to export the client:

```typescript
/**
 * Skaftin Backend SDK - Main Export
 */

// Main Client (Recommended)
export { skaftinClient, SkaftinClient } from './client/SkaftinClient';
export type { SkaftinConfig, ApiResponse } from './client/SkaftinClient';

// Configuration (backward compatibility)
export { default as SKAFTIN_CONFIG } from './config/skaftin.config';

// Utilities (backward compatibility - optional)
export * from './utils/auth';
export { 
  apiRequest, 
  get, 
  post, 
  put, 
  patch, 
  del, 
  ApiError, 
  handleApiError 
} from './utils/request';

// Services (when you create them)
export * from './services';
```

**Note:** The unified client handles everything. The utilities above are optional and kept for backward compatibility with existing code.

## Step 5: Use the Client! 🎉

That's it! The client is ready to use. No additional setup needed.

```typescript
// In any component or service
import { skaftinClient } from './backend';

// Test connection
async function testConnection() {
  try {
    const response = await skaftinClient.get('/api/health');
    console.log('✅ Connection successful:', response);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

// Make API calls
const shops = await skaftinClient.get('/app-api/database/tables/shops/select');
const newShop = await skaftinClient.post('/app-api/database/tables/shops/insert', {
  data: { name: 'My Shop', address: '123 Main St' }
});
```

**That's all you need!** The client automatically:
- ✅ Loads configuration from `.env`
- ✅ Adds authentication headers
- ✅ Handles errors
- ✅ Logs requests in development
- ✅ Injects JWT tokens for app user requests

## Backward Compatibility

If you have existing code using the old utilities, they still work! The utilities now delegate to the unified client:

```typescript
// Old way (still works)
import { get } from './backend/utils/request';
import { isAuthenticated } from './backend/utils/auth';

// New way (recommended)
import { skaftinClient } from './backend';
```

Both approaches work - use what fits your project!

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
  'X-API-Key': 'sk_your_api_key',        // API Key method (capital X)
  // OR
  'x-access-token': 'sat_your_token'     // Access Token method
}
```

### App User Authentication (See 07-APP-USER-AUTHENTICATION.md)
```typescript
// After user login, include JWT token
headers: {
  'X-API-Key': 'sk_your_api_key',        // Platform auth (required, capital X)
  'Authorization': 'Bearer eyJhbG...'    // User session (for user endpoints)
}
```

**Remember:** 
- Platform credentials authenticate YOUR APP
- JWT tokens authenticate YOUR APP'S USERS
- Both can work together in the same application

