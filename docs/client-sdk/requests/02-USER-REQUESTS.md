# User Management Requests

These routes manage **app users** (end users of your project). The same handlers are mounted in two places:

| Style | Base path | Auth (reference Go server) |
|-------|-----------|----------------------------|
| **App API** (recommended for SDKs) | `/app-api/auth/...` | `x-api-key` — project from key |
| **Project API** | `/api/auth/{projectId}/...` | `Authorization: Bearer` platform JWT + project access |

Examples below use **`{userId}`**, **`{roleId}`** path segments (Go `ServeMux` style). Replace with numeric IDs in real requests.

**Note:** Import and export now exist on **both** mounts. Bulk user create, bulk role assignment, bulk resend OTP, and bulk verify also exist on both mounts and return partial-success summaries.

**App API path rule:** For a **project URL** `/api/auth/{projectId}/foo`, the app client URL is **`/app-api/auth/foo`** (drop `{projectId}`; project comes from **`x-api-key`**). Example: `GET /api/auth/3/users/5` → `GET /app-api/auth/users/5`.

**Listing users:** Use **`POST .../users/list`** on both mounts with a JSON body. The old **`GET .../users`** list endpoint (query-string filters) is **not** supported.

**Authentication:** Use **`x-api-key`** on `/app-api/auth/...`. Use **`Authorization: Bearer`** (platform JWT) on `/api/auth/{projectId}/...`.

---

## User CRUD Operations

### 1. List Users

List and filter users for the project (paginated). **`POST /app-api/auth/users`** remains **create user** only, so listing uses a dedicated path: **`.../users/list`**.

**Project URL:** `POST /api/auth/{projectId}/users/list`  
**App API:** `POST /app-api/auth/users/list`

**Method:** `POST`  
**Headers:** `Content-Type: application/json`, plus auth for the mount (`Authorization: Bearer` on project API; `x-api-key` and session/JWT as required on app API).

**JSON body:** Send a JSON object. **All fields are optional**; send `{}` to use defaults (`page` 1, `limit` 50, no filters).

| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Page size (default: 50) |
| search | string | Case-insensitive match on name, email, or phone |
| role_id | number | Restrict to users assigned this role |
| is_active | boolean | Filter by active flag |
| metadata | object | Users whose `metadata` JSON **contains** this object (server uses JSON containment). Example: `{ "association_id": 30 }` replaces legacy query style `metadata.association_id=30`. |

**Example (project API):**
```http
POST /api/auth/3/users/list HTTP/1.1
Content-Type: application/json
Authorization: Bearer <platform-jwt>

{"page":1,"limit":20,"search":"john","is_active":true,"role_id":2,"metadata":{"association_id":30}}
```

**Example (app API):**
```http
POST /app-api/auth/users/list HTTP/1.1
Content-Type: application/json
x-api-key: <your-api-key>

{"role_id":6,"limit":5000,"metadata":{"association_id":30}}
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

**Project URL:** `GET /api/auth/{projectId}/users/{userId}`  
**App API:** `GET /app-api/auth/users/{userId}`

**Response:** `data` is the user object (not wrapped under another key).

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
    "roles": []
  },
  "timestamp": "..."
}
```

---

### 3. Get Users by Role

Get all users with a specific role.

**Project URL:** `GET /api/auth/{projectId}/roles/{roleId}/users`  
**App API:** `GET /app-api/auth/roles/{roleId}/users`

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

**Project URL:** `POST /api/auth/{projectId}/users`  
**App API:** `POST /app-api/auth/users`

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

**Response:** HTTP **201** — `data` is the created user record.

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 2,
    "name": "Jane",
    "email": "jane.smith@example.com"
  },
  "timestamp": "..."
}
```

---

### 4a. Bulk Create Users

Create multiple users in one request.

**Project URL:** `POST /api/auth/{projectId}/users/bulk`  
**App API:** `POST /app-api/auth/users/bulk`

**Request Body:**
```json
{
  "users": [
    {
      "name": "Jane",
      "email": "jane@example.com",
      "role_ids": [2]
    },
    {
      "name": "John",
      "phone": "+27821234567",
      "metadata": { "source": "import" }
    }
  ]
}
```

**Response:** HTTP `200` with `succeeded`, `failed`, `skipped`, and `results[]`. Duplicate users are reported as `skipped`.

---

### 5. Update User

Update an existing user.

**Project URL:** `PUT /api/auth/{projectId}/users/{userId}`  
**App API:** `PUT /app-api/auth/users/{userId}`

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

**Project URL:** `DELETE /api/auth/{projectId}/users/{userId}`  
**App API:** `DELETE /app-api/auth/users/{userId}`

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
  "message": "User deleted successfully",
  "data": {},
  "timestamp": "..."
}
```

---

## Role Management

### 7. Assign Role to User

Assign a role to a user.

**Project URL:** `POST /api/auth/{projectId}/users/{userId}/roles`  
**App API:** `POST /app-api/auth/users/{userId}/roles`

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
  "message": "Role assigned",
  "data": {},
  "timestamp": "..."
}
```

---

### 8. Remove Role from User

Remove a role from a user.

**Project URL:** `DELETE /api/auth/{projectId}/users/{userId}/roles/{roleId}`  
**App API:** `DELETE /app-api/auth/users/{userId}/roles/{roleId}`

**Response:**
```json
{
  "success": true,
  "message": "Role removed",
  "data": {},
  "timestamp": "..."
}
```

---

## OTP Management

### 9. Get User OTP Status

Check user's OTP verification status.

**Project URL:** `GET /api/auth/{projectId}/users/{userId}/otp-status`  
**App API:** `GET /app-api/auth/users/{userId}/otp-status`

**Response:**
```json
{
  "success": true,
  "message": "OTP status fetched",
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

**Project URL:** `POST /api/auth/{projectId}/users/{userId}/resend-otp`  
**App API:** `POST /app-api/auth/users/{userId}/resend-otp`

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
  "message": "OTP resent",
  "data": {},
  "timestamp": "..."
}
```

---

### 11. Manually Verify User

Verify a user without OTP (admin action).

**Project URL:** `POST /api/auth/{projectId}/users/{userId}/manual-verify`  
**App API:** `POST /app-api/auth/users/{userId}/manual-verify`

**Response:**
```json
{
  "success": true,
  "message": "User verified",
  "data": {},
  "timestamp": "..."
}
```

---

## Password Management

### 12. Get User Password (Admin Only)

Get whether a user currently has a password set.

**Project URL:** `GET /api/auth/{projectId}/users/{userId}/password`  
**App API:** `GET /app-api/auth/users/{userId}/password`

**Response:**
```json
{
  "success": true,
  "message": "Password status fetched",
  "data": {
    "has_password": true
  },
  "timestamp": "..."
}
```

---

### 13. Set User Password (Admin Only)

Set or reset a user's password.

**Project URL:** `POST /api/auth/{projectId}/users/{userId}/password`  
**App API:** `POST /app-api/auth/users/{userId}/password`

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

**Project URL:** `POST /api/auth/{projectId}/users/{userId}/password/verify`  
**App API:** `POST /app-api/auth/users/{userId}/password/verify`

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

**Project URL:** `POST /api/auth/{projectId}/users/export`  
**App API:** `POST /app-api/auth/users/export`

**Response:**
Returns SQL content as a downloadable file (`Content-Type: application/sql`).

---

### 15. Import Users

Import users from SQL dump.

**Project URL:** `POST /api/auth/{projectId}/users/import`  
**App API:** `POST /app-api/auth/users/import`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <platform-jwt>
x-api-key: your-api-key
```

**Request Body:** provide either **`sql`** or **`sqlContent`** (both names are accepted).

```json
{
  "sqlContent": "INSERT INTO users (name, email, ...) VALUES ...",
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

### 15a. Bulk Assign or Remove a Role

Apply one role to many users in one request.

**Project URL:** `POST /api/auth/{projectId}/users/bulk-roles`  
**App API:** `POST /app-api/auth/users/bulk-roles`

```json
{
  "user_ids": [1, 2, 3],
  "role_id": 5,
  "action": "assign"
}
```

`action` may be `assign` or `remove`. The response is a partial-success summary with `results[]`.

---

### 15b. Bulk Resend OTP

**Project URL:** `POST /api/auth/{projectId}/users/bulk-resend-otp`  
**App API:** `POST /app-api/auth/users/bulk-resend-otp`

```json
{
  "user_ids": [1, 2, 3]
}
```

---

### 15c. Bulk Verify Users

Manual verify multiple users.

**Project URL:** `POST /api/auth/{projectId}/users/bulk-verify`  
**App API:** `POST /app-api/auth/users/bulk-verify`

```json
{
  "user_ids": [1, 2, 3]
}
```

All new bulk auth endpoints accept up to `500` items per request and return HTTP `200` with `succeeded`, `failed`, `skipped`, and per-item `results`.

---

## Role CRUD Operations

### 16. List Roles

Get all roles for the project.

**Project URL:** `GET /api/auth/{projectId}/roles`  
**App API:** `GET /app-api/auth/roles`

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

**Project URL:** `POST /api/auth/{projectId}/roles`  
**App API:** `POST /app-api/auth/roles`

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

**Project URL:** `PUT /api/auth/{projectId}/roles/{roleId}`  
**App API:** `PUT /app-api/auth/roles/{roleId}`

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

**Project URL:** `DELETE /api/auth/{projectId}/roles/{roleId}`  
**App API:** `DELETE /app-api/auth/roles/{roleId}`

---

### 20. Update Role Permissions

Update permissions for a role.

**Project URL:** `PUT /api/auth/{projectId}/roles/{roleId}/permissions`  
**App API:** `PUT /app-api/auth/roles/{roleId}/permissions`

**Request Body:**
```json
{
  "permissions": ["read", "write", "delete"]
}
```

---

### 21. Update Session Duration

Update session duration for a role.

**Project URL:** `PUT /api/auth/{projectId}/roles/{roleId}/session-duration`  
**App API:** `PUT /app-api/auth/roles/{roleId}/session-duration`

**Request Body:**
```json
{
  "session_duration_minutes": 720
}
```

---

### 22. Verify organisation context (role)

**Project URL:** `GET /api/auth/{projectId}/roles/{roleId}/verify-org-context`  
**App API:** `GET /app-api/auth/roles/{roleId}/verify-org-context`

Used to validate org-related configuration for a role (response shape depends on project settings).

---

## Custom auth fields

Manage custom login identifiers linked to database columns (same path rule as above).

| Method | Project URL | App API |
|--------|-------------|---------|
| GET | `/api/auth/{projectId}/fields/available-tables` | `/app-api/auth/fields/available-tables` |
| GET | `/api/auth/{projectId}/fields` | `/app-api/auth/fields` |
| GET | `/api/auth/{projectId}/fields/{fieldId}` | `/app-api/auth/fields/{fieldId}` |
| POST | `/api/auth/{projectId}/fields` | `/app-api/auth/fields` |
| PUT | `/api/auth/{projectId}/fields/{fieldId}` | `/app-api/auth/fields/{fieldId}` |
| DELETE | `/api/auth/{projectId}/fields/{fieldId}` | `/app-api/auth/fields/{fieldId}` |
| POST | `/api/auth/{projectId}/fields/{fieldId}/apply` | `/app-api/auth/fields/{fieldId}/apply` |

---

## Auth settings & provider tests

| Method | Project URL | App API |
|--------|-------------|---------|
| GET | `/api/auth/{projectId}/settings` | `/app-api/auth/settings` |
| PUT | `/api/auth/{projectId}/settings` | `/app-api/auth/settings` |
| GET | `/api/auth/{projectId}/settings/email-providers` | `/app-api/auth/settings/email-providers` |
| GET | `/api/auth/{projectId}/settings/sms-providers` | `/app-api/auth/settings/sms-providers` |
| GET | `/api/auth/{projectId}/settings/session-durations` | `/app-api/auth/settings/session-durations` |
| GET | `/api/auth/{projectId}/settings/session-config/{roleId}` | `/app-api/auth/settings/session-config/{roleId}` |
| POST | `/api/auth/{projectId}/settings/send-verification` | `/app-api/auth/settings/send-verification` |
| POST | `/api/auth/{projectId}/settings/send-reset` | `/app-api/auth/settings/send-reset` |
| POST | `/api/auth/{projectId}/settings/verify-otp` | `/app-api/auth/settings/verify-otp` |
| POST | `/api/auth/{projectId}/settings/test-email-provider` | `/app-api/auth/settings/test-email-provider` |
| POST | `/api/auth/{projectId}/settings/test-sms-provider` | `/app-api/auth/settings/test-sms-provider` |

See also [01-AUTH-REQUESTS.md](./01-AUTH-REQUESTS.md) for end-user auth flows (`/app-api/auth/auth/...`).
