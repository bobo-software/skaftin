# Password Change with Optional OTP - Testing Guide

## Overview
This guide covers testing the new password change feature for logged-in app users with optional OTP verification.

## Prerequisites

### Database Migration
First, apply the database migration:

```bash
# Navigate to project root
cd /media/bobo/samsung_drive/Development/Skaftin

# Apply migration
psql -U postgres -d skaftin -f migrations/0015_add_require_otp_password_change.sql
```

### Restart Backend Server
After applying the migration, restart the backend server:

```bash
npm run dev
# or
nodemon
```

## Test Scenarios

### Test 1: Password Change WITHOUT OTP (Default)

#### Setup
1. Navigate to Project → Auth → Messaging
2. Scroll to "Notifications" section
3. Ensure "Require OTP verification for password changes" is **unchecked**
4. Click "Save Notifications"

#### Steps
1. **Get access token**: Login as an app user via API or frontend
   ```bash
   # Login to get access token
   curl -X POST http://localhost:4005/api/app-auth/auth/login \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{
       "username": "user@example.com",
       "password": "OldPassword123",
       "method": "email"
     }'
   ```

2. **Request password change** (immediate change):
   ```bash
   curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "old_password": "OldPassword123",
       "new_password": "NewPassword456"
     }'
   ```

#### Expected Results
- ✅ Response: `200 OK`
- ✅ Message: "Password changed successfully"
- ✅ No OTP sent
- ✅ Password immediately updated
- ✅ Can login with new password immediately

#### Verify
```bash
# Try logging in with new password
curl -X POST http://localhost:4005/api/app-auth/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "username": "user@example.com",
    "password": "NewPassword456",
    "method": "email"
  }'
```

---

### Test 2: Password Change WITH OTP (Email)

#### Setup
1. Navigate to Project → Auth → Messaging
2. Ensure email provider is configured
3. Check "Require OTP verification for password changes"
4. Click "Save Notifications"

#### Steps
1. **Login as app user** (get access token - see Test 1)

2. **Request password change** (with email OTP):
   ```bash
   curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "old_password": "CurrentPassword123",
       "new_password": "NewPassword789",
       "otp_method": "email"
     }'
   ```

#### Expected Results
- ✅ Response: `200 OK`
- ✅ Message: "A verification code has been sent to your email"
- ✅ `requires_otp: true`
- ✅ `otp_method: "email"`
- ✅ Email received with 6-digit OTP code
- ✅ Password NOT changed yet

3. **Verify OTP and complete password change**:
   ```bash
   curl -X POST http://localhost:4005/api/app-auth/auth/verify-password-change-otp \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "code": "123456"
     }'
   ```

#### Expected Results
- ✅ Response: `200 OK`
- ✅ Message: "Password changed successfully"
- ✅ Password now updated
- ✅ Can login with new password

---

### Test 3: Password Change WITH OTP (SMS)

#### Setup
1. Ensure SMS provider is configured (Project → Communications → SMS)
2. Ensure "Require OTP verification for password changes" is checked
3. User must have a phone number in their profile

#### Steps
1. **Login as app user** (get access token)

2. **Request password change** (with SMS OTP):
   ```bash
   curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "old_password": "CurrentPassword123",
       "new_password": "NewPassword999",
       "otp_method": "sms"
     }'
   ```

#### Expected Results
- ✅ Response: `200 OK`
- ✅ SMS sent with 6-digit OTP code
- ✅ `requires_otp: true`
- ✅ `otp_method: "sms"`
- ✅ Password NOT changed yet

3. **Verify OTP** (same as Test 2, step 3)

---

### Test 4: Security Validations

#### Test 4.1: Wrong Old Password
```bash
curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "old_password": "WrongPassword",
    "new_password": "NewPassword123"
  }'
```

**Expected**: `401 Unauthorized` - "Invalid old password"

#### Test 4.2: Same Password
```bash
curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "old_password": "SamePassword123",
    "new_password": "SamePassword123"
  }'
```

**Expected**: `400 Bad Request` - "New password must be different from old password"

#### Test 4.3: Short Password
```bash
curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "old_password": "ValidPassword123",
    "new_password": "Short1"
  }'
```

**Expected**: `400 Bad Request` - "New password must be at least 8 characters long"

#### Test 4.4: Invalid OTP Code
```bash
# After requesting password change with OTP
curl -X POST http://localhost:4005/api/app-auth/auth/verify-password-change-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "code": "999999"
  }'
```

**Expected**: `400 Bad Request` - "Invalid OTP code. X attempt(s) remaining."

#### Test 4.5: Max OTP Attempts
- Try 3 times with wrong OTP
- **Expected**: After 3rd attempt - "Maximum verification attempts exceeded"

#### Test 4.6: Expired OTP
- Request OTP
- Wait 11+ minutes
- Try to verify
- **Expected**: `400 Bad Request` - "OTP code has expired"

#### Test 4.7: No Authentication
```bash
curl -X POST http://localhost:4005/api/app-auth/auth/change-password-request \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "old_password": "Password123",
    "new_password": "NewPassword456"
  }'
```

**Expected**: `401 Unauthorized` - "Authentication required"

---

## Frontend Testing

### UI Testing Checklist

1. **Navigate to Auth Settings**
   - [ ] Go to Project → Auth → Messaging
   - [ ] Scroll to "Notifications" section
   - [ ] Verify "Password Change Verification" section is visible

2. **Toggle OTP Requirement**
   - [ ] Toggle "Require OTP verification" checkbox
   - [ ] Click "Save Notifications"
   - [ ] Verify success message appears
   - [ ] Refresh page and verify setting persists

3. **Visual Verification**
   - [ ] Help text is clear: "When enabled, users must verify their identity..."
   - [ ] Toggle behaves like other notification toggles
   - [ ] Save button enables/disables appropriately

---

## Email Template Verification

When OTP is sent via email, verify the email contains:

- ✅ Subject: "Password Change Verification - [Project Name]"
- ✅ Greeting: "Hello [User Name]"
- ✅ 6-digit OTP code displayed prominently
- ✅ Expiration notice: "This code will expire in 10 minutes"
- ✅ Security warning: "If you didn't request this, contact support immediately"
- ✅ Professional styling with project branding

---

## SMS Template Verification

When OTP is sent via SMS, verify the message contains:

```
Hi [User Name], your password change code is: [OTP]. Valid for 10 minutes. 
If you didn't request this, contact support immediately. - [Project Name]
```

---

## Database Verification

Check that OTP records are created and updated correctly:

```sql
-- Check auth settings
SELECT project_id, require_otp_for_password_change 
FROM skaftin_system_auth_settings;

-- Check OTP records (replace schema_name with your project schema)
SELECT user_id, otp_method, purpose, status, expires_at, attempts, created_at
FROM [schema_name].skaftin_system_otp_verifications
WHERE purpose = 'password_change'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**:
- OTP records created with `purpose = 'password_change'`
- Status changes: `pending` → `verified` (on success)
- Status changes: `pending` → `expired` (on timeout or max attempts)
- Metadata contains encrypted new password temporarily

---

## Session Continuity Test

After password change (with or without OTP):

1. **Verify session remains valid**
   ```bash
   # After changing password, verify current session still works
   curl -X POST http://localhost:4005/api/app-auth/auth/verify \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

2. **Expected**: `200 OK` - User is still logged in

---

## API Endpoints Reference

### POST `/api/app-auth/auth/change-password-request`
**Authentication**: Required (Bearer token or session)

**Request Body**:
```json
{
  "old_password": "string",
  "new_password": "string",
  "otp_method": "email" | "sms" (optional, defaults to "email")
}
```

**Response (No OTP)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (With OTP)**:
```json
{
  "success": true,
  "message": "A verification code has been sent to your email",
  "data": {
    "requires_otp": true,
    "otp_method": "email",
    "destination": "us***@example.com"
  }
}
```

### POST `/api/app-auth/auth/verify-password-change-otp`
**Authentication**: Required (Bearer token or session)

**Request Body**:
```json
{
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "message": "Your password has been changed successfully. You can continue using your current session."
  }
}
```

---

## Troubleshooting

### Issue: "Email provider not configured"
**Solution**: Configure email provider in Project → Communications → Email

### Issue: "SMS provider not configured"
**Solution**: Configure SMS provider in Project → Communications → SMS

### Issue: "Phone number not available"
**Solution**: User must have phone number in profile to use SMS OTP

### Issue: OTP not received
**Solution**: 
1. Check email/SMS provider configuration
2. Check spam folder (for email)
3. Check provider logs in Communications tab

### Issue: "No pending password change OTP found"
**Solution**: OTP may have expired or already been used. Request new password change.

---

## Success Criteria

✅ All test scenarios pass  
✅ Email templates look professional  
✅ SMS messages are clear and concise  
✅ Security validations work correctly  
✅ Frontend toggle works and persists  
✅ Database records are created correctly  
✅ Sessions remain valid after password change  
✅ No console errors in backend or frontend  
✅ Linting passes with no errors  

---

## Notes

- Password changes are immediate when OTP is disabled
- OTP codes expire in 10 minutes
- Maximum 3 OTP verification attempts
- Old sessions remain valid after password change
- SuperTokens handles password hashing automatically
- Project-scoped emails ensure multi-tenancy support

