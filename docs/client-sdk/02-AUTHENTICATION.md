# Client SDK - Authentication Setup

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
     - etc.
4. Click **"Create Credential"**
5. **COPY THE TOKEN** - You'll only see it once!

### Recommended Permissions by App Type

**Read-Only Dashboard:**
```
✅ database:read
✅ storage:read
```

**Full CRUD App:**
```
✅ database:read
✅ database:write
✅ database:delete
✅ storage:read
✅ storage:write
```

**Admin App:**
```
✅ Select all permissions
```

## Step 2: Configure Client App Environment

Create `.env` file in your React app:

```bash
# Skaftin API Configuration
REACT_APP_SKAFTIN_API_URL=http://localhost:4006
REACT_APP_SKAFTIN_PROJECT_ID=1
REACT_APP_SKAFTIN_API_KEY=sk_your_api_key_here

# For access tokens (alternative to API key)
# REACT_APP_SKAFTIN_ACCESS_TOKEN=sat_your_token_here
```

**Production:**
```bash
REACT_APP_SKAFTIN_API_URL=https://skaftinplatform.yourdomain.com
REACT_APP_SKAFTIN_PROJECT_ID=123
REACT_APP_SKAFTIN_API_KEY=sk_production_key_here
```

## Step 3: Create Config File

Create `src/backend/config/skaftin.config.ts`:

```typescript
export const SKAFTIN_CONFIG = {
  apiUrl: process.env.REACT_APP_SKAFTIN_API_URL || 'http://localhost:4006',
  projectId: process.env.REACT_APP_SKAFTIN_PROJECT_ID || '1',
  apiKey: process.env.REACT_APP_SKAFTIN_API_KEY || '',
  accessToken: process.env.REACT_APP_SKAFTIN_ACCESS_TOKEN || '',
};

// Validation
if (!SKAFTIN_CONFIG.apiKey && !SKAFTIN_CONFIG.accessToken) {
  console.warn('⚠️  No Skaftin credentials configured. Set REACT_APP_SKAFTIN_API_KEY in .env');
}

if (!SKAFTIN_CONFIG.projectId) {
  console.warn('⚠️  No Skaftin project ID configured. Set REACT_APP_SKAFTIN_PROJECT_ID in .env');
}

export default SKAFTIN_CONFIG;
```

## Step 4: Create Auth Utils

Create `src/backend/utils/auth.ts`:

```typescript
import SKAFTIN_CONFIG from '../config/skaftin.config';

/**
 * Get authentication headers for Skaftin API requests
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Use API key if available (preferred for server-to-server)
  if (SKAFTIN_CONFIG.apiKey) {
    headers['X-API-Key'] = SKAFTIN_CONFIG.apiKey;
  }
  
  // Use access token if API key not available
  if (SKAFTIN_CONFIG.accessToken && !SKAFTIN_CONFIG.apiKey) {
    headers['Authorization'] = `Bearer ${SKAFTIN_CONFIG.accessToken}`;
  }

  return headers;
}

/**
 * Check if credentials are configured
 */
export function isAuthenticated(): boolean {
  return !!(SKAFTIN_CONFIG.apiKey || SKAFTIN_CONFIG.accessToken);
}

/**
 * Get current project ID
 */
export function getProjectId(): string {
  return SKAFTIN_CONFIG.projectId;
}
```

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

## Next Steps

Once authentication is working, proceed to:
- `03-TYPE-GENERATION.md` - Generate TypeScript types
- `04-SERVICE-GENERATION.md` - Create API services

