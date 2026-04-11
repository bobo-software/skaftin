# Authentication Requests

App clients should call **`/app-api/auth/...`** with the **`x-api-key`** header. The server resolves the project from the key, so paths do not include `projectId`.

The same handlers are also mounted under **`/api/auth/{projectId}/auth/...`** for direct, project-scoped calls (typical for server-side or admin tools). On the reference Go server, those public auth routes are **not** wrapped in API-key middleware; your gateway may still require a key.

## Response shape

Successful responses:

```json
{
  "success": true,
  "message": "...",
  "data": { },
  "timestamp": "2026-04-11T12:00:00.000000000Z"
}
```

Errors:

```json
{
  "success": false,
  "message": "...",
  "error": "..."
}
```

## Endpoint map (App API)

| Action | App API (`x-api-key`) |
|--------|------------------------|
| Register | `POST /app-api/auth/auth/register` |
| Login | `POST /app-api/auth/auth/login` |
| Single-credential login | `POST /app-api/auth/auth/single-credential-login` |
| Request OTP login | `POST /app-api/auth/auth/otp-login` |
| Verify OTP login | `POST /app-api/auth/auth/verify-otp-login` |
| Verify session | `POST /app-api/auth/auth/verify` |
| Logout | `POST /app-api/auth/auth/logout` |
| Verify registration OTP | `POST /app-api/auth/auth/verify-otp` |
| Forgot password | `POST /app-api/auth/auth/forgot-password` |
| Verify forgot-password OTP | `POST /app-api/auth/auth/verify-forgot-password-otp` |
| Reset password | `POST /app-api/auth/auth/reset-password` |
| Session refresh (SuperTokens) | `POST /app-api/auth/session/refresh` |
| Change password (start) | `POST /app-api/auth/auth/change-password-request` |
| Verify password-change OTP | `POST /app-api/auth/auth/verify-password-change-otp` |
| Request account deletion | `POST /app-api/auth/auth/request-account-deletion` |
| Verify account-deletion OTP | `POST /app-api/auth/auth/verify-account-deletion-otp` |
| Cancel account deletion | `POST /app-api/auth/auth/cancel-account-deletion` |

Project-scoped equivalents replace the prefix with `POST /api/auth/{projectId}/auth/...` (same path suffix, e.g. `.../register`, `.../verify-otp`).

## Login identifier methods

Login-related endpoints support these `method` values:

- `email` — user's email address  
- `phone` — user's phone number  
- `custom_field_1` — custom identifier (e.g. employee ID)  
- `custom_field_2` — custom identifier (e.g. membership number)

---

## 1. Register

Create a new user account.

**App API:** `POST /app-api/auth/auth/register`  
**Project URL:** `POST /api/auth/{projectId}/auth/register`

**Headers (app API):**

```
Content-Type: application/json
x-api-key: your-api-key
```

**Request body:**

```json
{
  "name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "phone": "+27821234567",
  "role_id": 2,
  "custom_field_1": "EMP001",
  "custom_field_2": "MEMBER123",
  "metadata": {
    "department": "Sales",
    "location": "Cape Town"
  },
  "otp_method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's first name |
| last_name | string | No | User's last name |
| email | string | Conditional | Required unless `phone` is provided |
| phone | string | Conditional | Required unless `email` is provided |
| password | string | Yes | User's password |
| role_id | number | No | Role ID to assign (in addition to the project's default role, if configured) |
| custom_field_1 | string | No | Custom identifier 1 |
| custom_field_2 | string | No | Custom identifier 2 |
| metadata | object | No | Additional user metadata |
| otp_method | string | No | When registration OTP is enabled in project settings: `"email"` or `"sms"` |

If registration OTP is sent, the user is created with **`is_active`: `false`** until **`verify-otp`** succeeds. The server still attempts to create a session on register; when OTP is pending, treat the user as unverified until OTP is confirmed (and use **`verify-otp`** + login as your product flow requires).

**Response** (HTTP **201**):

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+27821234567",
      "is_active": true
    },
    "message": "User registered successfully",
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "..."
}
```

`accessToken` is omitted if session creation fails. There is **no** `session` wrapper — the token is **`data.accessToken`**.

---

## 2. Login (with password)

**App API:** `POST /app-api/auth/auth/login`  
**Project URL:** `POST /api/auth/{projectId}/auth/login`

**Headers (app API):**

```
Content-Type: application/json
x-api-key: your-api-key
```

**Request body** — supply the identifier in **`credential`**, or **`email`**, or **`phone`** (the service merges these). For **`POST /app-api/auth/auth/login`** only, **`username`** is accepted and mapped to **`credential`** when `credential` / `email` / `phone` are absent.

```json
{
  "credential": "john.doe@example.com",
  "password": "SecurePass123!",
  "method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| credential / email / phone | string | Yes | Login identifier (any one of these keys) |
| password | string | Yes | User's password |
| method | string | No | Defaults to **`email`**. One of `email`, `phone`, `custom_field_1`, `custom_field_2` |

**Examples:**

```json
{ "credential": "john.doe@example.com", "password": "SecurePass123!", "method": "email" }
{ "credential": "+27821234567", "password": "SecurePass123!", "method": "phone" }
{ "credential": "EMP001", "password": "SecurePass123!", "method": "custom_field_1" }
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John",
      "email": "john.doe@example.com"
    },
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "Login successful"
  },
  "timestamp": "..."
}
```

Organization context is carried in the JWT access token payload, not as separate fields in this JSON.

**Login error (invalid credentials)** — HTTP **401**:

```json
{
  "success": false,
  "message": "invalid credentials",
  "error": "invalid credentials"
}
```

---

## 3. Single-credential login (passwordless)

**App API:** `POST /app-api/auth/auth/single-credential-login`  
**Project URL:** `POST /api/auth/{projectId}/auth/single-credential-login`

**Headers (app API):** same as register.

**Request body:**

```json
{
  "credential": "john.doe@example.com",
  "method": "email"
}
```

You may use **`email`** instead of **`credential`** when the method is email.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| credential / email | string | Yes | User identifier value |
| method | string | No | Defaults to **`email`** |

**Response:** Same shape as password login (`user`, `accessToken`, `message` inside `data`).

---

## 4. OTP login (two-step)

### 4a. Request OTP login

**App API:** `POST /app-api/auth/auth/otp-login`  
**Project URL:** `POST /api/auth/{projectId}/auth/otp-login`

**Request body:**

```json
{ "email": "john.doe@example.com" }
```

or `{ "phone": "+27821234567" }`.

**Response** — always the same message whether or not the account exists (no user enumeration):

```json
{
  "success": true,
  "message": "OTP sent if account exists",
  "data": {},
  "timestamp": "..."
}
```

### 4b. Verify OTP login

**App API:** `POST /app-api/auth/auth/verify-otp-login`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify-otp-login`

**Request body:**

```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email or phone | string | Yes | Same channel used in `otp-login` |
| otp | string | Yes | Alias: **`otp_code`** |

**Response:**

```json
{
  "success": true,
  "message": "OTP login verified",
  "data": {
    "user": { "id": 1, "email": "john.doe@example.com" },
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "OTP verified successfully"
  },
  "timestamp": "..."
}
```

**Typical error responses** (HTTP **400**, `success: false`): e.g. `"invalid OTP code"`, `"OTP has expired"`, `"too many attempts"`, `"no pending OTP found"`, `"user not found"`.

---

## 5. Verify session

**App API:** `POST /app-api/auth/auth/verify`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify`

**Headers:**

```
Authorization: Bearer <access-token>
```

Alternatively, send JSON `{ "accessToken": "..." }` if the header is not set.

**Response:**

```json
{
  "success": true,
  "message": "Session verified",
  "data": {
    "user": { "id": 1, "email": "john.doe@example.com" },
    "message": "Token is valid"
  },
  "timestamp": "..."
}
```

---

## 6. Logout

**App API:** `POST /app-api/auth/auth/logout`  
**Project URL:** `POST /api/auth/{projectId}/auth/logout`

**Headers / body:** Bearer token, or JSON `{ "accessToken": "..." }`.

**Response:**

```json
{
  "success": true,
  "message": "Logged out",
  "data": {},
  "timestamp": "..."
}
```

---

## 7. Session refresh (SuperTokens)

**App API:** `POST /app-api/auth/session/refresh`

Forwards refresh semantics to SuperTokens (cookies / tokens as configured). Some clients receive a JSON success stub when no refresh body is needed.

---

## 8. Verify OTP (registration)

Confirms the **registration** OTP and activates the user. This is **not** the same as **`verify-otp-login`** (passwordless sign-in).

**App API:** `POST /app-api/auth/auth/verify-otp`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify-otp`

**Headers (app API):** `Content-Type: application/json`, `x-api-key`

**Request body:**

```json
{
  "user_id": 1,
  "otp": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | number | Yes | App user id returned from register (`data.user.id`) |
| otp | string | Yes | Alias: **`otp_code`** |

**Response** — the handler **does not** return a new session or user object; it only confirms verification:

```json
{
  "success": true,
  "message": "OTP verified",
  "data": {},
  "timestamp": "..."
}
```

After success, call **login** (or reuse an existing access token from registration, if your flow allows).

---

## 9. Forgot password

**App API:** `POST /app-api/auth/auth/forgot-password`  
**Project URL:** `POST /api/auth/{projectId}/auth/forgot-password`

**Request body:**

```json
{
  "email": "john.doe@example.com",
  "method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email or phone | string | Yes | Identifier |
| method | string | No | `"email"` or `"sms"` (e.g. SMS to the user's stored phone when email is given) |
| code | string | No | Optional fixed OTP for testing; normally generated server-side |

**Response:**

```json
{
  "success": true,
  "message": "If the account exists, a password reset OTP has been sent",
  "data": {},
  "timestamp": "..."
}
```

---

## 10. Verify forgot-password OTP

**App API:** `POST /app-api/auth/auth/verify-forgot-password-otp`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify-forgot-password-otp`

**Request body:** same identifier shape as forgot-password, plus `otp` or `otp_code`.

**Response:**

```json
{
  "success": true,
  "message": "Forgot password OTP verified",
  "data": {
    "reset_token": "a1b2c3d4e5f6...",
    "expires_in_minutes": 15
  },
  "timestamp": "..."
}
```

---

## 11. Reset password

**App API:** `POST /app-api/auth/auth/reset-password`  
**Project URL:** `POST /api/auth/{projectId}/auth/reset-password`

**Request body:**

```json
{
  "email": "john.doe@example.com",
  "reset_token": "a1b2c3d4e5f6...",
  "new_password": "NewSecurePass123!"
}
```

Use **`phone`** instead of **`email`** when the account is phone-based.

**Response:**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {},
  "timestamp": "..."
}
```

---

## 12. Change password request

Validates the current password and either applies the new password immediately or sends an OTP (per project auth settings).

**App API:** `POST /app-api/auth/auth/change-password-request`  
**Project URL:** `POST /api/auth/{projectId}/auth/change-password-request`

**Headers (app API):** `Content-Type: application/json`, `x-api-key`  
**Headers (project URL):** `Content-Type: application/json`, `Authorization: Bearer <platform-jwt>` (JWT + project access on the reference server)

**Request body:**

```json
{
  "app_user_id": 1,
  "old_password": "CurrentPassword123!",
  "new_password": "NewSecurePass123!"
}
```

`user_id` is accepted as an alias for `app_user_id`.

**When OTP is required** (`RequireOtpForPasswordChange` in settings):

```json
{
  "success": true,
  "message": "Password change OTP sent",
  "data": {
    "message": "OTP sent for password change verification",
    "requires_otp": true
  },
  "timestamp": "..."
}
```

**When OTP is not required** (password updated in this call):

```json
{
  "success": true,
  "message": "Password change OTP sent",
  "data": {
    "message": "Password changed successfully"
  },
  "timestamp": "..."
}
```

Note: the top-level **`message`** is currently **`"Password change OTP sent"`** in both cases; use **`data.requires_otp`** and **`data.message`** to branch in clients.

---

## 13. Verify password change OTP

**App API:** `POST /app-api/auth/auth/verify-password-change-otp`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify-password-change-otp`

**Request body:** `app_user_id` (or `user_id`), `otp` or `otp_code`.

**Response:**

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {},
  "timestamp": "..."
}
```

OTP expires after **10 minutes**; **3** failed attempts invalidate the pending OTP.

---

## 14. Request account deletion

**App API:** `POST /app-api/auth/auth/request-account-deletion`  
**Project URL:** `POST /api/auth/{projectId}/auth/request-account-deletion`

**Headers:** app API uses **`x-api-key`**; project URL uses platform **`Authorization: Bearer`** as for other protected `/api/auth/...` routes.

**Request body:**

```json
{
  "app_user_id": 1,
  "password": "CurrentPassword123!",
  "reason": "No longer needed"
}
```

If OTP for account deletion is **disabled**, the account is scheduled immediately:

```json
{
  "success": true,
  "message": "Account deletion requested",
  "data": {
    "message": "Account deletion scheduled",
    "deletion_date": "2026-04-18T12:00:00Z"
  },
  "timestamp": "..."
}
```

If OTP is **enabled**:

```json
{
  "success": true,
  "message": "Account deletion requested",
  "data": {
    "message": "OTP sent for account deletion verification",
    "requires_otp": true
  },
  "timestamp": "..."
}
```

---

## 15. Verify account deletion OTP

**App API:** `POST /app-api/auth/auth/verify-account-deletion-otp`  
**Project URL:** `POST /api/auth/{projectId}/auth/verify-account-deletion-otp`

**Response:**

```json
{
  "success": true,
  "message": "Account deletion confirmed",
  "data": {},
  "timestamp": "..."
}
```

---

## 16. Cancel account deletion

**App API:** `POST /app-api/auth/auth/cancel-account-deletion`  
**Project URL:** `POST /api/auth/{projectId}/auth/cancel-account-deletion`

**Request body:** `{ "app_user_id": 1 }` (or `user_id`).

**Response:**

```json
{
  "success": true,
  "message": "Account deletion cancelled",
  "data": {},
  "timestamp": "..."
}
```

---

## Error responses

### Invalid credentials (login)

HTTP **401**:

```json
{
  "success": false,
  "message": "invalid credentials",
  "error": "invalid credentials"
}
```

### Registration disabled

```json
{
  "success": false,
  "message": "registration is disabled",
  "error": "registration is disabled"
}
```

(Messages are normalized to lowercase in many paths; always check `success` and HTTP status.)

### Pending registration OTP

The API does **not** return a dedicated “account inactive” payload on login. If registration OTP is enabled, the registered user has **`is_active`: false** until **`verify-otp`** succeeds; use the register response (`data.user.id`, `data.user.is_active`) and the **`verify-otp`** flow above.
