# MCP Auth Tools Quick Start

This guide will help you get started using the MCP auth tools for application user management in the Skaftin platform.

## Prerequisites

- Skaftin MCP server configured and running
- A project ID (you can get this from `list_projects` tool)
- MCP client installed in your IDE (Cursor, Windsurf, etc.)

## Client Endpoint Project Context

For client MCP endpoint calls (`/app-api/mcp/*`), project context is derived from your API key/Bearer token.

- `projectId` is optional in tool arguments
- If provided, it must match the token-bound project
- Mismatches are rejected for safety

## Basic Workflow

### 1. Check Auth Settings

First, check the current authentication settings for your project:

```typescript
const settings = await mcpClient.callTool('get_auth_settings', {
  // projectId optional on /app-api/mcp/*
});
```

### 2. List Available Roles

See what roles are available in your project:

```typescript
const roles = await mcpClient.callTool('list_app_roles', {
  include_user_count: true
});

// Output will show default roles: Admin (role_key: 'admin') and User (role_key: 'user')
```

### 3. Create Your First User

Create a new application user:

```typescript
const newUser = await mcpClient.callTool('create_app_user', {
  name: 'Jane Smith',
  email: 'jane@example.com',
  password: 'SecurePassword123!',
  phone: '+1234567890',
  metadata: {
    department: 'Engineering'
  }
});

const userId = newUser.user.id;
```

### 4. Assign a Role

Assign the "User" role (or "Admin" role):

```typescript
// Get the User role ID first (usually 2)
const userRole = roles.roles.find(r => r.role_key === 'user');

await mcpClient.callTool('assign_user_role', {
  projectId: '1',
  userId: userId.toString(),
  roleId: userRole.id
});
```

### 5. List Users

List all users to verify:

```typescript
const users = await mcpClient.callTool('list_app_users', {
  projectId: '1',
  page: 1,
  limit: 50
});

console.log(`Total users: ${users.count}`);
```

## Common Use Cases

### Use Case 1: Bulk User Creation

Create multiple users from an array:

```typescript
const userData = [
  { name: 'John Doe', email: 'john@example.com', department: 'Sales' },
  { name: 'Alice Brown', email: 'alice@example.com', department: 'Marketing' },
  { name: 'Bob Wilson', email: 'bob@example.com', department: 'Engineering' }
];

for (const user of userData) {
  const result = await mcpClient.callTool('create_app_user', {
    projectId: '1',
    name: user.name,
    email: user.email,
    password: 'TempPassword123!', // Should prompt user to change on first login
    metadata: {
      department: user.department
    }
  });
  
  // Assign default "User" role
  await mcpClient.callTool('assign_user_role', {
    projectId: '1',
    userId: result.user.id.toString(),
    roleId: 2 // User role
  });
}
```

### Use Case 2: Creating Custom Roles

Create a custom role for managers:

```typescript
const managerRole = await mcpClient.callTool('create_app_role', {
  projectId: '1',
  role_name: 'Manager',
  role_key: 'manager',
  description: 'Team manager with elevated privileges',
  permissions: ['read', 'write', 'manage_team', 'approve_requests'],
  session_duration_minutes: 480 // 8 hours
});

console.log('Created role:', managerRole.role);
```

### Use Case 3: Adding Custom User Fields

Add a custom "employee_id" field:

```typescript
// 1. Create the custom field definition
const field = await mcpClient.callTool('create_custom_field', {
  projectId: '1',
  field_name: 'employee_id',
  field_label: 'Employee ID',
  field_type: 'number',
  is_required: true
});

// 2. Apply the field to alter the database
await mcpClient.callTool('apply_custom_field', {
  projectId: '1',
  fieldId: field.field.id.toString()
});

console.log('Custom field applied! Users can now have employee_id.');
```

### Use Case 4: Department Field with Select Options

Create a department field with predefined options:

```typescript
// 1. Create select field
const deptField = await mcpClient.callTool('create_custom_field', {
  projectId: '1',
  field_name: 'department',
  field_label: 'Department',
  field_type: 'select',
  is_required: true,
  options: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']
});

// 2. Apply it
await mcpClient.callTool('apply_custom_field', {
  projectId: '1',
  fieldId: deptField.field.id.toString()
});
```

### Use Case 5: Reference Field to Another Table

Create a field that references a `teams` table:

```typescript
const teamField = await mcpClient.callTool('create_custom_field', {
  projectId: '1',
  field_name: 'team_id',
  field_label: 'Team',
  field_type: 'reference',
  is_required: false,
  reference_table: 'teams',
  reference_column: 'name'
});

await mcpClient.callTool('apply_custom_field', {
  projectId: '1',
  fieldId: teamField.field.id.toString()
});
```

### Use Case 6: Search and Filter Users

Search for users by email or name:

```typescript
const searchResults = await mcpClient.callTool('list_app_users', {
  projectId: '1',
  search: 'john',
  is_active: true
});

console.log('Found users:', searchResults.users);
```

Filter users by role:

```typescript
const adminUsers = await mcpClient.callTool('list_app_users', {
  projectId: '1',
  role_id: '1', // Admin role
  page: 1,
  limit: 50
});

console.log('Admin users:', adminUsers.users);
```

### Use Case 7: Updating Auth Settings

Enable email verification and disable duplicate emails:

```typescript
await mcpClient.callTool('update_auth_settings', {
  projectId: '1',
  require_email_verification: true,
  allow_duplicate_emails: false,
  registration_enabled: true
});
```

Set default role for new registrations:

```typescript
// Get the "User" role ID
const userRole = await mcpClient.callTool('get_app_role', {
  projectId: '1',
  roleId: '2'
});

await mcpClient.callTool('update_auth_settings', {
  projectId: '1',
  default_role_id: userRole.role.id
});
```

### Use Case 8: User Management Operations

Update a user's information:

```typescript
await mcpClient.callTool('update_app_user', {
  projectId: '1',
  userId: '5',
  name: 'Jane Smith-Doe',
  phone: '+0987654321',
  metadata: {
    department: 'Engineering',
    team: 'Backend'
  }
});
```

Deactivate a user (soft delete):

```typescript
await mcpClient.callTool('delete_app_user', {
  projectId: '1',
  userId: '5',
  permanent: false
});
```

Permanently delete a user:

```typescript
await mcpClient.callTool('delete_app_user', {
  projectId: '1',
  userId: '5',
  permanent: true
});
```

## Advanced Patterns

### Pattern 1: Role-Based User Creation

Automatically assign roles based on email domain:

```typescript
async function createUserWithAutoRole(projectId: string, name: string, email: string) {
  // Create user
  const user = await mcpClient.callTool('create_app_user', {
    projectId,
    name,
    email,
    password: generateSecurePassword()
  });

  // Auto-assign role based on email domain
  let roleId = 2; // Default to User
  
  if (email.endsWith('@admin.company.com')) {
    roleId = 1; // Admin
  } else if (email.endsWith('@manager.company.com')) {
    // Get or create Manager role
    const roles = await mcpClient.callTool('list_app_roles', { projectId });
    const managerRole = roles.roles.find(r => r.role_key === 'manager');
    roleId = managerRole?.id || 2;
  }

  await mcpClient.callTool('assign_user_role', {
    projectId,
    userId: user.user.id.toString(),
    roleId
  });

  return user.user;
}
```

### Pattern 2: Audit Trail with Metadata

Track user creation source and audit information:

```typescript
const newUser = await mcpClient.callTool('create_app_user', {
  projectId: '1',
  name: 'Audit User',
  email: 'audit@example.com',
  password: 'SecurePassword123!',
  metadata: {
    created_by: 'admin_user_id',
    created_via: 'mcp_tool',
    creation_timestamp: new Date().toISOString(),
    source: 'bulk_import',
    notes: 'Created during Q4 onboarding'
  }
});
```

### Pattern 3: Session Duration by User Importance

Configure different session lengths based on role sensitivity:

```typescript
const roleConfigs = [
  { role_key: 'admin', session_minutes: 60 },       // 1 hour
  { role_key: 'manager', session_minutes: 480 },    // 8 hours
  { role_key: 'user', session_minutes: 10080 }      // 7 days
];

for (const config of roleConfigs) {
  const roles = await mcpClient.callTool('list_app_roles', { projectId: '1' });
  const role = roles.roles.find(r => r.role_key === config.role_key);
  
  if (role) {
    await mcpClient.callTool('update_app_role', {
      projectId: '1',
      roleId: role.id.toString(),
      session_duration_minutes: config.session_minutes
    });
  }
}
```

## Best Practices

### 1. Always Assign Roles
Every user should have at least one role. Default to the "User" role if unsure.

### 2. Use Metadata for Extensibility
Instead of creating many custom fields, consider using the `metadata` JSONB column for flexible data storage.

### 3. Apply Custom Fields Carefully
The `apply_custom_field` operation alters the database schema. Test in a development environment first.

### 4. Handle Errors Gracefully
Always check for success/failure in responses:

```typescript
const result = await mcpClient.callTool('create_app_user', { ... });

if (!result.success) {
  console.error('Failed to create user:', result.error);
  // Handle error
}
```

### 5. Use Pagination for Large User Lists
When listing users, always use pagination to avoid overwhelming responses:

```typescript
const users = await mcpClient.callTool('list_app_users', {
  projectId: '1',
  page: 1,
  limit: 50 // Reasonable page size
});
```

### 6. Secure Password Generation
For production use, generate secure passwords and require users to change them on first login.

### 7. MCP vs HTTP API
- Use **MCP tools** for development, testing, and automation scripts
- Use **HTTP API** (`/api/app-auth/:projectId/users`) for production applications with full SuperTokens integration (password hashing, email verification, etc.)

## Troubleshooting

### Issue: "Project not found"
Make sure the project ID is valid. List all projects:

```typescript
const projects = await mcpClient.callTool('list_projects', {});
```

### Issue: "Cannot delete system roles"
The default "Admin" and "User" roles cannot be deleted. Only custom roles can be removed.

### Issue: "Field not found"
Ensure the field ID is correct when applying custom fields:

```typescript
const fields = await mcpClient.callTool('list_custom_fields', {
  projectId: '1',
  include_inactive: true
});
```

### Issue: Password not working in login
MCP tools create users without full SuperTokens password hashing. For production password management, use the HTTP API.

## Next Steps

- Explore [Full Auth Tools Documentation](./AUTH_TOOLS.md)
- Review [HTTP API Documentation](../AUTH_SYSTEM_IMPLEMENTATION.md)
- Check out [Client SDK Integration](../client-sdk/07-APP-USER-AUTHENTICATION.md)

## Support

For issues or questions:
- Check the [MCP Features Documentation](../MCP_FEATURES.md)
- Review [Auth System Implementation](../AUTH_SYSTEM_IMPLEMENTATION.md)
- Consult [Cursor MCP Integration Guide](../CURSOR_MCP_INTEGRATION.md)

