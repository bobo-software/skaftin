# MCP Authentication Integration with SuperTokens

## Overview

The MCP (Model Context Protocol) service has been fully integrated with SuperTokens authentication. All MCP tool calls now require authentication and automatically use the authenticated user's ID from the SuperTokens session.

## Changes Made

### 1. Database Schema

**File: `init-database.sql`**

- Removed the `auth.users` table and schema (no longer needed with SuperTokens)
- Removed foreign key constraint from `platform.projects.user_id`
- Changed `user_id` column type from `UUID` to `VARCHAR(255)` to support SuperTokens user IDs
- Added indexes for better query performance

```sql
-- Projects now use SuperTokens user IDs directly
CREATE TABLE IF NOT EXISTS platform.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- SuperTokens user ID
  ...
);
```

### 2. MCP Routes

**File: `src/backend/routes/mcp.routes.ts`**

- Added SuperTokens session validation to `/api/mcp/tools/execute` endpoint
- Automatically extracts user ID from the authenticated session
- Returns 401 Unauthorized if user is not authenticated
- Passes user ID to MCP service for tool execution

```typescript
// Get user ID from SuperTokens session
const session = await Session.getSession(req, res);
const userId = session.getUserId();

// Pass userId to the MCP service
const result = await mcpService.executeTool(tool, parameters, projectId, userId);
```

### 3. MCP Service

**File: `src/backend/services/mcp.service.ts`**

- Updated `executeTool()` method to accept `userId` parameter
- Project tools (`list_projects`, `create_project`) now automatically use the authenticated user's ID
- Removed `userId` parameter from tool definitions for project tools
- All tools are now scoped to the authenticated user

### 4. Tool Definitions

**Updated Tools:**

```typescript
// Before
{
  name: 'create_project',
  parameters: [
    { name: 'userId', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    ...
  ]
}

// After
{
  name: 'create_project',
  parameters: [
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string', required: false }
  ]
}
```

## Security Improvements

1. **Authentication Required**: All MCP tool calls now require a valid SuperTokens session
2. **User Isolation**: Users can only access their own projects and resources
3. **No User ID Spoofing**: User ID is always taken from the session, not from request parameters
4. **Clean Database**: Removed legacy auth tables and foreign keys

## Usage Examples

### Creating a Project

**Before:**
```javascript
// Had to provide userId
fetch('/api/mcp/tools/execute', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'create_project',
    parameters: {
      userId: 'some-user-id',
      name: 'My Project',
      description: 'Project description'
    }
  })
});
```

**After:**
```javascript
// User ID comes from session automatically
fetch('/api/mcp/tools/execute', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'create_project',
    parameters: {
      name: 'My Project',
      description: 'Project description'
    }
  })
});
```

### Listing Projects

**Before:**
```javascript
fetch('/api/mcp/tools/execute', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'list_projects',
    parameters: {
      userId: 'some-user-id'
    }
  })
});
```

**After:**
```javascript
// No parameters needed - uses authenticated user
fetch('/api/mcp/tools/execute', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'list_projects',
    parameters: {}
  })
});
```

## Frontend Changes Needed

Update frontend code to remove `userId` parameters from project-related MCP calls:

**Before:**
```typescript
await McpService.createProject(userId, name, description);
```

**After:**
```typescript
await McpService.createProject(name, description);
// userId is automatically taken from the session
```

## Testing

1. Register/login with SuperTokens
2. Try creating a project - should work automatically
3. List projects - should only show your projects
4. Try accessing another user's projects - should fail with permission error

## Migration Notes

- The old `auth.users` table has been removed
- All projects now reference SuperTokens user IDs
- No data migration needed if starting fresh (which we did)
- If migrating existing data, you'll need to map old user IDs to SuperTokens user IDs

## Files Modified

1. `init-database.sql` - Removed auth schema, updated projects table
2. `src/backend/routes/mcp.routes.ts` - Added session authentication
3. `src/backend/services/mcp.service.ts` - Added userId parameter to executeTool
4. `src/backend/db/migrations/remove_auth_users_fk.sql` - Migration script

## Benefits

1. **Improved Security**: User isolation at the database level
2. **Simpler API**: No need to pass userId in requests
3. **Single Source of Truth**: SuperTokens is the only authentication system
4. **Better Architecture**: Separation of concerns between auth and business logic
5. **Easier Testing**: Can test with different authenticated users
