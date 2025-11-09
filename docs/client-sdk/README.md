# Client SDK Integration Guides

## Quick Start

Welcome to the Skaftin Client SDK guides! These documents will help you integrate external React applications with your Skaftin backend.

## 📚 Read in Order

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)**
   - What is the Client SDK
   - Architecture overview
   - Benefits and features
   - Authentication models

2. **[02-AUTHENTICATION.md](./02-AUTHENTICATION.md)**
   - Create API credentials
   - Configure environment variables
   - Set up auth headers
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

## 🎯 What You'll Build

By following these guides, you'll have a complete `src/backend/` folder in your React app with:

```
src/backend/
├── config/          → API configuration
├── schemas/         → TypeScript types (from database)
├── services/        → API service methods
├── types/           → API response types
└── utils/           → Auth & request helpers
```

## ⚡ Quick Example

After setup, using Skaftin in your app is simple:

```typescript
import AssociationService from './backend/services/AssociationService';

// Fully typed!
const associations = await AssociationService.findAll();
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

