# Role-Based Access Control (RBAC)

This document explains how to use role-based access control for both backend routes and frontend routes.

## Backend Route Protection

### Adding Role Requirements to Routes

When defining routes in route definition files, you can add `requiredRoles` to restrict access:

```typescript
{
  method: 'post',
  path: '/users',
  handler: AuthUsersController.createUser,
  description: 'Create a new user',
  requiresProject: true,
  requiresAuth: true,
  requiredRoles: ['admin', 'manager'], // User must have at least one of these roles
}
```

`requiredRoles` can be:
- An array of role keys (strings): `['admin', 'manager']`
- An array of role IDs (numbers): `[1, 2]`
- A mix of both: `['admin', 2]`

The middleware checks if the authenticated app user has **at least one** of the required roles.

### Example: Protecting User Management Routes

```typescript
// src/routers/definitions/authRoutes.ts
export function createAuthRouteDefinitions(isAdmin: boolean): RouteDefinition[] {
  return [
    // Only admins can delete users
    {
      method: 'delete',
      path: createPath('/users/:userId', isAdmin),
      handler: AuthUsersController.deleteUser,
      description: 'Delete a user',
      requiresProject: true,
      requiresAuth: true,
      requiredRoles: ['admin'], // Only admin role can delete users
    },
    
    // Admins and managers can create users
    {
      method: 'post',
      path: createPath('/users', isAdmin),
      handler: AuthUsersController.createUser,
      description: 'Create a new user',
      requiresProject: true,
      requiresAuth: true,
      requiredRoles: ['admin', 'manager'],
    },
    
    // All authenticated users can view their own profile
    {
      method: 'get',
      path: createPath('/users/me', isAdmin),
      handler: AuthUsersController.getCurrentUser,
      description: 'Get current user profile',
      requiresProject: true,
      requiresAuth: true,
      // No requiredRoles - any authenticated user can access
    },
  ];
}
```

### How It Works

1. User authenticates via SuperTokens (Bearer token)
2. `attachAppUserInfo` middleware extracts user roles from database
3. Roles are attached to `req.appUser.roles` as an array of `{id, role_name, role_key}` objects
4. `requireRoles` middleware checks if user has at least one required role
5. If user lacks required roles, a 403 Forbidden response is returned

## Frontend Route Protection

### Using ProtectedRoute with Roles

The `ProtectedRoute` component supports role-based protection:

```typescript
import { ProtectedRoute } from '../components/ProtectedRoute';

// Protect a route - requires authentication only
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  } 
/>

// Protect a route - requires specific role(s)
<Route 
  path="/admin/users" 
  element={
    <ProtectedRoute requiredRoles={['admin']}>
      <UsersManagementPage />
    </ProtectedRoute>
  } 
/>

// Protect a route - requires one of multiple roles
<Route 
  path="/management/reports" 
  element={
    <ProtectedRoute requiredRoles={['admin', 'manager']}>
      <ReportsPage />
    </ProtectedRoute>
  } 
/>
```

### Example: Protecting Admin Routes

```typescript
// frontend/src/App.tsx
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes - authentication required */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Protected routes - admin role required */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          } 
        />
        
        {/* Protected routes - manager or admin role required */}
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute requiredRoles={['admin', 'manager']}>
              <ReportsPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
```

### User Roles in Frontend Store

User roles are automatically fetched and stored when the user session is checked. The `User` interface includes:

```typescript
interface UserRole {
  id: number;
  role_name: string;
  role_key: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  roles?: UserRole[]; // Available for role-based checks
}
```

## Best Practices

1. **Use role keys (strings) instead of IDs** - They're more readable and maintainable
2. **Check roles on both backend and frontend** - Frontend checks improve UX, backend checks are mandatory for security
3. **Use the least privilege principle** - Only require the minimum roles necessary
4. **Document role requirements** - Add comments explaining why certain roles are required

## Troubleshooting

### Backend: "Insufficient permissions" error

- Verify user has the required roles assigned in the database
- Check that `req.appUser.roles` contains the expected roles
- Ensure authentication middleware runs before role middleware

### Frontend: "Access Denied" message

- Verify user roles are loaded in the store (`user.roles`)
- Check role keys match exactly (case-sensitive)
- Ensure roles are fetched during session initialization

## Notes

- Role checking only applies to authenticated app users (SuperTokens sessions)
- API key authentication bypasses role checks (API keys have their own permission system)
- Admin routes (platform admin) don't use app user roles - they use platform admin authentication
