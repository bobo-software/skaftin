# Complete Folder Structure Guide

This document shows the complete folder structure for Skaftin SDK integration.

## Minimal Structure (Recommended for New Projects)

The absolute minimum you need:

```
your-react-app/
├── .env                          ← Environment variables
└── src/
    └── backend/
        ├── client/
        │   └── SkaftinClient.ts  ← REQUIRED: Unified client
        └── index.ts               ← REQUIRED: Main export
```

**Files to create:**
1. `.env` - Environment variables (see Step 1 in `00-QUICK-START.md`)
2. `src/backend/client/SkaftinClient.ts` - Unified client (see Step 3 in `00-QUICK-START.md`)
3. `src/backend/index.ts` - Main export (see Step 4 in `00-QUICK-START.md`)

That's it! You can start using the SDK with just these 3 files.

---

## Complete Structure (With All Optional Files)

For projects that need backward compatibility or additional features:

```
your-react-app/
├── .env                          ← Environment variables
└── src/
    └── backend/
        ├── client/
        │   └── SkaftinClient.ts  ← REQUIRED: Unified client
        │
        ├── config/
        │   └── skaftin.config.ts ← Optional: Backward compatibility
        │
        ├── utils/
        │   ├── auth.ts           ← Optional: Backward compatibility
        │   ├── request.ts        ← Optional: Backward compatibility
        │   └── debugLogger.ts    ← Optional: Debug logging
        │
        ├── services/             ← Optional: Service classes
        │   ├── TableService.ts
        │   ├── AppAuthService.ts
        │   ├── GraphQLService.ts
        │   ├── WebSocketService.ts
        │   └── index.ts
        │
        ├── hooks/                ← Optional: React hooks
        │   └── useWebSocket.ts
        │
        ├── types/                ← Optional: TypeScript types
        │   └── api.types.ts
        │
        └── index.ts              ← REQUIRED: Main export
```

---

## File Descriptions

### Required Files

#### `src/backend/client/SkaftinClient.ts`
- **Purpose:** Unified client for all Skaftin API interactions
- **Contains:** Configuration, authentication, and all HTTP methods
- **Status:** ✅ REQUIRED
- **See:** Step 3 in `00-QUICK-START.md` for complete code

#### `src/backend/index.ts`
- **Purpose:** Main export point for the SDK
- **Contains:** Exports the client and optional utilities
- **Status:** ✅ REQUIRED
- **Example:**
```typescript
export { skaftinClient, SkaftinClient } from './client/SkaftinClient';
export type { ApiResponse } from './client/SkaftinClient';
```

#### `.env`
- **Purpose:** Environment variables for configuration
- **Contains:** API URL, API key/token
- **Status:** ✅ REQUIRED
- **See:** Step 1 in `00-QUICK-START.md`

---

### Optional Files (Backward Compatibility)

#### `src/backend/config/skaftin.config.ts`
- **Purpose:** Configuration wrapper for backward compatibility
- **When to use:** If you have existing code using `SKAFTIN_CONFIG`
- **Status:** ⚠️ Optional
- **See:** `02-AUTHENTICATION.md` for implementation

#### `src/backend/utils/auth.ts`
- **Purpose:** Auth utilities that delegate to the client
- **When to use:** If you have existing code using `getAuthHeaders()`, `isAuthenticated()`, etc.
- **Status:** ⚠️ Optional
- **Functions:**
  - `getAuthHeaders()` - Returns auth headers
  - `isAuthenticated()` - Checks if credentials are configured
  - `getProjectId()` - Gets project ID if set
  - `getApiUrl()` - Gets API base URL

#### `src/backend/utils/request.ts`
- **Purpose:** Request wrappers that use the client internally
- **When to use:** If you have existing code using `get()`, `post()`, etc.
- **Status:** ⚠️ Optional
- **Functions:**
  - `get<T>(endpoint, params?)` - GET request
  - `post<T>(endpoint, body)` - POST request
  - `put<T>(endpoint, body)` - PUT request
  - `patch<T>(endpoint, body)` - PATCH request
  - `del<T>(endpoint, body?)` - DELETE request
  - `apiRequest<T>(endpoint, options)` - Custom request

---

### Optional Files (Additional Features)

#### `src/backend/services/`
- **Purpose:** Service classes for structured data access
- **When to use:** When you want type-safe service classes per table
- **Status:** ⚠️ Optional
- **See:** `04-SERVICE-GENERATION.md` for details
- **Common services:**
  - `TableService.ts` - Base service class (REQUIRED for other services)
  - `AppAuthService.ts` - User management
  - `GraphQLService.ts` - GraphQL queries
  - `WebSocketService.ts` - Real-time updates
  - `BucketService.ts` - Storage bucket management
  - `DataService.ts` - Example custom service
  - `index.ts` - Service exports

#### `src/backend/hooks/`
- **Purpose:** React hooks for SDK features
- **When to use:** For React components that need SDK functionality
- **Status:** ⚠️ Optional
- **Common hooks:**
  - `useWebSocket.ts` - WebSocket connection and event hooks
    - `useWebSocket()` - Connection status hook
    - `useDatabaseEvents()` - Listen to database changes
    - `useProjectEvents()` - Listen to project events
    - `useAutoRefresh()` - Auto-refresh on data changes

#### `src/backend/types/`
- **Purpose:** TypeScript type definitions
- **When to use:** For shared types across your app
- **Status:** ⚠️ Optional
- **Common types:**
  - `api.types.ts` - API response types, base entities, etc.

---

## Quick Reference

### For New Projects (Minimal)
```
✅ .env
✅ src/backend/client/SkaftinClient.ts
✅ src/backend/index.ts
```

### For Existing Projects (With Compatibility)
```
✅ .env
✅ src/backend/client/SkaftinClient.ts
✅ src/backend/index.ts
⚠️ src/backend/config/skaftin.config.ts (if using old config)
⚠️ src/backend/utils/auth.ts (if using old auth utils)
⚠️ src/backend/utils/request.ts (if using old request utils)
```

### For Full-Featured Projects
```
✅ All required files
⚠️ All optional backward compatibility files
⚠️ Services, hooks, and types as needed
```

---

## Implementation Checklist

### Phase 1: Minimal Setup (5 minutes)
- [ ] Create `.env` file with credentials
- [ ] Create `src/backend/client/SkaftinClient.ts`
- [ ] Create `src/backend/index.ts`
- [ ] Test with: `import { skaftinClient } from './backend'`

### Phase 2: Backward Compatibility (if needed)
- [ ] Create `src/backend/config/skaftin.config.ts` (if using old config)
- [ ] Create `src/backend/utils/auth.ts` (if using old auth utils)
- [ ] Create `src/backend/utils/request.ts` (if using old request utils)

### Phase 3: Additional Features (as needed)
- [ ] Create services (see `04-SERVICE-GENERATION.md`)
- [ ] Create hooks (see `08-WEBSOCKET-INTEGRATION.md`)
- [ ] Create types (see `03-TYPE-GENERATION.md`)

---

## File Size Reference

Approximate file sizes for reference:

- `SkaftinClient.ts` - ~280 lines (complete implementation)
- `index.ts` - ~10 lines (simple exports)
- `skaftin.config.ts` - ~15 lines (wrapper)
- `auth.ts` - ~30 lines (delegates to client)
- `request.ts` - ~50 lines (delegates to client)

**Total minimal setup:** ~290 lines of code
**With backward compatibility:** ~385 lines of code

---

## Next Steps

1. **Start with minimal setup:** Follow `00-QUICK-START.md`
2. **Add backward compatibility:** See `02-AUTHENTICATION.md` Step 4
3. **Add services and hooks:** See `HOOKS_AND_SERVICES.md` for complete implementations
4. **Add features:** See other guides as needed

---

**Note:** All files are provided in the documentation. Copy-paste ready code is available in:
- `00-QUICK-START.md` - Minimal setup (client only)
- `02-AUTHENTICATION.md` - Complete implementation with backward compatibility
- `HOOKS_AND_SERVICES.md` - Complete hooks and services implementations ⭐ NEW

