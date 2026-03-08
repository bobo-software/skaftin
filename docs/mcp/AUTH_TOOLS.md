# MCP Auth Tools

This document describes the MCP (Model Context Protocol) tools available for interacting with the application authentication and user management system.

## Overview

The Auth Tools provide programmatic access to:
- **User Management**: Create, read, update, and delete application users
- **Role Management**: Manage roles and permissions
- **Custom Fields**: Define and apply custom user fields
- **Auth Settings**: Configure authentication settings per project

### Client Endpoint Project Scoping

For client MCP endpoint calls (`/app-api/mcp/*`), project context is resolved from the API key/Bearer token.

- `projectId` can be omitted in client tool calls
- If `projectId` is provided, it must match the token-bound project
- Admin MCP endpoint (`/api/mcp/*`) still uses explicit `projectId`

## User Management Tools

### `list_app_users`

List application users for a project with optional filters.

**Parameters:**
- `projectId` (string, required): Project ID
- `search` (string, optional): Search by name or email
- `role_id` (string, optional): Filter by role ID
- `is_active` (boolean, optional): Filter by active status
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of users per page (default: 50)

**Example:**
```json
{
  "projectId": "1",
  "search": "john",
  "is_active": true,
  "page": 1,
  "limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "is_active": true,
      "metadata": {},
      "roles": [
        {
          "id": 1,
          "role_name": "Admin",
          "role_key": "admin"
        }
      ],
      "created_at": "2025-11-12T10:00:00Z",
      "updated_at": "2025-11-12T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

### `get_app_user`

Get a specific application user by ID.

**Parameters:**
- `projectId` (string, required): Project ID
- `userId` (string, required): User ID

**Example:**
```json
{
  "projectId": "1",
  "userId": "5"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 5,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+0987654321",
    "is_active": true,
    "metadata": {
      "department": "Engineering"
    },
    "roles": [
      {
        "id": 2,
        "role_name": "User",
        "role_key": "user"
      }
    ]
  }
}
```

---

### `create_app_user`

Create a new application user.

**Parameters:**
- `projectId` (string, required): Project ID
- `name` (string, required): User full name
- `email` (string, required): User email address
- `password` (string, required): User password (will be hashed)
- `phone` (string, optional): User phone number
- `metadata` (object, optional): Custom field values
- `role_ids` (array of numbers, optional): Role IDs to assign

**Note:** When using MCP tools, password creation is not handled by SuperTokens. For full SuperTokens integration (password hashing, verification, etc.), use the HTTP API endpoints instead.

**Example:**
```json
{
  "projectId": "1",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "SecurePassword123!",
  "phone": "+1122334455",
  "metadata": {
    "department": "Marketing"
  },
  "role_ids": [2]
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully (Note: Password not set via MCP - use HTTP API for password)",
  "user": {
    "id": 10,
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1122334455",
    "metadata": {
      "department": "Marketing"
    },
    "is_active": true,
    "created_at": "2025-11-12T11:00:00Z"
  }
}
```

---

### `update_app_user`

Update an existing application user.

**Parameters:**
- `projectId` (string, required): Project ID
- `userId` (string, required): User ID
- `name` (string, optional): Updated name
- `email` (string, optional): Updated email
- `phone` (string, optional): Updated phone
- `metadata` (object, optional): Updated metadata
- `is_active` (boolean, optional): Active status

**Example:**
```json
{
  "projectId": "1",
  "userId": "10",
  "name": "Alice Johnson-Brown",
  "metadata": {
    "department": "Sales"
  }
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 10,
    "name": "Alice Johnson-Brown",
    "email": "alice@example.com",
    "metadata": {
      "department": "Sales"
    },
    "updated_at": "2025-11-12T12:00:00Z"
  }
}
```

---

### `delete_app_user`

Delete (deactivate or permanently remove) an application user.

**Parameters:**
- `projectId` (string, required): Project ID
- `userId` (string, required): User ID
- `permanent` (boolean, optional): Permanently delete (true) or deactivate (false, default: false)

**Example (Deactivate):**
```json
{
  "projectId": "1",
  "userId": "10",
  "permanent": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User deactivated"
}
```

**Example (Permanent Delete):**
```json
{
  "projectId": "1",
  "userId": "10",
  "permanent": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User permanently deleted"
}
```

---

### `assign_user_role`

Assign a role to an application user.

**Parameters:**
- `projectId` (string, required): Project ID
- `userId` (string, required): User ID
- `roleId` (number, required): Role ID to assign

**Example:**
```json
{
  "projectId": "1",
  "userId": "10",
  "roleId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role assigned successfully"
}
```

---

## Role Management Tools

### `list_app_roles`

List all roles for a project.

**Parameters:**
- `projectId` (string, required): Project ID
- `include_user_count` (boolean, optional): Include count of users per role (default: false)

**Example:**
```json
{
  "projectId": "1",
  "include_user_count": true
}
```

**Response:**
```json
{
  "success": true,
  "roles": [
    {
      "id": 1,
      "role_name": "Admin",
      "role_key": "admin",
      "description": "Administrator with full access",
      "permissions": ["*"],
      "session_duration_minutes": 60,
      "is_system_role": true,
      "user_count": 5
    },
    {
      "id": 2,
      "role_name": "User",
      "role_key": "user",
      "description": "Standard user with limited access",
      "permissions": ["read"],
      "session_duration_minutes": 10080,
      "is_system_role": true,
      "user_count": 25
    }
  ]
}
```

---

### `get_app_role`

Get a specific role by ID.

**Parameters:**
- `projectId` (string, required): Project ID
- `roleId` (string, required): Role ID

**Example:**
```json
{
  "projectId": "1",
  "roleId": "1"
}
```

**Response:**
```json
{
  "success": true,
  "role": {
    "id": 1,
    "role_name": "Admin",
    "role_key": "admin",
    "description": "Administrator with full access",
    "permissions": ["*"],
    "session_duration_minutes": 60,
    "is_system_role": true
  }
}
```

---

### `create_app_role`

Create a new role with permissions and session duration.

**Parameters:**
- `projectId` (string, required): Project ID
- `role_name` (string, required): Role display name (e.g., "Manager")
- `role_key` (string, required): Role key (lowercase, alphanumeric + underscore, e.g., "manager")
- `description` (string, optional): Role description
- `permissions` (array of strings, optional): Permission array (e.g., ["read", "write"])
- `session_duration_minutes` (number, optional): Session duration in minutes (default: 10080 = 7 days)

**Example:**
```json
{
  "projectId": "1",
  "role_name": "Manager",
  "role_key": "manager",
  "description": "Department manager with elevated privileges",
  "permissions": ["read", "write", "manage_team"],
  "session_duration_minutes": 480
}
```

**Response:**
```json
{
  "success": true,
  "role": {
    "id": 3,
    "role_name": "Manager",
    "role_key": "manager",
    "description": "Department manager with elevated privileges",
    "permissions": ["read", "write", "manage_team"],
    "session_duration_minutes": 480,
    "is_system_role": false,
    "created_at": "2025-11-12T13:00:00Z"
  }
}
```

---

### `update_app_role`

Update an existing role (system roles have restrictions).

**Parameters:**
- `projectId` (string, required): Project ID
- `roleId` (string, required): Role ID
- `role_name` (string, optional): Updated role name
- `description` (string, optional): Updated description
- `permissions` (array of strings, optional): Updated permissions
- `session_duration_minutes` (number, optional): Updated session duration

**Example:**
```json
{
  "projectId": "1",
  "roleId": "3",
  "description": "Senior manager with full team management",
  "session_duration_minutes": 720
}
```

**Response:**
```json
{
  "success": true,
  "role": {
    "id": 3,
    "role_name": "Manager",
    "description": "Senior manager with full team management",
    "session_duration_minutes": 720,
    "updated_at": "2025-11-12T14:00:00Z"
  }
}
```

---

### `delete_app_role`

Delete a custom role (system roles cannot be deleted).

**Parameters:**
- `projectId` (string, required): Project ID
- `roleId` (string, required): Role ID

**Example:**
```json
{
  "projectId": "1",
  "roleId": "3"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

**Error Response (System Role):**
```json
{
  "success": false,
  "error": "Cannot delete system roles"
}
```

---

## Custom Fields Tools

### `list_custom_fields`

List custom user fields for a project.

**Parameters:**
- `projectId` (string, required): Project ID
- `include_inactive` (boolean, optional): Include inactive fields (default: false)

**Example:**
```json
{
  "projectId": "1",
  "include_inactive": false
}
```

**Response:**
```json
{
  "success": true,
  "fields": [
    {
      "id": 1,
      "field_name": "department",
      "field_label": "Department",
      "field_type": "text",
      "is_required": false,
      "is_active": true,
      "display_order": 1,
      "created_at": "2025-11-12T09:00:00Z"
    },
    {
      "id": 2,
      "field_name": "employee_id",
      "field_label": "Employee ID",
      "field_type": "number",
      "is_required": true,
      "is_active": true,
      "display_order": 2,
      "created_at": "2025-11-12T09:05:00Z"
    }
  ]
}
```

---

### `create_custom_field`

Create a custom user field.

**Parameters:**
- `projectId` (string, required): Project ID
- `field_name` (string, required): Field name (lowercase, alphanumeric + underscore)
- `field_label` (string, required): Field display label
- `field_type` (string, required): Field type - one of: `text`, `number`, `boolean`, `date`, `select`, `multi_select`, `reference`
- `is_required` (boolean, optional): Is field required (default: false)
- `options` (array of strings, optional): Options for select/multi_select fields
- `reference_table` (string, optional): Table name for reference fields
- `reference_column` (string, optional): Column name for reference fields

**Example (Text Field):**
```json
{
  "projectId": "1",
  "field_name": "job_title",
  "field_label": "Job Title",
  "field_type": "text",
  "is_required": false
}
```

**Example (Select Field):**
```json
{
  "projectId": "1",
  "field_name": "employment_type",
  "field_label": "Employment Type",
  "field_type": "select",
  "is_required": true,
  "options": ["Full-time", "Part-time", "Contract", "Intern"]
}
```

**Example (Reference Field):**
```json
{
  "projectId": "1",
  "field_name": "department_id",
  "field_label": "Department",
  "field_type": "reference",
  "is_required": false,
  "reference_table": "departments",
  "reference_column": "name"
}
```

**Response:**
```json
{
  "success": true,
  "field": {
    "id": 5,
    "field_name": "job_title",
    "field_label": "Job Title",
    "field_type": "text",
    "is_required": false,
    "is_active": true,
    "created_at": "2025-11-12T15:00:00Z"
  }
}
```

---

### `apply_custom_field`

Apply a custom field (add column to app_users table). This is a destructive operation that alters the database schema.

**Parameters:**
- `projectId` (string, required): Project ID
- `fieldId` (string, required): Field ID

**Example:**
```json
{
  "projectId": "1",
  "fieldId": "5"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Column 'job_title' added to app_users table"
}
```

---

## Auth Settings Tools

### `get_auth_settings`

Get authentication settings for a project.

**Parameters:**
- `projectId` (string, required): Project ID

**Example:**
```json
{
  "projectId": "1"
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "id": 1,
    "project_id": 1,
    "allow_duplicate_emails": false,
    "require_email_verification": true,
    "enable_password_reset": true,
    "enable_mfa": false,
    "registration_enabled": true,
    "auth_enabled": true,
    "default_role_id": 2,
    "email_provider_id": 1,
    "created_at": "2025-11-12T08:00:00Z",
    "updated_at": "2025-11-12T08:00:00Z"
  }
}
```

---

### `update_auth_settings`

Update authentication settings for a project.

**Parameters:**
- `projectId` (string, required): Project ID
- `allow_duplicate_emails` (boolean, optional): Allow users with same email (multi-tenant)
- `require_email_verification` (boolean, optional): Require email verification
- `enable_password_reset` (boolean, optional): Enable password reset feature
- `registration_enabled` (boolean, optional): Enable user registration
- `auth_enabled` (boolean, optional): Enable/disable entire auth system
- `default_role_id` (number, optional): Default role ID for new users
- `email_provider_id` (number, optional): Email provider ID for auth emails

**Example:**
```json
{
  "projectId": "1",
  "require_email_verification": false,
  "registration_enabled": true,
  "default_role_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "id": 1,
    "project_id": 1,
    "require_email_verification": false,
    "registration_enabled": true,
    "default_role_id": 2,
    "updated_at": "2025-11-12T16:00:00Z"
  }
}
```

---

## Error Responses

All tools follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "tool": "tool_name"
}
```

**Common Error Types:**
- `Project not found`: Invalid project ID
- `User not found`: Invalid user ID
- `Role not found`: Invalid role ID
- `Field not found`: Invalid field ID
- `Cannot delete system roles`: Attempted to delete a system role (Admin, User)
- `No fields to update`: Update called with no parameters

---

## Notes

1. **SuperTokens Integration**: MCP tools create users directly in the database without full SuperTokens integration. For production use with password hashing and verification emails, use the HTTP API endpoints (`/api/app-auth/:projectId/users`).

2. **Project Schema**: All user, role, and custom field data is stored in project-specific schemas (e.g., `project_1`, `project_2`).

3. **System Roles**: The default "Admin" and "User" roles are system roles and cannot be deleted or have their `role_key` changed.

4. **Custom Fields**: After creating a custom field, you must call `apply_custom_field` to add the actual column to the `app_users` table.

5. **Permissions**: The MCP tools do not enforce project access control. Ensure proper access control is implemented at the application level when exposing these tools.

---

## Quick Examples

### Create a user and assign a role

```typescript
// 1. Create user
const createResult = await mcpClient.callTool('create_app_user', {
  projectId: '1',
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePassword123!',
  phone: '+1234567890'
});

const userId = createResult.user.id;

// 2. Assign role
await mcpClient.callTool('assign_user_role', {
  projectId: '1',
  userId: userId.toString(),
  roleId: 1 // Admin role
});
```

### Create a custom field and apply it

```typescript
// 1. Create custom field
const fieldResult = await mcpClient.callTool('create_custom_field', {
  projectId: '1',
  field_name: 'department',
  field_label: 'Department',
  field_type: 'select',
  is_required: false,
  options: ['Engineering', 'Sales', 'Marketing', 'HR']
});

const fieldId = fieldResult.field.id;

// 2. Apply field (alter table)
await mcpClient.callTool('apply_custom_field', {
  projectId: '1',
  fieldId: fieldId.toString()
});
```

### List users with filters

```typescript
// List active users in the "Admin" role
const users = await mcpClient.callTool('list_app_users', {
  projectId: '1',
  role_id: '1',
  is_active: true,
  page: 1,
  limit: 50
});

console.log(`Found ${users.count} users:`, users.users);
```

