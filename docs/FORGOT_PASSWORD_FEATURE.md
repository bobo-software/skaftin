# 🔐 Forgot Password Feature

## Overview

The forgot password feature provides a secure, OTP-based password reset flow for app users. Users can reset their password by verifying their identity through an OTP sent via email or SMS.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FORGOT PASSWORD FLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. REQUEST OTP
   ├─ User enters email
   ├─ System checks if user exists
   ├─ Generate 6-digit OTP
   ├─ Store OTP in database (purpose: 'password_reset')
   └─ Send OTP via email/SMS

2. VERIFY OTP
   ├─ User enters OTP code
   ├─ System validates OTP (not expired, max 3 attempts)
   ├─ Mark OTP as verified
   ├─ Generate reset token (expires in 15 minutes)
   └─ Return reset token to client

3. RESET PASSWORD
   ├─ User enters new password
   ├─ Verify reset token is valid
   ├─ Update password in SuperTokens
   ├─ Clear reset token
   └─ Invalidate all password reset OTPs
```

## API Endpoints

### 1. Send Forgot Password OTP

**Endpoint:** `POST /api/app-auth/auth/forgot-password`  
**Alternative:** `POST /api/app-auth/:projectId/auth/forgot-password`

**Authentication:** Public endpoint (requires x-api-key or x-access-token header)

**Request Body:**
```json
{
  "email": "user@example.com",
  "method": "email" // or "sms" (optional, defaults to "email")
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent successfully via email",
  "data": {
    "message": "A verification code has been sent to your email. Please check and enter the code.",
    "method": "email",
    "destination": "us***@example.com"
  }
}
```

**Response (Email not found - for security, same response):**
```json
{
  "success": true,
  "message": "If the email exists, an OTP code has been sent",
  "data": {
    "message": "If the email exists in our system, you will receive an OTP code shortly."
  }
}
```

**Errors:**
- `403` - Authentication or password reset not enabled
- `400` - Invalid method
- `500` - Failed to send OTP

---

### 2. Verify Forgot Password OTP

**Endpoint:** `POST /api/app-auth/auth/verify-forgot-password-otp`  
**Alternative:** `POST /api/app-auth/:projectId/auth/verify-forgot-password-otp`

**Authentication:** Public endpoint (requires x-api-key or x-access-token header)

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "message": "OTP verified. You can now reset your password.",
    "reset_token": "a1b2c3d4e5f6g7h8i9j0...",
    "expires_in_minutes": 15
  }
}
```

**Errors:**
- `404` - User not found
- `400` - No pending OTP, OTP expired, max attempts exceeded, or invalid OTP
- `400` - Invalid OTP code (shows remaining attempts)

---

### 3. Reset Password

**Endpoint:** `POST /api/app-auth/auth/reset-password`  
**Alternative:** `POST /api/app-auth/:projectId/auth/reset-password`

**Authentication:** Public endpoint (requires x-api-key or x-access-token header)

**Request Body:**
```json
{
  "email": "user@example.com",
  "reset_token": "a1b2c3d4e5f6g7h8i9j0...",
  "new_password": "NewSecurePassword123!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "message": "Your password has been reset successfully. You can now log in with your new password."
  }
}
```

**Errors:**
- `404` - User not found
- `400` - Invalid or expired reset token
- `400` - Password too short (minimum 8 characters)
- `500` - Failed to update password

---

## Database Schema

### OTP Verifications Table

The feature uses the `skaftin_system_otp_verifications` table with a `purpose` field to distinguish between registration and password reset OTPs.

**Table Structure:**
```sql
CREATE TABLE {schema}.skaftin_system_otp_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES {schema}.skaftin_system_users(id) ON DELETE CASCADE,
  otp_code VARCHAR(10) NOT NULL,
  otp_method VARCHAR(10) NOT NULL CHECK (otp_method IN ('email', 'sms')),
  destination VARCHAR(255) NOT NULL,
  purpose VARCHAR(20) NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration', 'password_reset')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Metadata

Reset tokens are temporarily stored in the user's metadata:

```json
{
  "password_reset_token": "a1b2c3d4e5f6g7h8i9j0...",
  "password_reset_expires_at": "2025-12-03T12:30:00.000Z"
}
```

---

## Client-Side Implementation

### Using AuthService

The frontend `AuthService` provides three methods for the forgot password flow:

#### 1. Send OTP

```typescript
import AuthService from '@/services/AuthService';

// Send OTP via email (default)
const result = await AuthService.sendForgotPasswordOTP('user@example.com', {
  projectId: 123,
  apiKey: 'your-api-key',
  method: 'email' // or 'sms'
});

if (result.success) {
  console.log('OTP sent:', result.message);
  console.log('Masked destination:', result.data.destination);
} else {
  console.error('Error:', result.error);
}
```

#### 2. Verify OTP

```typescript
const result = await AuthService.verifyForgotPasswordOTP(
  'user@example.com',
  '123456',
  {
    projectId: 123,
    apiKey: 'your-api-key'
  }
);

if (result.success) {
  const resetToken = result.data.reset_token;
  // Store reset token for the next step
  console.log('OTP verified. Reset token:', resetToken);
} else {
  console.error('Error:', result.error);
}
```

#### 3. Reset Password

```typescript
const result = await AuthService.resetPassword(
  'user@example.com',
  resetToken,
  'NewSecurePassword123!',
  {
    projectId: 123,
    apiKey: 'your-api-key'
  }
);

if (result.success) {
  console.log('Password reset successfully!');
  // Redirect to login page
} else {
  console.error('Error:', result.error);
}
```

### Complete Example

```typescript
// Step 1: Request OTP
const sendResult = await AuthService.sendForgotPasswordOTP(email, {
  projectId: 123,
  apiKey: apiKey,
  method: 'email'
});

if (!sendResult.success) {
  showError(sendResult.error);
  return;
}

showMessage('OTP sent to your email');

// Step 2: Verify OTP (after user enters code)
const verifyResult = await AuthService.verifyForgotPasswordOTP(
  email,
  otpCode,
  { projectId: 123, apiKey: apiKey }
);

if (!verifyResult.success) {
  showError(verifyResult.error);
  return;
}

const resetToken = verifyResult.data.reset_token;
showMessage('OTP verified. Please enter your new password.');

// Step 3: Reset password (after user enters new password)
const resetResult = await AuthService.resetPassword(
  email,
  resetToken,
  newPassword,
  { projectId: 123, apiKey: apiKey }
);

if (!resetResult.success) {
  showError(resetResult.error);
  return;
}

showMessage('Password reset successfully!');
redirectToLogin();
```

---

## Security Features

### 1. OTP Security

- **6-digit codes:** 100,000 - 999,999
- **10-minute expiration:** OTPs automatically expire
- **Max 3 attempts:** Prevents brute force attacks
- **One-time use:** OTPs are invalidated after verification
- **Purpose-specific:** Separate OTPs for registration vs password reset

### 2. Reset Token Security

- **32-byte random token:** Cryptographically secure
- **15-minute expiration:** Short-lived tokens
- **Single use:** Tokens are cleared after password reset
- **Database storage:** Stored in user metadata, not exposed

### 3. Email Privacy

- **Masked destinations:** Email addresses are partially hidden in responses
- **No user enumeration:** Same response whether email exists or not
- **Secure communication:** OTPs sent via configured email/SMS providers

### 4. Password Requirements

- **Minimum 8 characters:** Enforced at API level
- **SuperTokens integration:** Passwords managed by SuperTokens
- **Bcrypt hashing:** Industry-standard password hashing

---

## Configuration

### Enable Password Reset

Password reset can be enabled/disabled per project in auth settings:

```sql
UPDATE skaftin_system_auth_settings 
SET enable_password_reset = true
WHERE project_id = 123;
```

Or via API:

```typescript
// PUT /api/auth/:projectId/settings
{
  "enable_password_reset": true,
  "auth_enabled": true,
  "email_provider_id": 1
}
```

### Email Provider

An email provider must be configured to send OTPs via email:

1. Go to Auth Settings → Email Providers
2. Configure SMTP or email service
3. Set as active provider

### SMS Provider (Optional)

For SMS OTP delivery:

1. Go to Auth Settings → SMS Providers
2. Configure SMS service (SA Mobile SMS / MyMobileAPI)
3. Set as active provider

---

## Migration

### Apply Migration

Run the migration to add the `purpose` column to existing OTP tables:

```bash
psql -U skaftin_user -d skaftin_db -f migrations/0013_add_otp_purpose.sql
```

Or use the migration script:

```bash
npm run migrate
```

### Migration Details

The migration:
- Adds `purpose` column to all project schemas
- Sets default value to `'registration'` for existing records
- Adds CHECK constraint for `'registration'` or `'password_reset'`
- Safe to run multiple times (idempotent)

---

## Email Templates

### Password Reset OTP Email

**Subject:** Password Reset Code - {Project Name}

**HTML Template:**
- Modern, responsive design
- Large, centered OTP code
- 10-minute expiration notice
- Security warning
- Project branding

**Text Template:**
- Plain text alternative
- All essential information
- Security notice

---

## Testing

### Manual Testing Flow

1. **Request OTP:**
   ```bash
   curl -X POST http://localhost:8001/api/app-auth/auth/forgot-password \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"email":"user@example.com","method":"email"}'
   ```

2. **Verify OTP:**
   ```bash
   curl -X POST http://localhost:8001/api/app-auth/auth/verify-forgot-password-otp \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"email":"user@example.com","code":"123456"}'
   ```

3. **Reset Password:**
   ```bash
   curl -X POST http://localhost:8001/api/app-auth/auth/reset-password \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"email":"user@example.com","reset_token":"token","new_password":"NewPass123!"}'
   ```

### Test Cases

- ✅ Valid email sends OTP
- ✅ Invalid email returns generic success (security)
- ✅ OTP expires after 10 minutes
- ✅ Max 3 OTP verification attempts
- ✅ Valid OTP returns reset token
- ✅ Reset token expires after 15 minutes
- ✅ Password updates successfully
- ✅ Old OTPs invalidated after reset
- ✅ SMS OTP delivery (if SMS provider configured)
- ✅ Password must be 8+ characters

---

## Error Handling

### Common Errors

1. **OTP Expired:**
   - User must request a new OTP
   - Old OTP is marked as expired

2. **Max Attempts Exceeded:**
   - User must request a new OTP
   - OTP is marked as failed

3. **Reset Token Expired:**
   - User must start over from step 1
   - Request new OTP

4. **Email Provider Not Configured:**
   - Admin must configure email provider
   - Check auth settings

5. **Password Too Short:**
   - Minimum 8 characters required
   - Client-side validation recommended

---

## Best Practices

### Client Implementation

1. **Validate inputs:** Check email format and password strength client-side
2. **Clear sensitive data:** Clear OTP codes and reset tokens after use
3. **User feedback:** Show clear error messages and success confirmations
4. **Rate limiting:** Implement client-side rate limiting for OTP requests
5. **Accessibility:** Ensure forms are accessible (ARIA labels, keyboard navigation)

### Security

1. **HTTPS only:** Always use HTTPS in production
2. **Secure storage:** Never log or store OTP codes or reset tokens
3. **Session management:** Invalidate old sessions after password reset
4. **Monitoring:** Log password reset attempts for security monitoring
5. **User notification:** Consider sending "password changed" confirmation emails

### UX

1. **Clear instructions:** Guide users through each step
2. **Progress indicators:** Show which step user is on (1/3, 2/3, 3/3)
3. **Resend OTP:** Allow users to request new OTP if not received
4. **Time remaining:** Show OTP expiration countdown
5. **Password strength:** Show password strength indicator

---

## Troubleshooting

### OTP Not Received

1. Check spam/junk folder
2. Verify email provider is configured and active
3. Check email provider logs
4. Ensure email address is correct
5. Check SMTP credentials

### Reset Token Invalid

1. Verify token hasn't expired (15 minutes)
2. Check token is being passed correctly
3. Ensure user metadata is accessible
4. Verify database connection

### Password Update Failed

1. Check SuperTokens connection
2. Verify user has supertokens_user_id
3. Check password meets requirements (8+ characters)
4. Review error logs

---

## Future Enhancements

### Planned Features

1. **Custom OTP expiration:** Allow configurable OTP expiration times
2. **Custom OTP length:** Support 4-digit or 8-digit OTPs
3. **Multi-factor authentication:** Add optional 2FA for password reset
4. **Password history:** Prevent reuse of recent passwords
5. **Account lockout:** Temporarily lock account after multiple failed attempts
6. **Alternative verification:** Security questions or backup codes
7. **SMS fallback:** Automatic SMS if email fails
8. **Internationalization:** Multi-language support for emails

---

## Related Documentation

- [App User Authentication](./APP_USER_AUTH_SEPARATION.md)
- [OTP Verification Feature](./OTP_REGISTRATION_ENHANCEMENT_COMPLETE.md)
- [Email Communications](./COMMUNICATIONS_FEATURE_SUMMARY.md)
- [Auth Settings](./AUTH_SYSTEM_IMPLEMENTATION.md)
- [Client SDK - Authentication](./client-sdk/07-APP-USER-AUTHENTICATION.md)

---

## Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Check auth settings configuration
4. Verify email/SMS providers are active
5. Contact support team

---

**Last Updated:** December 3, 2025  
**Feature Version:** 1.0.0  
**Status:** ✅ Complete

