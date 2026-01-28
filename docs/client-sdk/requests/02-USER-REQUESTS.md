# User Management Requests

All user management endpoints require authentication and are available at `/app-api/auth`.

## Base URL
```
/app-api/auth
```

## Authentication
All endpoints require either:
- `x-api-key` header with a valid API key
- `Authorization: Bearer <jwt-token>` header

---

## User CRUD Operations

### 1. List Users

Get all users for the project.

**Endpoint:** `GET /app-api/auth/users`

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
| is_active | boolean | Filter by active status |

**Example:**
```
GET /app-api/auth/users?page=1&limit=20&search=john&is_active=true
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

**Endpoint:** `GET /app-api/auth/users/:userId`

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

**Endpoint:** `GET /app-api/auth/users/by-role/:roleId`

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

**Endpoint:** `POST /app-api/auth/users`

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
  "password": "TempPass123!",
  "phone": "+27829876543",
  "role_id": 2,
  "custom_field_1": "EMP002",
  "metadata": {
    "department": "Marketing"
  },
  "is_active": true,
  "send_welcome_email": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's first name |
| last_name | string | No | User's last name |
| email | string | Yes | User's email address |
| password | string | Yes | User's password |
| phone | string | No | Phone number |
| role_id | number | No | Role ID to assign |
| custom_field_1 | string | No | Custom field 1 value |
| custom_field_2 | string | No | Custom field 2 value |
| metadata | object | No | Additional metadata |
| is_active | boolean | No | Active status (default: true) |
| send_welcome_email | boolean | No | Send welcome email |

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

**Endpoint:** `PUT /app-api/auth/users/:userId`

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

**Endpoint:** `DELETE /app-api/auth/users/:userId`

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
DELETE /app-api/auth/users/5          # Soft delete (deactivate)
DELETE /app-api/auth/users/5?permanent=true  # Permanent delete
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

**Endpoint:** `POST /app-api/auth/users/:userId/roles`

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

**Endpoint:** `DELETE /app-api/auth/users/:userId/roles/:roleId`

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

**Endpoint:** `GET /app-api/auth/users/:userId/otp-status`

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

**Endpoint:** `POST /app-api/auth/users/:userId/resend-otp`

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

**Endpoint:** `POST /app-api/auth/users/:userId/manual-verify`

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

Retrieve a user's password (admin feature).

**Endpoint:** `GET /app-api/auth/users/:userId/password`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "password": "hashed-or-plaintext-password"
  }
}
```

---

### 13. Set User Password (Admin Only)

Set or reset a user's password.

**Endpoint:** `POST /app-api/auth/users/:userId/password`

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
  "message": "Password updated successfully"
}
```

---

## Import/Export

### 14. Export Users

Export users as SQL dump.

**Endpoint:** `POST /app-api/auth/users/export`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "format": "sql",
  "include_roles": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sql": "INSERT INTO users ..."
  }
}
```

---

### 15. Import Users

Import users from SQL dump.

**Endpoint:** `POST /app-api/auth/users/import`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "sql": "INSERT INTO users (name, email, ...) VALUES ..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Users imported successfully",
  "data": {
    "imported": 10,
    "failed": 0
  }
}
```

---

## Role CRUD Operations

### 16. List Roles

Get all roles for the project.

**Endpoint:** `GET /app-api/auth/roles`

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

**Endpoint:** `POST /app-api/auth/roles`

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

**Endpoint:** `PUT /app-api/auth/roles/:roleId`

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

**Endpoint:** `DELETE /app-api/auth/roles/:roleId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

### 20. Update Role Permissions

Update permissions for a role.

**Endpoint:** `PUT /app-api/auth/roles/:roleId/permissions`

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

**Endpoint:** `PUT /app-api/auth/roles/:roleId/session-duration`

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
