# Client SDK Integration Guides

## Quick Start

Welcome to the Skaftin Client SDK guides! These documents will help you integrate external React applications with your Skaftin backend.

## 📚 Read in Order

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)**
   - What is the Client SDK
   - Architecture overview
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
   - Simplified auth endpoints (no project ID in URL)
   - Role-based access control
   - Custom user fields
   - Session management with JWT tokens
   - Protected routes & token verification

## 🎯 What You'll Build

By following these guides, you'll have a complete `src/backend/` folder in your React app with:

```
src/backend/
├── config/          → API configuration
├── schemas/         → TypeScript types (from database)
├── services/        → API service methods
│   ├── DataService.ts      → Your custom tables
│   └── AppAuthService.ts   → User management (NEW)
├── types/           → API response types
└── utils/           → Auth & request helpers
```

## ⚡ Quick Examples

After setup, using Skaftin in your app is simple:

**Data Access:**
```typescript
import AssociationService from './backend/services/AssociationService';

// Fully typed!
const associations = await AssociationService.findAll();
```

**User Management:** ⭐ NEW
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

## ⚡ What's New (Updated Nov 2025)

### Simplified Authentication

✅ **No Project ID Required in Auth Endpoints**
- Old: `POST /api/app-auth/:projectId/auth/login`
- New: `POST /api/app-auth/auth/login` (project extracted from API key)

✅ **Cleaner Headers**
- Use `x-api-key` or `x-access-token` (lowercase)
- Project automatically identified from credentials

✅ **Two-Layer Authentication Clarified**
- **Platform Auth** (02-AUTHENTICATION.md) - Your app authenticates with Skaftin
- **App User Auth** (07-APP-USER-AUTHENTICATION.md) - Your users authenticate with your app

### Updated Service Examples

✅ **AppUserAuthService** - Handle user registration/login/logout  
✅ **UserManagementService** - Admin management of users  
✅ **Protected Routes** - Token verification patterns  
✅ **JWT Storage** - Best practices for token storage

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

