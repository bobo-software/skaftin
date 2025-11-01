# Enhanced JWT Security Implementation

## Overview
Implemented enhanced JWT token security with project-based access control and comprehensive middleware protection.

## Key Security Enhancements

### 1. **Enhanced JWT Token Structure**

#### Access Token Payload:
```typescript
{
  userId: number,
  email: string,
  role: string,           // User role (e.g., 'user', 'admin')
  projectIds: number[],   // Array of project IDs user has access to
  type: 'access',         // Token type identifier
  iat: number,           // Issued at timestamp
  exp: number            // Expiration timestamp
}
```

#### Refresh Token Payload:
```typescript
{
  userId: number,
  email: string,
  type: 'refresh',       // Token type identifier
  iat: number,
  exp: number
}
```

### 2. **Middleware Protection**

Created `/src/middleware/authMiddleware.ts` with three middleware functions:

#### `authenticateToken`
- Verifies JWT token from `Authorization: Bearer <token>` header
- Extracts user information and attaches to `req.user`
- Handles token expiration and validation errors
- Returns 401 for missing tokens, 403 for invalid/expired tokens

#### `verifyProjectAccess`
- Verifies user has access to the requested project
- Checks `projectIds` array in JWT token
- Supports `projectId`, `id`, or `body.projectId` parameters
- Admin users bypass project access checks
- Returns 403 if user doesn't have access to the project

#### `requireAdmin`
- Verifies user has admin role
- Used for sensitive operations (user management, etc.)
- Returns 403 for non-admin users

#### `optionalAuth` *(Bonus)*
- Attaches user info if token is present but doesn't fail if not
- Useful for public endpoints that have enhanced features for authenticated users

### 3. **Token Lifecycle**

```
Login/Register
    ↓
Generate Access Token (24h expiry)
Generate Refresh Token (7d expiry)
    ↓
Client stores both tokens
    ↓
Use Access Token for API calls
    ↓
Access Token expires → Use Refresh Token
    ↓
POST /api/auth/refresh → Get new Access Token
    ↓
Refresh Token expires → Re-login required
```

### 4. **Route Protection**

#### Auth Router (`/api/auth`)
```typescript
✓ Public:  POST /register
✓ Public:  POST /login
✓ Public:  POST /refresh
✓ Protected: POST /verify (authenticateToken)
✓ Protected: POST /logout (authenticateToken)
```

#### Projects Router (`/api/projects`)
```typescript
✓ Protected: GET /list (authenticateToken)
✓ Protected: POST /create (authenticateToken)
✓ Protected + Project Access: GET /:id (authenticateToken + verifyProjectAccess)
✓ Protected + Project Access: PUT /update/:id (authenticateToken + verifyProjectAccess)
✓ Protected + Project Access: DELETE /delete/:id (authenticateToken + verifyProjectAccess)
✓ Protected + Project Access: GET /:id/stats (authenticateToken + verifyProjectAccess)
```

#### Database Router (`/api/database`)
```typescript
All routes require: authenticateToken + verifyProjectAccess

✓ GET /:projectId/tables
✓ GET /:projectId/tables/:tableName/schema
✓ POST /:projectId/tables/create
✓ POST /:projectId/tables/:tableName/select
✓ POST /:projectId/tables/:tableName/insert
✓ POST /:projectId/tables/:tableName/bulk-insert
✓ POST /:projectId/query
✓ PUT /:projectId/tables/:tableName/update
✓ DELETE /:projectId/tables/:tableName/delete
✓ DELETE /:projectId/tables/:tableName
```

#### Files Router (`/api/files`)
```typescript
All routes require: authenticateToken

✓ GET /list
✓ GET /:fileName
✓ POST /upload
✓ DELETE /:fileName
```

#### Users Router (`/api/users`)
```typescript
All routes require: authenticateToken + requireAdmin

✓ GET /list
✓ POST /create
```

### 5. **Project Access Control Flow**

```
1. User logs in → Receives JWT with projectIds
2. User creates project → New projectIds refreshed (use refresh token)
3. User requests project resource → Middleware checks:
   - Token valid?
   - ProjectId in user's projectIds array?
   - Admin role? (bypass check)
4. Access granted/denied
```

### 6. **Frontend Changes Needed**

#### Store Both Tokens:
```typescript
localStorage.setItem('skaftin-token', accessToken);
localStorage.setItem('skaftin-refresh-token', refreshToken);
```

#### Token Refresh Logic:
```typescript
// When API returns 403 (token expired)
try {
  // Try to refresh token
  const refreshToken = localStorage.getItem('skaftin-refresh-token');
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  
  if (response.ok) {
    const { accessToken } = await response.json();
    localStorage.setItem('skaftin-token', accessToken);
    // Retry original request
  } else {
    // Refresh token expired, redirect to login
    navigate('/login');
  }
} catch (error) {
  navigate('/login');
}
```

### 7. **Backend API Response Updates**

#### Login/Register Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "name": "User Name"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "token": "eyJhbGc..."  // For backward compatibility
  }
}
```

#### Verify Response:
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "name": "User Name",
      "projectIds": [1, 2, 3],
      "role": "user"
    }
  }
}
```

### 8. **Security Best Practices Implemented**

✓ **Token Separation**: Access tokens (short-lived) vs Refresh tokens (long-lived)
✓ **Type Checking**: Tokens have `type` field to prevent misuse
✓ **Role-Based Access Control**: Admin users have elevated permissions
✓ **Project-Level Authorization**: Users can only access their own projects
✓ **Automatic Token Refresh**: New projects automatically included after refresh
✓ **Secure Error Messages**: No sensitive information in error responses
✓ **Token Expiration Handling**: Clear distinction between expired and invalid tokens

### 9. **Environment Variables**

Add to `.env`:
```env
JWT_SECRET=your-super-secret-key-min-32-characters
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
```

### 10. **Testing Scenarios**

- [ ] User can only access their own projects
- [ ] User cannot access another user's project
- [ ] Admin can access all projects
- [ ] Token expires and refresh works
- [ ] Refresh token expires and login is required
- [ ] Invalid token returns 403
- [ ] Missing token returns 401
- [ ] Creating new project updates projectIds on refresh
- [ ] Deleting project updates projectIds on refresh

## Migration Notes

**Frontend**:
1. Update `AuthService` to handle `accessToken` and `refreshToken`
2. Implement token refresh interceptor
3. Update `localStorage` to store both tokens

**Backend**:
✓ All controllers now use middleware instead of `CommonUtils.handleAuthHeader`
✓ All protected routes have appropriate middleware
✓ JWT tokens now include project access information

## Security Improvements Achieved

1. **Principle of Least Privilege**: Users only have access to their own resources
2. **Defense in Depth**: Multiple layers of security (authentication + authorization)
3. **Token Security**: Separate access/refresh tokens reduce exposure risk
4. **Role-Based Security**: Admin users have elevated access when needed
5. **Automatic Authorization**: Project access verified on every request

