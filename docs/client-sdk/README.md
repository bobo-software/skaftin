# Client SDK Integration Guides

## Quick Start

Welcome to the Skaftin Client SDK guides! These documents will help you integrate external React applications with your Skaftin backend.

## 📚 Read in Order

0. **[00-QUICK-START.md](./00-QUICK-START.md)** ⭐ NEW
   - Get started in 5 minutes
   - Copy-paste ready code
   - Minimal setup required
   - Complete folder structure shown

0.5. **[FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)** ⭐ NEW
   - Complete folder structure reference
   - File descriptions and purposes
   - Implementation checklist
   - Minimal vs complete structure

0.6. **[HOOKS_AND_SERVICES.md](./HOOKS_AND_SERVICES.md)** ⭐ NEW
   - Complete service implementations
   - React hooks implementations
   - Copy-paste ready code
   - Usage examples

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)**
   - What is the Client SDK
   - Architecture overview (now with unified client!)
   - Benefits and features
   - Authentication models

2. **[02-AUTHENTICATION.md](./02-AUTHENTICATION.md)** ⭐ UPDATED
   - Create API credentials (API keys/tokens)
   - Configure environment variables
   - Set up auth headers (x-api-key, x-access-token)
   - Project auto-detection from credentials
   - Security best practices

3. **[03-TYPE-GENERATION.md](./03-TYPE-GENERATION.md)**
   - Generate TypeScript types from database
   - Create schema interfaces
   - DTOs for create/update operations
   - Type safety patterns

4. **[04-SERVICE-GENERATION.md](./04-SERVICE-GENERATION.md)**
   - Create base service class
   - Generate per-table services
   - CRUD operations
   - Custom query methods

5. **[05-GRAPHQL-INTEGRATION.md](./05-GRAPHQL-INTEGRATION.md)**
   - GraphQL service setup
   - Query and mutation examples
   - REST vs GraphQL comparison
   - When to use each

6. **[06-USAGE-EXAMPLES.md](./06-USAGE-EXAMPLES.md)**
   - Complete React component examples
   - Common patterns
   - Error handling
   - Testing integration

7. **[07-APP-USER-AUTHENTICATION.md](./07-APP-USER-AUTHENTICATION.md)** ⭐ UPDATED
   - Application user registration & login (JWT)
   - **SuperTokens integration** for automatic session management
   - **Zustand AuthStore** for state management
   - Simplified auth endpoints (no project ID in URL)
   - Role-based access control
   - Custom user fields
   - Session management with automatic token refresh
   - Protected routes & token verification

8. **[08-WEBSOCKET-INTEGRATION.md](./08-WEBSOCKET-INTEGRATION.md)** ⭐ NEW
   - Real-time database change notifications
   - WebSocket service setup
   - React hooks for WebSocket
   - Auto-refresh patterns
   - Connection management

## 🎯 What You'll Build

By following these guides, you'll have a complete `src/backend/` folder in your React app with:

```
src/backend/
├── client/          → Unified SkaftinClient (NEW!)
│   └── SkaftinClient.ts → Single client for all API interactions
├── config/          → API configuration (simplified)
├── schemas/         → TypeScript types (from database)
├── services/        → API service methods
│   ├── DataService.ts         → Your custom tables
│   ├── AppAuthService.ts      → User management
│   └── WebSocketService.ts    → Real-time updates
├── hooks/           → React hooks
│   └── useWebSocket.ts        → WebSocket hooks
├── types/           → API response types
└── utils/           → Auth & request helpers (backward compatible)
```

## ⚡ Quick Examples

After setup, using Skaftin in your app is simple:

**Option 1: Unified Client (Recommended - New!)** ⭐
```typescript
import { skaftinClient } from './backend';

// Direct API calls - fully typed!
const response = await skaftinClient.get('/app-api/database/tables/associations/select');
const associations = response.data;

// Create record
await skaftinClient.post('/app-api/database/tables/associations/insert', {
  data: { name: 'New Association' }
});
```

**Option 2: Service Classes (Traditional)**
```typescript
import AssociationService from './backend/services/AssociationService';

// Fully typed!
const associations = await AssociationService.findAll();
```

**User Management:** ⭐
```typescript
import AppAuthService from './backend/services/AppAuthService';

// Create a user
await AppAuthService.createUser({
  name: "John Doe",
  email: "john@example.com",
  password: "secure123",
  metadata: { department: "Engineering" }
});

// List users with filters
const { users } = await AppAuthService.listUsers({
  search: "john",
  is_active: true
});
```

**Real-Time Updates:** ⭐
```typescript
import { useAutoRefresh } from './backend/hooks/useWebSocket';

// Auto-refresh when data changes
useAutoRefresh(projectId, 'vehicles', () => {
  loadVehicles();
});
```

## 🔑 Prerequisites

- Skaftin project created
- API credentials generated
- React app ready
- TypeScript configured

## 🚀 Estimated Time

- **Initial Setup:** 30 minutes
- **Per Table:** 5-10 minutes
- **Testing:** 15 minutes
- **Total:** ~1-2 hours for complete integration

## ⚡ What's New (Updated Dec 2024)

### ⭐ Unified Client Architecture (NEW!)

✅ **Single Client for Everything**
- New: `SkaftinClient` - One class handles all API interactions
- Auto-loads configuration from environment variables
- No manual initialization needed
- Automatic authentication header management
- Built-in JWT token injection for app user requests

✅ **Simplified Setup**
- Old: Multiple files (config, auth utils, request utils)
- New: Single `SkaftinClient.ts` file
- Backward compatible - existing code still works

✅ **Cleaner API**
```typescript
// New way (recommended)
import { skaftinClient } from './backend';
const data = await skaftinClient.get('/app-api/...');

// Old way (still works)
import { get } from './backend/utils/request';
const data = await get('/app-api/...');
```

### Simplified Authentication

✅ **No Project ID Required in Any Endpoints**
- Old: `POST /app-api/database/:projectId/tables/...`
- New: `POST /app-api/database/tables/...` (project extracted from API key)
- Applies to: Database, Storage, and Auth management routes

✅ **Cleaner Headers**
- Use `X-API-Key` (capital X) or `x-access-token` for platform authentication
- Project automatically identified from credentials
- No need to pass project ID in URLs or headers
- JWT tokens automatically injected from Zustand AuthStore

✅ **Two-Layer Authentication Clarified**
- **Platform Auth** (02-AUTHENTICATION.md) - Your app authenticates with Skaftin
- **App User Auth** (07-APP-USER-AUTHENTICATION.md) - Your users authenticate with your app

### Updated Service Examples

✅ **SuperTokens Integration** - Automatic session management and token refresh  
✅ **Zustand AuthStore** - State management for user sessions  
✅ **AppUserAuthService** - Handle user registration/login/logout  
✅ **UserManagementService** - Admin management of users  
✅ **Protected Routes** - Token verification patterns  
✅ **JWT Storage** - Stored in Zustand with persistence

---

## 💡 Current Status

**Manual Setup:**
These guides show you how to manually create the SDK structure. This is perfect for:
- Learning the system
- Customizing for your needs
- Full control over generated code

**Future: Automated Generator**
- Click "Generate SDK" in Skaftin UI
- Download complete `src/backend/` folder
- Paste into your project
- Start using immediately

## 🆘 Getting Help

**Issues?**
- Check troubleshooting sections in each guide
- Review your API credentials in Skaftin
- Test with the provided test scripts
- Check browser/server console for errors

**Common Problems:**
- CORS errors → Check `VITE_API_URL` is empty in dev
- 401 errors → Verify API key is correct
- 403 errors → Check credential permissions
- Type errors → Regenerate types from schema

## 📖 Additional Resources

- **Skaftin Documentation:** `/docs/`
- **API Endpoints:** `docs/DATABASE_API_SUMMARY.md`
- **GraphQL Schema:** `docs/GRAPHQL_API_GUIDE.md`
- **MCP Integration:** `docs/MCP_KEY_FEATURE.md`

## ✨ Happy Coding!

Start with `01-OVERVIEW.md` and work through each guide in order. By the end, you'll have a fully typed, secure, production-ready integration!

