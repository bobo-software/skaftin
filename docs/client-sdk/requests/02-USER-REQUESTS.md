# User Management Requests

All user management endpoints require authentication and are available at `/api/auth/{projectId}`.

## Base URL
```
/api/auth/{projectId}
```

## Authentication
All endpoints require either:
- `x-api-key` header with a valid API key
- `Authorization: Bearer <jwt-token>` header

---

## User CRUD Operations

### 1. List Users

Get all users for the project.

**Endpoint:** `GET /api/auth/{projectId}/users`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 50) |
| search | string | Search by name or email |
| role_id | number | Filter by role ID |
| role_key | string | Filter by role key |
| is_active | boolean | Filter by active status |

**Example:**
```
GET /api/auth/3/users?page=1&limit=20&search=john&is_active=true
```

**Response:**
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "users": [
      {
        "id": 1,
        "name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+27821234567",
        "is_active": true,
        "email_verified": true,
        "created_at": "2024-01-15T10:30:00.000Z",
        "roles": [
          {
            "id": 2,
            "role_name": "User",
            "role_key": "user"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 2. Get Single User

Get a specific user by ID.

**Endpoint:** `GET /api/auth/{projectId}/users/:userId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": 1,
    "name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+27821234567",
    "custom_field_1": "EMP001",
    "custom_field_2": null,
    "metadata": {
      "department": "Sales"
    },
    "is_active": true,
    "email_verified": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "roles": [...]
  }
}
```

---

### 3. Get Users by Role

Get all users with a specific role.

**Endpoint:** `GET /api/auth/{projectId}/roles/:roleId/users`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      ...
    }
  ]
}
```

---

### 4. Create User

Create a new user (admin creation, bypasses registration flow).

**Endpoint:** `POST /api/auth/{projectId}/users`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+27829876543",
  "custom_field_1": "EMP002",
  "metadata": {
    "department": "Marketing"
  },
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's first name |
| last_name | string | No | User's last name |
| email | string | No | User's email address |
| phone | string | No | Phone number |
| custom_field_1 | string | No | Custom field 1 value |
| custom_field_2 | string | No | Custom field 2 value |
| metadata | object | No | Additional metadata |
| is_active | boolean | No | Active status (default: true) |

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 2,
    "name": "Jane",
    "email": "jane.smith@example.com",
    ...
  }
}
```

---

### 5. Update User

Update an existing user.

**Endpoint:** `PUT /api/auth/{projectId}/users/:userId`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Jane",
  "last_name": "Doe",
  "phone": "+27829876543",
  "custom_field_1": "EMP003",
  "metadata": {
    "department": "Engineering"
  },
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 2,
    "name": "Jane",
    ...
  }
}
```

---

### 6. Delete User

Delete a user (soft delete by default).

**Endpoint:** `DELETE /api/auth/{projectId}/users/:userId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| permanent | boolean | If true, permanently delete user |

**Examples:**
```
DELETE /api/auth/3/users/5          # Soft delete (deactivate)
DELETE /api/auth/3/users/5?permanent=true  # Permanent delete
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## Role Management

### 7. Assign Role to User

Assign a role to a user.

**Endpoint:** `POST /api/auth/{projectId}/users/:userId/roles`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "role_id": 3
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

### 8. Remove Role from User

Remove a role from a user.

**Endpoint:** `DELETE /api/auth/{projectId}/users/:userId/roles/:roleId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Role removed successfully"
}
```

---

## OTP Management

### 9. Get User OTP Status

Check user's OTP verification status.

**Endpoint:** `GET /api/auth/{projectId}/users/:userId/otp-status`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "has_pending_otp": true,
    "otp_created_at": "2024-01-15T10:30:00.000Z",
    "otp_expires_at": "2024-01-15T10:40:00.000Z",
    "email_verified": false
  }
}
```

---

### 10. Resend OTP

Resend OTP to a user.

**Endpoint:** `POST /api/auth/{projectId}/users/:userId/resend-otp`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "method": "email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP resent successfully"
}
```

---

### 11. Manually Verify User

Verify a user without OTP (admin action).

**Endpoint:** `POST /api/auth/{projectId}/users/:userId/manual-verify`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "User verified successfully"
}
```

---

## Password Management

### 12. Get User Password (Admin Only)

Get whether a user currently has a password set.

**Endpoint:** `GET /api/auth/{projectId}/users/:userId/password`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "has_password": true
  }
}
```

---

### 13. Set User Password (Admin Only)

Set or reset a user's password.

**Endpoint:** `POST /api/auth/{projectId}/users/:userId/password`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "password": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password updated"
}
```

---

### 13a. Verify User Password (Admin Only)

Verify a candidate password against the stored password hash.

**Endpoint:** `POST /api/auth/{projectId}/users/:userId/password/verify`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "password": "PasswordToVerify123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password verification completed",
  "data": {
    "valid": true,
    "has_password": true
  }
}
```

---

## Import/Export

### 14. Export Users

Export users as SQL dump.

**Endpoint:** `POST /api/auth/{projectId}/users/export`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
Returns SQL content as a downloadable file (`Content-Type: application/sql`).

---

### 15. Import Users

Import users from SQL dump.

**Endpoint:** `POST /api/auth/{projectId}/users/import`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "sql": "INSERT INTO users (name, email, ...) VALUES ...",
  "clear_existing": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Users imported successfully",
  "data": {
    "successCount": 10,
    "errorCount": 0,
    "success_count": 10,
    "error_count": 0,
    "message": "Successfully imported 10 SQL statements"
  }
}
```

---

## Role CRUD Operations

### 16. List Roles

Get all roles for the project.

**Endpoint:** `GET /api/auth/{projectId}/roles`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "role_name": "Admin",
      "role_key": "admin",
      "description": "Administrator with full access",
      "permissions": ["*"],
      "session_duration_minutes": 60,
      "is_system_role": true
    },
    {
      "id": 2,
      "role_name": "User",
      "role_key": "user",
      "description": "Standard user",
      "permissions": ["read"],
      "session_duration_minutes": 10080,
      "is_system_role": true
    }
  ]
}
```

---

### 17. Create Role

Create a new role.

**Endpoint:** `POST /api/auth/{projectId}/roles`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "role_name": "Manager",
  "role_key": "manager",
  "description": "Team manager with elevated access",
  "permissions": ["read", "write", "manage_users"],
  "session_duration_minutes": 1440
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "id": 3,
    "role_name": "Manager",
    "role_key": "manager",
    ...
  }
}
```

---

### 18. Update Role

Update an existing role.

**Endpoint:** `PUT /api/auth/{projectId}/roles/:roleId`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "role_name": "Senior Manager",
  "permissions": ["read", "write", "manage_users", "delete"]
}
```

---

### 19. Delete Role

Delete a role (system roles cannot be deleted).

**Endpoint:** `DELETE /api/auth/{projectId}/roles/:roleId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

### 20. Update Role Permissions

Update permissions for a role.

**Endpoint:** `PUT /api/auth/{projectId}/roles/:roleId/permissions`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "permissions": ["read", "write", "delete"]
}
```

---

### 21. Update Session Duration

Update session duration for a role.

**Endpoint:** `PUT /api/auth/{projectId}/roles/:roleId/session-duration`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "session_duration_minutes": 720
}
```
