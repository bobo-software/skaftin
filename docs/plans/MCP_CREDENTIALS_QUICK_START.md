# MCP Credentials Tools - Quick Start

✅ **MCP tools for managing API credentials are now available!**

---

## 🎉 What's New

You now have **8 new MCP tools** to manage API credentials programmatically:

1. **`list_api_credentials`** - List all credentials
2. **`get_api_credential`** - Get specific credential details
3. **`create_api_credential`** - Create new API keys/access tokens
4. **`update_api_credential`** - Update permissions/status
5. **`delete_api_credential`** - Delete credentials
6. **`get_mcp_key`** - Get MCP key for project
7. **`regenerate_mcp_key`** - Create/regenerate MCP key
8. **`get_credential_permissions`** - List available permissions

---

## 🚀 Quick Example: Get Your API Keys

Using Cursor's MCP interface:

```json
{
  "tool": "list_api_credentials",
  "arguments": {
    "projectId": "1"
  }
}
```

Or via HTTP:

```bash
curl -X POST http://localhost:4006/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -H "x-mcp-key: your_mcp_key_here" \
  -d '{
    "name": "list_api_credentials",
    "arguments": {
      "projectId": "1"
    }
  }'
```

---

## 💡 Solving Your Original Problem

Remember you were trying to test `/api/app-auth/auth/register` but didn't have an API key? 

Now you can:

### Step 1: Get your MCP key (if you have one)
```json
{
  "tool": "get_mcp_key",
  "arguments": { "projectId": "1" }
}
```

### Step 2: Create a new API key for testing
```json
{
  "tool": "create_api_credential",
  "arguments": {
    "projectId": "1",
    "name": "Test API Key",
    "type": "api_key",
    "permissions": ["database:read", "database:write", "auth:read", "auth:write"]
  }
}
```

### Step 3: Use the new API key in your registration request
```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_your_new_key_here" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "SecurePass123!",
    "phone": "+1234567890"
  }'
```

---

## 📋 All Available Permissions

Use `get_credential_permissions` to see all available permissions:

```json
{
  "database": [
    "database:read",
    "database:write",
    "database:delete",
    "database:schema"
  ],
  "storage": [
    "storage:read",
    "storage:write",
    "storage:delete"
  ],
  "auth": [
    "auth:read",
    "auth:write"
  ],
  "graphql": [
    "graphql:query",
    "graphql:mutate"
  ],
  "communications": [
    "communications:read",
    "communications:write"
  ],
  "mcp": [
    "mcp:full_access"
  ]
}
```

---

## 🔐 MCP Key Management

### Get your MCP key
```json
{
  "tool": "get_mcp_key",
  "arguments": { "projectId": "1" }
}
```

### Create/regenerate MCP key
```json
{
  "tool": "regenerate_mcp_key",
  "arguments": { "projectId": "1" }
}
```

**⚠️ Important:** MCP keys have `mcp:full_access` permission. Store them securely!

---

## 📖 Documentation

Full documentation available at:
- `docs/MCP_CREDENTIALS_TOOLS.md` - Complete guide
- `docs/MCP_KEY_FEATURE.md` - MCP key system
- `docs/client-sdk/02-AUTHENTICATION.md` - Using API keys in client apps

---

## ✅ Files Created/Updated

### New Files:
- `go-services/internal/mcp/tools_credentials.go` - MCP credentials tools implementation
- `docs/MCP_CREDENTIALS_TOOLS.md` - Complete documentation
- `MCP_CREDENTIALS_QUICK_START.md` - This file

### Updated Files:
- `go-services/internal/mcp/server.go` - Registered credentials tools
- `go-services/internal/mcp/http.go` - Added HTTP endpoint support

---

## 🎯 Next Steps

1. **Try listing your credentials:**
   ```
   Use the list_api_credentials tool to see what credentials exist
   ```

2. **Create a test API key:**
   ```
   Use create_api_credential to generate a key for testing
   ```

3. **Test the app-auth endpoints:**
   ```
   Now you have an API key to use with /api/app-auth/auth/register
   ```

4. **Automate credential management:**
   ```
   Use these tools in your scripts for rotation and auditing
   ```

---

**You're all set!** 🎉

You now have full programmatic access to manage API credentials through MCP tools.

