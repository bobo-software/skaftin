# Email Flows - Final Implementation

**Date:** November 12, 2025  
**Status:** ✅ Complete

---

## 🎯 Email Types & Purpose

### 1. 📧 Registration Email (OTP)
**Purpose:** Verify email ownership during account creation  
**Trigger:** User registers + toggle enabled  
**Contains:** 6-digit OTP code (10min expiry)  
**Effect:** User created as INACTIVE until OTP verified  

### 2. 🎉 Welcome Email
**Purpose:** Greet new users after activation  
**Trigger:** After OTP verification (or immediate if OTP disabled)  
**Contains:** Welcome message, getting started info  
**Effect:** None, just a greeting  

### 3. ✉️ Verification Email
**Purpose:** Verify NEW email when user changes their email  
**Trigger:** Manual call to `/settings/send-verification` (email change scenario)  
**Contains:** Email verification link (24h expiry)  
**Effect:** Confirms ownership of new email address  

### 4. 🔐 Password Reset Email
**Purpose:** Reset forgotten password  
**Trigger:** User requests via `/settings/send-reset`  
**Contains:** Password reset link (1h expiry)  
**Effect:** Allows password reset  

---

## 🔄 Complete Flows

### Flow A: Registration WITH OTP

```
Settings:
send_registration_email = TRUE
send_welcome_email = TRUE

User → POST /auth/register
         ↓
    Create User
    ├─ is_active = FALSE ❌
    ├─ email_verified = FALSE
    └─ Store OTP in metadata
         ↓
    📧 Send Registration Email
    "Your OTP: 123456"
         ↓
    Return: {
      requires_otp_verification: true,
      user: { is_active: false }
    }
         ↓
    User checks email
    User enters OTP
         ↓
    POST /auth/verify-otp
    { code: "123456" }
         ↓
    Verify OTP ✅
         ↓
    Update User:
    ├─ is_active = TRUE ✅
    ├─ email_verified = TRUE
    └─ Remove OTP from metadata
         ↓
    📧 Send Welcome Email
    "Welcome to our platform!"
         ↓
    Return: "Account activated"
         ↓
    User can login ✅
```

### Flow B: Registration WITHOUT OTP

```
Settings:
send_registration_email = FALSE
send_welcome_email = TRUE

User → POST /auth/register
         ↓
    Create User
    ├─ is_active = TRUE ✅
    └─ email_verified = FALSE
         ↓
    📧 Send Welcome Email (immediately)
    "Welcome to our platform!"
         ↓
    Return: {
      requires_otp_verification: false,
      user: { is_active: true }
    }
         ↓
    User can login immediately ✅
```

### Flow C: Email Change (Verification Email)

```
Settings:
send_verification_email = TRUE

User → Changes email in profile
         ↓
    Admin/User → POST /settings/send-verification
    { email: "newemail@example.com" }
         ↓
    Generate verification token
         ↓
    📧 Send Verification Email
    "Click to verify: [link]"
         ↓
    Store token in metadata
         ↓
    User clicks link
         ↓
    Verify token
         ↓
    Update email_verified = TRUE
         ↓
    Email change confirmed ✅
```

### Flow D: Password Reset

```
Settings:
send_password_reset_email = TRUE

User → Forgot password
         ↓
    POST /settings/send-reset
    { email: "user@example.com" }
         ↓
    Generate reset token
         ↓
    📧 Send Password Reset Email
    "Click to reset: [link]"
         ↓
    Store token in metadata
         ↓
    User clicks link
         ↓
    User enters new password
         ↓
    Verify token + update password
         ↓
    Password changed ✅
```

---

## 📧 Email Timing Matrix

| Scenario | Registration Email | Welcome Email | Verification Email |
|----------|-------------------|---------------|-------------------|
| **Register (OTP ON)** | ✅ Immediately | ✅ After OTP verified | ❌ Not sent |
| **Register (OTP OFF)** | ❌ Not sent | ✅ Immediately | ❌ Not sent |
| **Change Email** | ❌ Not sent | ❌ Not sent | ✅ On request |
| **Forgot Password** | ❌ Not sent | ❌ Not sent | ❌ Not sent |

---

## 🎯 Key Points

### Registration Email
- ✅ Contains OTP code for account activation
- ✅ User INACTIVE until OTP verified
- ✅ Expires in 10 minutes
- ✅ Welcome email waits until after OTP

### Welcome Email
- ✅ **Sent AFTER OTP verification** (if OTP enabled)
- ✅ Sent immediately on registration (if OTP disabled)
- ✅ Never sent during email changes
- ✅ Just a greeting, no action required

### Verification Email
- ✅ **Separate from registration**
- ✅ Used when user changes their email
- ✅ Called manually via API
- ✅ Contains verification link (24h expiry)

### Password Reset Email
- ✅ Independent feature
- ✅ Contains reset link (1h expiry)
- ✅ Called when user forgot password

---

## 🧪 Test the Complete Flow

### Test 1: Registration with OTP + Welcome

```bash
# 1. Enable both toggles
curl -X PUT http://localhost:4006/api/app-auth/3/settings \
  -H "Cookie: sAccessToken=..." \
  -d '{
    "send_registration_email": true,
    "send_welcome_email": true,
    "email_provider_id": 2
  }'

# 2. Register user
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-access-token: sat_755b67f8e434bb9f..." \
  -d '{
    "name": "Test User",
    "email": "your_email@gmail.com",
    "password": "Test123!"
  }'

# Expected emails:
# 1. Registration email with OTP ✅
# (NO welcome email yet - waiting for OTP)

# 3. Verify OTP
curl -X POST http://localhost:4006/api/app-auth/auth/verify-otp \
  -H "x-access-token: sat_755b67f8e434bb9f..." \
  -d '{
    "email": "your_email@gmail.com",
    "code": "123456"  # From email
  }'

# Expected emails:
# 2. Welcome email ✅ (sent AFTER OTP verification)

# 4. Login now works!
```

### Test 2: Registration without OTP

```bash
# 1. Disable OTP, enable welcome
curl -X PUT http://localhost:4006/api/app-auth/3/settings \
  -H "Cookie: sAccessToken=..." \
  -d '{
    "send_registration_email": false,
    "send_welcome_email": true,
    "email_provider_id": 2
  }'

# 2. Register user
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-access-token: sat_755b67f8e434bb9f..." \
  -d '{
    "name": "Instant User",
    "email": "instant@example.com",
    "password": "Test123!"
  }'

# Expected:
# 1. Welcome email sent immediately ✅
# 2. User is active, can login right away ✅
```

---

## 📋 Updated Code Summary

### Registration Flow (AppAuthController.ts)
```typescript
// 1. Determine activation status
const requiresOTP = send_registration_email && email_provider_id;
const isActive = !requiresOTP;

// 2. Create user
INSERT INTO app_users (..., is_active) VALUES (..., isActive);

// 3. Send OTP email if enabled
if (send_registration_email) {
  sendOTP();
  storeOTPInMetadata();
}

// 4. Send welcome email ONLY if OTP not required
if (!requiresOTP && send_welcome_email) {
  sendWelcomeEmail();
}
```

### OTP Verification (AppAuthController.verifyOTP)
```typescript
// 1. Verify OTP code
if (otp !== code) return error;

// 2. Activate user
UPDATE app_users SET is_active = TRUE, email_verified = TRUE;

// 3. Send welcome email if enabled
if (send_welcome_email) {
  sendWelcomeEmail();  // ← Sent here after OTP!
}

// 4. Return success
```

---

## ✅ Checklist

- ✅ OTP email sent on registration (if enabled)
- ✅ User created as INACTIVE if OTP required
- ✅ User created as ACTIVE if OTP not required
- ✅ Welcome email sent AFTER OTP verification
- ✅ Welcome email sent immediately if no OTP
- ✅ Verification email is separate (for email changes)
- ✅ Save handler sends all toggle values
- ✅ UI descriptions clarified
- ✅ All flows documented

---

## 🎉 Ready to Use!

**Restart your browser** to get the updated JavaScript, then:

1. Go to **Auth → Email Settings**
2. Toggle **"Send Registration Email"** and **"Send Welcome Email"** ON
3. Click **"Save Email Settings"**
4. Watch the network tab - you should see all fields being sent
5. Settings will save correctly ✅
6. Try registering a test user
7. Verify with OTP
8. Receive welcome email!

**Everything works as requested!** 🚀

