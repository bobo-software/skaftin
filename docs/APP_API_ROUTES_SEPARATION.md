# App-API Routes Separation

**Date:** December 2024  
**Status:** Implemented

---

## Overview

This document describes the separation of client-facing API routes into a dedicated `/app-api` prefix, following the same pattern as the authentication route separation (`/api/app-auth` vs `/api/auth`).

## Route Structure

### Platform Admin Routes (`/api/*`)
Routes for Skaftin platform administrators using SuperTokens authentication:

- `/api/auth` - Platform admin authentication
- `/api/projects` - Project management
- `/api/organizations` - Organization management
- `/api/files` - Legacy file management
- `/api/communications` - Email provider management
- `/api/invitations` - Team invitations
- `/api/credentials` - API key management
- `/api/users` - Platform user management
- `/api/health` - Health checks
- `/api/mcp` - MCP protocol endpoints
- `/api/graphql` - GraphQL endpoint

### Client-Facing Routes (`/app-api/*`)
Routes for client applications using API keys or app user JWT tokens:

- `/app-api/auth` - App user authentication and management
  - `/app-api/auth/auth/register` - Register app user
  - `/app-api/auth/auth/login` - Login app user
  - `/app-api/auth/:projectId/users` - User management
  - `/app-api/auth/:projectId/roles` - Role management
  - `/app-api/auth/:projectId/fields` - Custom fields
  - `/app-api/auth/:projectId/settings` - Auth settings

- `/app-api/storage` - Storage operations
  - `/app-api/storage/buckets` - Bucket management
  - `/app-api/storage/:projectId/files` - File operations
  - `/app-api/storage/:projectId/search` - File search
  - `/app-api/storage/:projectId/upload` - File upload
  - `/app-api/storage/:projectId/download/...` - File download
  - `/app-api/storage/:projectId/folders/...` - Folder operations

- `/app-api/database` - Database operations
  - `/app-api/database/:projectId/tables` - Table management
  - `/app-api/database/:projectId/tables/:tableName/select` - Query data
  - `/app-api/database/:projectId/tables/:tableName/insert` - Insert data
  - `/app-api/database/:projectId/tables/:tableName/update` - Update data
  - `/app-api/database/:projectId/tables/:tableName/delete` - Delete data
  - `/app-api/database/:projectId/query` - Execute SQL queries
  - `/app-api/database/:projectId/cron` - Cron job management

## Authentication

### Platform Admin Routes
- **Authentication:** SuperTokens (HTTP-only cookies)
- **Middleware:** `authenticateAndAttachUser`, `verifyProjectAccess`
- **Use Case:** Skaftin UI, platform management

### Client-Facing Routes
- **Authentication:** 
  - API Key (via `X-API-Key` header)
  - Access Token (via `Authorization: Bearer <token>` header)
  - App User JWT (via `Authorization: Bearer <jwt>` header)
  - SuperTokens (fallback for Skaftin UI)
- **Middleware:** `hybridAuthAndVerifyProject`, `extractProjectFromCredentials`
- **Use Case:** Client applications, external integrations

## Changes Made

### Backend (`src/Server.ts`)
1. Added `/app-api/auth` route registration
2. Added `/app-api/storage` route registration
3. Added `/app-api/database` route registration
4. Removed old routes from `/api/app-auth`, `/api/storage`, `/api/database`
5. Updated root endpoint documentation
6. Updated server startup console logs

### Frontend (`frontend/src/`)
1. Updated `constants/ApiRoutes.ts`:
   - Added `APP_AUTH` routes using `/app-api/auth`
   - Updated `STORAGE` routes to use `/app-api/storage`
   - Updated `DATABASE` routes to use `/app-api/database`

2. Updated service files:
   - `services/RolesService.ts` - Updated to `/app-api/auth`
   - `services/CustomFieldsService.ts` - Updated to `/app-api/auth`
   - `services/AuthUsersService.ts` - Updated to `/app-api/auth`
   - `services/AuthSettingsService.ts` - Updated to `/app-api/auth`
   - `services/DatabaseService.ts` - Updated to `/app-api/database`

3. Updated components:
   - `components/database/CronManager.tsx` - Updated to `/app-api/database`
   - `stores/data/useDatabaseStore.ts` - Updated to `/app-api/database`

## Migration Guide

**Important:** The old routes (`/api/app-auth`, `/api/storage`, `/api/database`) have been removed. All client applications must use the new `/app-api/*` routes.

### For Client Applications

**Old routes (no longer available):**
```typescript
POST /api/app-auth/123/auth/register
GET /api/storage/123/files
POST /api/database/123/tables/create
```

**New routes (required):**
```typescript
POST /app-api/auth/auth/register
GET /app-api/storage/123/files
POST /app-api/database/123/tables/create
```

### For Frontend Code

**Before:**
```typescript
import ApiRoutes from './constants/ApiRoutes';
const url = `/api/app-auth/${projectId}/users`;
const storageUrl = `/api/storage/${projectId}/files`;
```

**After:**
```typescript
import ApiRoutes from './constants/ApiRoutes';
const url = ApiRoutes.APP_AUTH.USERS(projectId); // or `/app-api/auth/${projectId}/users`
const storageUrl = ApiRoutes.STORAGE.LIST_FILES(projectId);
```

## Testing

All routes should be tested to ensure:
1. `/app-api/*` routes work with API key authentication
2. `/app-api/*` routes work with app user JWT tokens
3. `/api/*` routes still work with SuperTokens authentication
4. CORS configuration allows `/app-api` routes

## Benefits

1. **Clear Separation:** Platform admin routes vs client-facing routes
2. **Better Organization:** Follows the same pattern as auth routes
3. **Easier Maintenance:** Clear distinction between route types
4. **Improved Security:** Can apply different security policies per route group
5. **Better Documentation:** Clearer API structure for developers

## Future Considerations

1. Consider adding rate limiting per route group
2. Consider adding different CORS policies per route group
3. Consider adding API versioning (`/app-api/v1/*`)

