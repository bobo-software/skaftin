# MCP Credentials Management Tools

**Date:** November 12, 2025  
**Status:** ✅ Complete

---

## Overview

New MCP tools for managing API credentials (API keys, access tokens, and MCP keys) directly through the MCP protocol. These tools allow you to list, create, update, and delete credentials programmatically.

---

## Available Tools

### 1. list_api_credentials

List all API credentials for a project.

**Parameters:**
```typescript
{
  projectId: string;          // Required
  type?: 'api_key' | 'access_token' | 'mcp_key';  // Optional filter
  include_inactive?: boolean; // Default: false
}
```

**Example:**
```json
{
  "tool": "list_api_credentials",
  "arguments": {
    "projectId": "1",
    "include_inactive": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "credentials": [
    {
      "id": 42,
      "project_id": 1,
      "name": "Production API Key",
      "credential_type": "api_key",
      "token": "sk_abc123...",  // Truncated in list view
      "permissions": ["database:read", "database:write"],
      "is_active": true,
      "created_at": "2025-11-12T10:00:00Z",
      "last_used_at": "2025-11-12T15:30:00Z"
    }
  ],
  "count": 1
}
```

---

### 2. get_api_credential

Get details of a specific API credential.

**Parameters:**
```typescript
{
  projectId: string;      // Required
  credentialId: string;   // Required
}
```

**Example:**
```json
{
  "tool": "get_api_credential",
  "arguments": {
    "projectId": "1",
    "credentialId": "42"
  }
}
```

**Response:**
```json
{
  "success": true,
  "credential": {
    "id": 42,
    "project_id": 1,
    "name": "Production API Key",
    "credential_type": "api_key",
    "token": "sk_abc123def456...",  // Full token shown
    "permissions": ["database:read", "database:write"],
    "is_active": true,
    "expires_at": null,
    "created_at": "2025-11-12T10:00:00Z",
    "updated_at": "2025-11-12T10:00:00Z",
    "last_used_at": "2025-11-12T15:30:00Z"
  }
}
```

---

### 3. create_api_credential

Create a new API key or access token.

**Parameters:**
```typescript
{
  projectId: string;                          // Required
  name: string;                               // Required
  type: 'api_key' | 'access_token';          // Required (MCP keys use regenerate_mcp_key)
  permissions?: string[];                     // Optional, e.g., ["database:read", "database:write"]
  expires_in_days?: number;                   // Optional (null = never expires)
}
```

**Example:**
```json
{
  "tool": "create_api_credential",
  "arguments": {
    "projectId": "1",
    "name": "Mobile App API Key",
    "type": "api_key",
    "permissions": ["database:read", "storage:read"],
    "expires_in_days": 365
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "API credential created successfully",
  "credential": {
    "id": 43,
    "project_id": 1,
    "name": "Mobile App API Key",
    "credential_type": "api_key",
    "token": "sk_new_token_here_save_this_now",
    "permissions": ["database:read", "storage:read"],
    "expires_at": "2026-11-12T10:00:00Z",
    "is_active": true,
    "created_at": "2025-11-12T16:00:00Z"
  },
  "warning": "⚠️  IMPORTANT: Save the token now! You won't be able to see it again."
}
```

---

### 4. update_api_credential

Update an existing API credential (name, permissions, or status).

**Parameters:**
```typescript
{
  projectId: string;      // Required
  credentialId: string;   // Required
  name?: string;          // Optional
  permissions?: string[]; // Optional
  is_active?: boolean;    // Optional
}
```

**Example:**
```json
{
  "tool": "update_api_credential",
  "arguments": {
    "projectId": "1",
    "credentialId": "42",
    "name": "Updated API Key Name",
    "permissions": ["database:read", "database:write", "storage:read"],
    "is_active": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credential updated successfully",
  "credential": {
    "id": 42,
    "name": "Updated API Key Name",
    "permissions": ["database:read", "database:write", "storage:read"],
    "is_active": true,
    "updated_at": "2025-11-12T16:30:00Z"
  }
}
```

---

### 5. delete_api_credential

Delete an API credential.

**Parameters:**
```typescript
{
  projectId: string;      // Required
  credentialId: string;   // Required
}
```

**Example:**
```json
{
  "tool": "delete_api_credential",
  "arguments": {
    "projectId": "1",
    "credentialId": "42"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credential deleted successfully"
}
```

---

### 6. get_mcp_key

Get the MCP key for a project (one per project).

**Parameters:**
```typescript
{
  projectId: string;  // Required
}
```

**Example:**
```json
{
  "tool": "get_mcp_key",
  "arguments": {
    "projectId": "1"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "credential": {
    "id": 50,
    "project_id": 1,
    "name": "MCP Integration Key",
    "credential_type": "mcp_key",
    "token": "mcp_64_character_hex_string_here",
    "permissions": ["mcp:full_access"],
    "is_active": true,
    "expires_at": null,
    "created_at": "2025-11-12T10:00:00Z",
    "last_used_at": "2025-11-12T17:00:00Z"
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "No MCP key found for this project. Use regenerate_mcp_key to create one."
}
```

---

### 7. regenerate_mcp_key

Create or regenerate the MCP key for a project.

**Parameters:**
```typescript
{
  projectId: string;  // Required
}
```

**Example:**
```json
{
  "tool": "regenerate_mcp_key",
  "arguments": {
    "projectId": "1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "MCP key regenerated successfully",
  "credential": {
    "id": 50,
    "project_id": 1,
    "name": "MCP Integration Key",
    "credential_type": "mcp_key",
    "token": "mcp_new_64_character_hex_string",
    "permissions": ["mcp:full_access"],
    "is_active": true,
    "expires_at": null,
    "created_at": "2025-11-12T10:00:00Z",
    "updated_at": "2025-11-12T17:30:00Z"
  },
  "warning": "⚠️  IMPORTANT: Save the token now! You won't be able to see it again."
}
```

---

### 8. get_credential_permissions

Get a list of available permissions for API credentials.

**Parameters:**
```typescript
{}  // No parameters required
```

**Example:**
```json
{
  "tool": "get_credential_permissions",
  "arguments": {}
}
```

**Response:**
```json
{
  "success": true,
  "permissions": {
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
  },
  "description": "Available permissions for API credentials (grouped by category)"
}
```

---

## Usage Examples

### Example 1: List All Credentials for Project 1

```bash
curl -X POST http://localhost:4006/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -H "x-mcp-key: mcp_your_key_here" \
  -d '{
    "name": "list_api_credentials",
    "arguments": {
      "projectId": "1"
    }
  }'
```

### Example 2: Create a New API Key

```bash
curl -X POST http://localhost:4006/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -H "x-mcp-key: mcp_your_key_here" \
  -d '{
    "name": "create_api_credential",
    "arguments": {
      "projectId": "1",
      "name": "Development API Key",
      "type": "api_key",
      "permissions": ["database:read", "database:write"]
    }
  }'
```

### Example 3: Get MCP Key for Project

```bash
curl -X POST http://localhost:4006/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -H "x-mcp-key: mcp_your_key_here" \
  -d '{
    "name": "get_mcp_key",
    "arguments": {
      "projectId": "1"
    }
  }'
```

### Example 4: Update Credential Permissions

```bash
curl -X POST http://localhost:4006/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -H "x-mcp-key: mcp_your_key_here" \
  -d '{
    "name": "update_api_credential",
    "arguments": {
      "projectId": "1",
      "credentialId": "42",
      "permissions": ["database:read", "database:write", "storage:write"]
    }
  }'
```

---

## Use Cases

### 1. Automated Credential Rotation

```typescript
// Rotate API keys every 90 days
async function rotateApiKey(projectId: string, oldCredentialId: string) {
  // Create new API key
  const newCred = await mcpClient.call('create_api_credential', {
    projectId,
    name: 'Rotated API Key',
    type: 'api_key',
    permissions: ['database:read', 'database:write'],
    expires_in_days: 90
  });
  
  // Update your application with new key
  await updateApplicationConfig(newCred.credential.token);
  
  // Delete old key
  await mcpClient.call('delete_api_credential', {
    projectId,
    credentialId: oldCredentialId
  });
  
  return newCred.credential.token;
}
```

### 2. Multi-Environment Credential Management

```typescript
// Create credentials for different environments
const environments = ['development', 'staging', 'production'];

for (const env of environments) {
  const permissions = env === 'production' 
    ? ['database:read']  // Read-only in prod
    : ['database:read', 'database:write', 'database:delete'];
  
  await mcpClient.call('create_api_credential', {
    projectId: '1',
    name: `${env.charAt(0).toUpperCase() + env.slice(1)} API Key`,
    type: 'api_key',
    permissions,
    expires_in_days: env === 'production' ? null : 365
  });
}
```

### 3. Credential Audit

```typescript
// List all credentials and check for inactive or expired ones
async function auditCredentials(projectId: string) {
  const response = await mcpClient.call('list_api_credentials', {
    projectId,
    include_inactive: true
  });
  
  const now = new Date();
  const audit = {
    total: response.credentials.length,
    active: 0,
    inactive: 0,
    expired: 0,
    expiring_soon: 0
  };
  
  for (const cred of response.credentials) {
    if (!cred.is_active) {
      audit.inactive++;
      continue;
    }
    
    if (cred.expires_at) {
      const expiresAt = new Date(cred.expires_at);
      const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilExpiry < 0) {
        audit.expired++;
      } else if (daysUntilExpiry < 30) {
        audit.expiring_soon++;
      }
    }
    
    audit.active++;
  }
  
  return audit;
}
```

---

## Permission Categories

### Database Permissions
- `database:read` - Query data
- `database:write` - Insert/update data
- `database:delete` - Delete data
- `database:schema` - Modify schema (create tables, etc.)

### Storage Permissions
- `storage:read` - View files
- `storage:write` - Upload files
- `storage:delete` - Delete files

### Auth Permissions
- `auth:read` - View users/roles
- `auth:write` - Manage users/roles

### GraphQL Permissions
- `graphql:query` - Execute GraphQL queries
- `graphql:mutate` - Execute GraphQL mutations

### Communications Permissions
- `communications:read` - View email providers/templates
- `communications:write` - Manage emails

### MCP Permissions
- `mcp:full_access` - Full MCP access (MCP keys only)

---

## Security Best Practices

1. **Principle of Least Privilege**
   - Grant only necessary permissions
   - Use read-only keys when possible

2. **Regular Rotation**
   - Rotate API keys every 90 days
   - Immediately rotate compromised keys

3. **Expiration Dates**
   - Set expiration dates for temporary credentials
   - Never expire production keys = risk

4. **Audit Trail**
   - Regularly audit credential usage via `last_used_at`
   - Remove unused credentials

5. **Secure Storage**
   - Store tokens in environment variables
   - Never commit tokens to version control
   - Use secrets management (AWS Secrets Manager, etc.)

---

## Error Handling

### Common Errors

**404 - Credential Not Found**
```json
{
  "success": false,
  "error": "Credential not found"
}
```
→ Check credential ID is correct

**400 - Invalid Credential Type**
```json
{
  "success": false,
  "error": "Invalid credential type. Must be api_key or access_token. Use regenerate_mcp_key for MCP keys."
}
```
→ Use `regenerate_mcp_key` tool for MCP keys

**500 - Database Error**
```json
{
  "success": false,
  "error": "Database connection failed",
  "tool": "create_api_credential"
}
```
→ Check database is running and accessible

---

## Related Documentation

- `docs/MCP_KEY_FEATURE.md` - MCP key system overview
- `docs/API_CREDENTIALS_FEATURE_SUMMARY.md` - API credentials feature
- `docs/MCP_FEATURES.md` - Complete MCP features guide

---

## Summary

✅ **8 new MCP tools** for credential management  
✅ **List, create, update, delete** API credentials  
✅ **MCP key management** (get/regenerate)  
✅ **Permission listing** for credential configuration  
✅ **Full audit trail** via last_used_at timestamps  
✅ **Secure token generation** using crypto.randomBytes  

**Use these tools to automate credential management, rotation, and auditing in your Skaftin projects!**

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

