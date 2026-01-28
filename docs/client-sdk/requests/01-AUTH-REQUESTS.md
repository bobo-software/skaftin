# Authentication Requests

All authentication endpoints are available at `/app-api/auth`.

## Base URL
```
/app-api/auth
```

## Authentication Methods

The login endpoints support 4 different identifier methods:
- `email` - User's email address
- `phone` - User's phone number  
- `custom_field_1` - Custom identifier (e.g., employee ID)
- `custom_field_2` - Custom identifier (e.g., membership number)

---

## 1. Register

Create a new user account.

**Endpoint:** `POST /app-api/auth/register`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "phone": "+27821234567",
  "role_key": "user",
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
| email | string | Yes | User's email address |
| password | string | Yes | User's password (min 8 characters) |
| phone | string | No | Phone number (required if otp_method is "sms") |
| role_key | string | No | Role key to assign (e.g., "user", "admin") |
| role_id | number | No | Role ID to assign (alternative to role_key) |
| custom_field_1 | string | No | Custom identifier 1 |
| custom_field_2 | string | No | Custom identifier 2 |
| metadata | object | No | Additional user metadata |
| otp_method | string | No | OTP delivery method: "email" or "sms" |

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+27821234567",
      "is_active": true,
      "roles": [
        {
          "id": 2,
          "role_name": "User",
          "role_key": "user"
        }
      ]
    },
    "session": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

---

## 2. Login (with Password)

Authenticate with username and password.

**Endpoint:** `POST /app-api/auth/login`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "username": "john.doe@example.com",
  "password": "SecurePass123!",
  "method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | User identifier (email, phone, or custom field value) |
| password | string | Yes | User's password |
| method | string | Yes | Identifier type: "email", "phone", "custom_field_1", "custom_field_2" |

**Examples by Method:**

```json
// Login with email
{
  "username": "john.doe@example.com",
  "password": "SecurePass123!",
  "method": "email"
}

// Login with phone
{
  "username": "+27821234567",
  "password": "SecurePass123!",
  "method": "phone"
}

// Login with employee ID
{
  "username": "EMP001",
  "password": "SecurePass123!",
  "method": "custom_field_1"
}
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
      "email": "john.doe@example.com",
      "roles": [...]
    },
    "session": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "organisation_name": "church_id",
    "organisation_id": 5,
    "is_admin": false
  }
}
```

---

## 3. Single Credential Login (Passwordless)

Login without a password using just the identifier.

**Endpoint:** `POST /app-api/auth/single-credential-login`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "credential": "john.doe@example.com",
  "method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| credential | string | Yes | User identifier value |
| method | string | Yes | Identifier type: "email", "phone", "custom_field_1", "custom_field_2" |

**Response:** Same as regular login.

---

## 4. OTP Login (Two-Step Passwordless)

A two-step passwordless login flow where the user receives an OTP via email or SMS.

### 4a. Request OTP Login

Request an OTP code to be sent to the user's email or phone.

**Endpoint:** `POST /app-api/auth/otp-login`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Conditional | User's email (required if phone not provided) |
| phone | string | Conditional | User's phone number (required if email not provided) |

**Examples:**

```json
// Request OTP via email
{
  "email": "john.doe@example.com"
}

// Request OTP via SMS
{
  "phone": "+27821234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully via email",
  "data": {
    "message": "A verification code has been sent to your email. Please check and enter the code.",
    "method": "email",
    "destination": "jo***@example.com"
  }
}
```

### 4b. Verify OTP Login

Verify the OTP code and receive login credentials.

**Endpoint:** `POST /app-api/auth/verify-otp-login`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Conditional | User's email (required if phone not provided) |
| phone | string | Conditional | User's phone number (required if email not provided) |
| code | string | Yes | The OTP code received |

**Examples:**

```json
// Verify with email
{
  "email": "john.doe@example.com",
  "code": "123456"
}

// Verify with phone
{
  "phone": "+27821234567",
  "code": "123456"
}
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
      "email": "john.doe@example.com",
      "roles": [...]
    },
    "organisation": {
      "name": "org_field",
      "id": 5,
      "is_admin": false
    },
    "session": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Error Responses:**

```json
// Invalid OTP
{
  "success": false,
  "message": "Invalid OTP code. 2 attempt(s) remaining."
}

// Expired OTP
{
  "success": false,
  "message": "OTP code has expired. Please request a new login code."
}

// Max attempts exceeded
{
  "success": false,
  "message": "Maximum verification attempts exceeded. Please request a new login code."
}
```

---

## 5. Verify Token

Verify if a JWT token is valid.

**Endpoint:** `POST /app-api/auth/verify`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:** Empty or `{}`

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 1,
      "email": "john.doe@example.com",
      "roles": [...]
    }
  }
}
```

---

## 6. Logout

End the user's session.

**Endpoint:** `POST /app-api/auth/logout`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 7. Verify OTP

Verify an OTP code sent during registration.

**Endpoint:** `POST /app-api/auth/verify-otp`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {...},
    "session": {
      "accessToken": "..."
    }
  }
}
```

---

## 8. Forgot Password

Request a password reset OTP. Supports both email and phone number as identifiers.

**Endpoint:** `POST /app-api/auth/forgot-password`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "phone": null,
  "method": "email"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Conditional | User's email address (required if phone not provided) |
| phone | string | Conditional | User's phone number (required if email not provided) |
| method | string | Conditional | OTP delivery: "email" or "sms". Required "sms" if only phone provided |

**Examples:**

```json
// Request via email (default)
{
  "email": "john.doe@example.com",
  "method": "email"
}

// Request via phone (SMS)
{
  "phone": "+27821234567",
  "method": "sms"
}

// With email but send via SMS (user's phone on file)
{
  "email": "john.doe@example.com",
  "method": "sms"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully via email",
  "data": {
    "message": "A verification code has been sent to your email. Please check and enter the code.",
    "method": "email",
    "destination": "jo***@example.com"
  }
}
```

---

## 9. Verify Forgot Password OTP

Verify the password reset OTP. Use the same identifier (email or phone) used in the forgot password request.

**Endpoint:** `POST /app-api/auth/verify-forgot-password-otp`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Conditional | User's email (required if phone not provided) |
| phone | string | Conditional | User's phone number (required if email not provided) |
| code | string | Yes | The OTP code received |

**Examples:**

```json
// Verify with email
{
  "email": "john.doe@example.com",
  "code": "123456"
}

// Verify with phone
{
  "phone": "+27821234567",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "message": "OTP verified. You can now reset your password.",
    "reset_token": "a1b2c3d4e5f6...",
    "expires_in_minutes": 15
  }
}
```

---

## 10. Reset Password

Set a new password after OTP verification. Use the same identifier (email or phone) and the reset token from the verify step.

**Endpoint:** `POST /app-api/auth/reset-password`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "reset_token": "a1b2c3d4e5f6...",
  "new_password": "NewSecurePass123!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Conditional | User's email (required if phone not provided) |
| phone | string | Conditional | User's phone number (required if email not provided) |
| reset_token | string | Yes | The reset token from verify-forgot-password-otp |
| new_password | string | Yes | New password (minimum 8 characters) |

**Examples:**

```json
// Reset with email identifier
{
  "email": "john.doe@example.com",
  "reset_token": "a1b2c3d4e5f6...",
  "new_password": "NewSecurePass123!"
}

// Reset with phone identifier
{
  "phone": "+27821234567",
  "reset_token": "a1b2c3d4e5f6...",
  "new_password": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 11. Change Password Request (Logged-in Users)

Request password change for logged-in users.

**Endpoint:** `POST /app-api/auth/change-password-request`

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
  "message": "Password change OTP sent"
}
```

---

## 12. Verify Password Change OTP

Verify OTP and change password.

**Endpoint:** `POST /app-api/auth/verify-password-change-otp`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "otp": "123456",
  "new_password": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 13. Request Account Deletion

Request to delete the user's account.

**Endpoint:** `POST /app-api/auth/request-account-deletion`

**Headers:**
```
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
  "message": "Account deletion OTP sent"
}
```

---

## 14. Verify Account Deletion OTP

Confirm account deletion with OTP.

**Endpoint:** `POST /app-api/auth/verify-account-deletion-otp`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account scheduled for deletion"
}
```

---

## 15. Cancel Account Deletion

Cancel a pending account deletion.

**Endpoint:** `POST /app-api/auth/cancel-account-deletion`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Account deletion cancelled"
}
```

---

## Error Responses

### Invalid Credentials
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### Account Inactive
```json
{
  "success": false,
  "message": "Account pending verification. Please verify your email with the OTP code sent to you.",
  "data": {
    "requires_otp": true,
    "user_id": 1,
    "email": "john.doe@example.com"
  }
}
```

### Registration Disabled
```json
{
  "success": false,
  "message": "Registration is disabled for this project"
}
```
