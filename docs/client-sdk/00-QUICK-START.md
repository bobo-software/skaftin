# Quick Start Guide - Skaftin SDK Integration

Get up and running with Skaftin SDK in 5 minutes!

## Prerequisites

- ✅ Skaftin project created
- ✅ API credentials generated (API key or access token)
- ✅ React app with TypeScript

## Step 1: Environment Setup

Create `.env` file in your project root:

```env
VITE_SKAFTIN_API_URL=http://localhost:4006
VITE_SKAFTIN_API_KEY=sk_your_api_key_here
# OR
# VITE_SKAFTIN_ACCESS_TOKEN=sat_your_token_here
```

## Step 2: Create Folder Structure

Create the following folder structure in your project:

```
src/
└── backend/
    ├── client/
    │   └── SkaftinClient.ts    ← Main client (required)
    └── index.ts                 ← Export file (required)
```

**Optional (for backward compatibility):**
```
src/
└── backend/
    ├── client/
    │   └── SkaftinClient.ts
    ├── config/
    │   └── skaftin.config.ts    ← Optional (delegates to client)
    ├── utils/
    │   ├── auth.ts              ← Optional (delegates to client)
    │   └── request.ts           ← Optional (delegates to client)
    └── index.ts
```

## Step 3: Create Unified Client

Create `src/backend/client/SkaftinClient.ts`:

```typescript
/**
 * Skaftin SDK Client
 * Unified client for all Skaftin API interactions
 */

import useAuthStore from '../../stores/data/AuthStore'; // For JWT token injection

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data: T;
}

class SkaftinClient {
  private config: {
    apiUrl: string;
    apiKey: string;
    accessToken: string;
    projectId: string | null;
  };
  private initialized = false;

  constructor() {
    const apiUrl = import.meta.env.VITE_SKAFTIN_API_URL || 'http://localhost:4006';
    const apiKey = import.meta.env.VITE_SKAFTIN_API_KEY || import.meta.env.VITE_SKAFTIN_API || '';
    const accessToken = import.meta.env.VITE_SKAFTIN_ACCESS_TOKEN || '';
    const projectId = import.meta.env.VITE_SKAFTIN_PROJECT_ID || null;

    this.config = { apiUrl, apiKey, accessToken, projectId };

    if (!apiKey && !accessToken) {
      throw new Error('Skaftin credentials required. Set VITE_SKAFTIN_API_KEY or VITE_SKAFTIN_ACCESS_TOKEN');
    }

    if (import.meta.env.DEV) {
      console.log('🔧 Skaftin Client initialized');
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

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    if (!this.initialized) throw new Error('Skaftin client not initialized');

    const url = `${this.config.apiUrl}${endpoint}`;
    const method = options.method || 'GET';
    const isFormData = options.body instanceof FormData;

    const headers = this.buildHeaders(
      (options.headers as Record<string, string>) || {},
      isFormData
    );

    let finalBody: BodyInit | undefined;
    if (isFormData) {
      finalBody = options.body as FormData;
    } else if (options.body) {
      finalBody = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'include',
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

      if (!response.ok) {
        const error = new Error(data.message || data.error || `Request failed: ${response.status}`);
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
      const query = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null) {
            acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();
      url += `?${query}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
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

  async postFormData<T>(endpoint: string, body: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  private isUserAuthenticated(): boolean {
    const authState = useAuthStore.getState();
    return !!authState.sessionUser?.accessToken;
  }
}

export const skaftinClient = new SkaftinClient();
export default skaftinClient;
```

## Step 4: Export the Client

Create `src/backend/index.ts`:

```typescript
export { skaftinClient, SkaftinClient } from './client/SkaftinClient';
export type { ApiResponse } from './client/SkaftinClient';
```

## Step 5: Use It!

```typescript
import { skaftinClient } from './backend';

// GET request
const shops = await skaftinClient.get('/app-api/database/tables/shops/select');
console.log(shops.data); // Array of shops

// POST request
const newShop = await skaftinClient.post('/app-api/database/tables/shops/insert', {
  data: { name: 'My Shop', address: '123 Main St' }
});

// PUT request
const updated = await skaftinClient.put('/app-api/database/tables/shops/update', {
  data: { name: 'Updated Shop' },
  where: { id: 1 }
});

// DELETE request
await skaftinClient.delete('/app-api/database/tables/shops/delete', {
  where: { id: 1 }
});
```

## That's It! 🎉

You're ready to use Skaftin SDK. The client automatically:
- ✅ Loads configuration from `.env`
- ✅ Adds authentication headers
- ✅ Handles errors
- ✅ Logs requests in development mode
- ✅ Injects JWT tokens when available

## Next Steps

- **Folder structure:** See `FOLDER_STRUCTURE.md` for complete reference
- **Read full guides:** Start with `01-OVERVIEW.md`
- **Create services:** See `04-SERVICE-GENERATION.md`
- **User management:** See `07-APP-USER-AUTHENTICATION.md`
- **Real-time updates:** See `08-WEBSOCKET-INTEGRATION.md`

## Troubleshooting

**"No credentials configured"**
- Check `.env` file exists
- Verify `VITE_SKAFTIN_API_KEY` is set
- Restart dev server after changing `.env`

**"401 Unauthorized"**
- API key may be invalid
- Generate new key in Skaftin UI

**"Connection refused"**
- Check `VITE_SKAFTIN_API_URL` is correct
- Verify Skaftin backend is running

