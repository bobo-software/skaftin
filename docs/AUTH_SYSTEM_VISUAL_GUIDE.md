# 🎨 Authentication System - Visual Guide

## Complete Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SKAFTIN AUTHENTICATION SYSTEM                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PLATFORM AUTHENTICATION (Your App ↔ Skaftin)             │
└─────────────────────────────────────────────────────────────────────┘

    Your Mobile/Web App
           ↓
    [x-api-key: sk_...]  or  [x-access-token: sat_...]
           ↓
    Skaftin Platform
           ↓
    Project Identified → Routes to Project Database


┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: APP USER AUTHENTICATION (Your Users ↔ Your App)          │
└─────────────────────────────────────────────────────────────────────┘

    End User (John Doe)
           ↓
    [email + password]
           ↓
    Your App → Skaftin App-Auth API
           ↓
    SuperTokens (project-scoped: project_1_john@example.com)
           ↓
    Session Token → Your App
           ↓
    User Authenticated ✅
```

---

## User Types & Isolation

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER TYPES                                │
└──────────────────────────────────────────────────────────────────┘

1. PLATFORM ADMIN (You)
   ├─ Email: admin@yourcompany.com
   ├─ SuperTokens: admin@yourcompany.com (no prefix)
   ├─ Access: Skaftin Dashboard (localhost:3005)
   ├─ Database: skaftin_system_users (main)
   └─ Purpose: Manage projects, settings, users

2. APP USER - PROJECT 1 (Your Customer)
   ├─ Email: john@example.com
   ├─ SuperTokens: project_1_john@example.com (prefixed)
   ├─ Access: Your Mobile/Web App
   ├─ Database: project_1.skaftin_system_users
   └─ Purpose: Use your application

3. APP USER - PROJECT 2 (Same Email, Different Project)
   ├─ Email: john@example.com (SAME EMAIL!)
   ├─ SuperTokens: project_2_john@example.com (different prefix)
   ├─ Access: Different App Instance
   ├─ Database: project_2.skaftin_system_users
   └─ Purpose: Use different application

✅ COMPLETE ISOLATION - Same email can exist in all three contexts!
```

---

## Forgot Password Flow (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FORGOT PASSWORD FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: REQUEST OTP
─────────────────────────────────────────
User                    Your App                    Skaftin
  │                        │                           │
  │  "Forgot Password"     │                           │
  ├───────────────────────>│                           │
  │                        │  POST /forgot-password    │
  │                        │  {email, method}          │
  │                        ├──────────────────────────>│
  │                        │                           │
  │                        │  ┌─────────────────────┐ │
  │                        │  │ 1. Find user        │ │
  │                        │  │ 2. Generate OTP     │ │
  │                        │  │ 3. Store in DB      │ │
  │                        │  │ 4. Send via email   │ │
  │                        │  └─────────────────────┘ │
  │                        │                           │
  │                        │  Success + masked email   │
  │                        │<──────────────────────────┤
  │  "Check your email"    │                           │
  │<───────────────────────┤                           │
  │                        │                           │
  
  📧 Email arrives: "Your code is: 123456"


STEP 2: VERIFY OTP
─────────────────────────────────────────
User                    Your App                    Skaftin
  │                        │                           │
  │  Enters: "123456"      │                           │
  ├───────────────────────>│                           │
  │                        │  POST /verify-otp         │
  │                        │  {email, code}            │
  │                        ├──────────────────────────>│
  │                        │                           │
  │                        │  ┌─────────────────────┐ │
  │                        │  │ 1. Validate OTP     │ │
  │                        │  │ 2. Check expiry     │ │
  │                        │  │ 3. Check attempts   │ │
  │                        │  │ 4. Mark verified    │ │
  │                        │  │ 5. Generate token   │ │
  │                        │  └─────────────────────┘ │
  │                        │                           │
  │                        │  Success + reset_token    │
  │                        │<──────────────────────────┤
  │  "Enter new password"  │                           │
  │<───────────────────────┤                           │
  │                        │                           │


STEP 3: RESET PASSWORD
─────────────────────────────────────────
User                    Your App                    Skaftin
  │                        │                           │
  │  "NewPassword123!"     │                           │
  ├───────────────────────>│                           │
  │                        │  POST /reset-password     │
  │                        │  {email, token, password} │
  │                        ├──────────────────────────>│
  │                        │                           │
  │                        │  ┌─────────────────────┐ │
  │                        │  │ 1. Validate token   │ │
  │                        │  │ 2. Check expiry     │ │
  │                        │  │ 3. Delete old ST    │ │
  │                        │  │ 4. Create new ST    │ │
  │                        │  │ 5. Update password  │ │
  │                        │  │ 6. Sync DB          │ │
  │                        │  │ 7. Clear token      │ │
  │                        │  └─────────────────────┘ │
  │                        │                           │
  │                        │  Success                  │
  │                        │<──────────────────────────┤
  │  "Password reset!"     │                           │
  │  → Redirect to login   │                           │
  │<───────────────────────┤                           │
  │                        │                           │

✅ User can now login with new password!
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE                                 │
└─────────────────────────────────────────────────────────────────────┘

OTP Record (project_1.skaftin_system_otp_verifications)
┌─────────────────────────────────────────────────────────┐
│ user_id: 123                                            │
│ otp_code: "123456"                                      │
│ otp_method: "email"                                     │
│ destination: "user@example.com"                         │
│ purpose: "password_reset"  ← Distinguishes from reg    │
│ status: "pending" → "verified" → "expired"              │
│ expires_at: 2025-12-03 11:05:00 (10 min)               │
│ attempts: 0 → 1 → 2 (max 3)                            │
└─────────────────────────────────────────────────────────┘

User Metadata (project_1.skaftin_system_users)
┌─────────────────────────────────────────────────────────┐
│ id: 123                                                 │
│ email: "user@example.com"                               │
│ supertokens_user_id: "project_1_user@example.com"      │
│ metadata: {                                             │
│   "password_reset_token": "a1b2c3...",                  │
│   "password_reset_expires_at": "2025-12-03 11:10:00"   │
│ }                                                       │
└─────────────────────────────────────────────────────────┘

SuperTokens User
┌─────────────────────────────────────────────────────────┐
│ user_id: "uuid-here"                                    │
│ email: "project_1_user@example.com"  ← Project scoped  │
│ password_hash: "bcrypt_hash..."                         │
└─────────────────────────────────────────────────────────┘
```

---

## Security Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SECURITY TIMELINE                               │
└─────────────────────────────────────────────────────────────────────┘

T=0min    │ User requests OTP
          │ ✅ OTP generated and sent
          │
T=5min    │ User enters OTP
          │ ✅ OTP verified, reset token generated
          │
T=10min   │ ⚠️  OTP expires (can't verify anymore)
          │ Reset token still valid
          │
T=15min   │ User submits new password
          │ ✅ Password reset successful
          │
T=20min   │ ⚠️  Reset token would expire
          │ (But already used and cleared)
          │
T=30min   │ All OTPs marked as expired (cleanup)
          │

KEY POINTS:
- OTP valid: 10 minutes
- Reset token valid: 15 minutes
- Both are one-time use
- Automatic cleanup on success
```

---

## Method Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EMAIL vs SMS DELIVERY                             │
└─────────────────────────────────────────────────────────────────────┘

EMAIL METHOD                          SMS METHOD
─────────────────────────────────    ─────────────────────────────────
✅ Free (SMTP)                        💰 Cost per SMS
✅ Professional templates             ✅ Instant delivery
✅ HTML formatting                    ✅ Works offline
⚠️  May go to spam                    ✅ High open rate
⚠️  1-5 minute delay                  ✅ No spam folder
✅ No phone number required           ⚠️  Phone number required
✅ Works internationally              ⚠️  International rates vary

RECOMMENDATION: Offer both, let user choose!
```

---

## React Component Flow

```typescript
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPONENT STATE FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

const [step, setStep] = useState(1);
const [email, setEmail] = useState('');
const [code, setCode] = useState('');
const [resetToken, setResetToken] = useState('');
const [newPassword, setNewPassword] = useState('');

┌─────────────┐
│   STEP 1    │  Email Input
│ Request OTP │  → sendForgotPasswordOTP()
└──────┬──────┘  → setStep(2)
       │
       ↓
┌─────────────┐
│   STEP 2    │  Code Input
│ Verify OTP  │  → verifyForgotPasswordOTP()
└──────┬──────┘  → setResetToken(token)
       │          → setStep(3)
       ↓
┌─────────────┐
│   STEP 3    │  Password Input
│Reset Password│ → resetPassword()
└──────┬──────┘  → Redirect to login
       │
       ↓
┌─────────────┐
│   SUCCESS   │  Confirmation
│  Redirect   │  → Navigate to /login
└─────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING                                  │
└─────────────────────────────────────────────────────────────────────┘

Send OTP
  ├─ Email not found → Generic success (security)
  ├─ Email provider not configured → Show error, contact admin
  ├─ SMS requested but no phone → Show error, use email
  └─ Network error → Show error, retry

Verify OTP
  ├─ Invalid code → Show remaining attempts (3, 2, 1)
  ├─ Max attempts → Request new OTP (go back to step 1)
  ├─ Expired → Request new OTP (go back to step 1)
  └─ Network error → Retry

Reset Password
  ├─ Invalid token → Start over (go back to step 1)
  ├─ Expired token → Start over (go back to step 1)
  ├─ Password too short → Show requirements (min 8 chars)
  ├─ SuperTokens error → Show error, contact support
  └─ Network error → Retry
```

---

## Database Tables Involved

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                                 │
└─────────────────────────────────────────────────────────────────────┘

skaftin_system_projects
├─ id: 1
├─ schema_name: "project_1"
└─ name: "My App"

project_1.skaftin_system_users (App Users)
├─ id: 123
├─ email: "user@example.com"
├─ supertokens_user_id: "uuid..."
├─ phone: "+1234567890"
├─ is_active: true
└─ metadata: { password_reset_token, password_reset_expires_at }

project_1.skaftin_system_otp_verifications
├─ id: 456
├─ user_id: 123 (FK to users)
├─ otp_code: "123456"
├─ otp_method: "email" | "sms"
├─ purpose: "registration" | "password_reset"  ← NEW!
├─ status: "pending" | "verified" | "expired" | "failed"
├─ expires_at: timestamp
└─ attempts: 0-3

SuperTokens Core (External)
├─ user_id: "uuid..."
├─ email: "project_1_user@example.com"  ← Project scoped!
└─ password_hash: "bcrypt..."
```

---

## API Route Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                      API ROUTES                                      │
└─────────────────────────────────────────────────────────────────────┘

/api/auth/*                          Platform Admin Routes
├─ POST /login                       Platform admin login
├─ POST /register                    Platform admin registration
└─ GET /:projectId/users             Manage app users (admin)

/app-api/auth/auth/*                 App User Public Routes (No Auth)
├─ POST /register                    App user registration
├─ POST /login                       App user login
├─ POST /verify-otp                  Verify registration OTP
├─ POST /forgot-password             Send password reset OTP ⭐ NEW
├─ POST /verify-forgot-password-otp  Verify password reset OTP ⭐ NEW
└─ POST /reset-password              Reset password ⭐ NEW

/app-api/auth/users/*                App User Management (Auth Required)
├─ GET /                             List users
├─ GET /:userId                      Get user details
├─ PUT /:userId                      Update user
└─ DELETE /:userId                   Delete user
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                                   │
└─────────────────────────────────────────────────────────────────────┘

LAYER 1: PROJECT ISOLATION
├─ Each project has separate schema
├─ Users cannot access other projects
└─ SuperTokens emails are project-prefixed

LAYER 2: OTP SECURITY
├─ 6-digit random codes (100,000 - 999,999)
├─ 10-minute expiration
├─ Max 3 verification attempts
├─ One-time use (invalidated after verification)
└─ Purpose-specific (registration vs password reset)

LAYER 3: RESET TOKEN SECURITY
├─ 32-byte cryptographically secure token
├─ 15-minute expiration
├─ Single use (cleared after password reset)
├─ Stored in user metadata (not exposed)
└─ Validated before password update

LAYER 4: PASSWORD SECURITY
├─ Minimum 8 characters enforced
├─ SuperTokens password management
├─ Bcrypt hashing (automatic)
├─ No plaintext storage
└─ Password history (future enhancement)

LAYER 5: PRIVACY
├─ No user enumeration (same response for non-existent emails)
├─ Masked email addresses (us***@example.com)
├─ Masked phone numbers (072***45)
└─ Secure logging (no sensitive data)
```

---

## SuperTokens User Sync

```
┌─────────────────────────────────────────────────────────────────────┐
│              SUPERTOKENS USER SYNCHRONIZATION                        │
└─────────────────────────────────────────────────────────────────────┘

SCENARIO 1: New User Registration
  Database User Created
         ↓
  SuperTokens User Created (project_1_email@example.com)
         ↓
  Database Updated with supertokens_user_id
         ↓
  ✅ Synced

SCENARIO 2: Password Reset (User Has SuperTokens ID)
  Old SuperTokens User Deleted
         ↓
  New SuperTokens User Created with new password
         ↓
  Database Updated with new supertokens_user_id
         ↓
  ✅ Synced

SCENARIO 3: Password Reset (User Missing SuperTokens ID)
  SuperTokens User Created with new password
         ↓
  Database Updated with supertokens_user_id
         ↓
  ✅ Synced

SCENARIO 4: Login (First Time or ID Mismatch)
  Login Successful → Returns actual SuperTokens user ID
         ↓
  Compare with database supertokens_user_id
         ↓
  If mismatch → Update database with correct ID
         ↓
  ✅ Synced

RESULT: Database and SuperTokens always in sync! ✅
```

---

## Complete Feature Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FEATURES                           │
└─────────────────────────────────────────────────────────────────────┘

FEATURE                          PLATFORM ADMIN    APP USER
─────────────────────────────────────────────────────────────────────
Registration                            ✅            ✅
Login                                   ✅            ✅
Logout                                  ✅            ✅
Session Management                      ✅            ✅
Email/Password Auth                     ✅            ✅
Phone Login                             ❌            ✅
Custom Field Login                      ❌            ✅
OTP Verification (Registration)         ❌            ✅
Forgot Password                         ❌            ✅ NEW
Password Reset via OTP                  ❌            ✅ NEW
SMS OTP                                 ❌            ✅ NEW
Role-Based Access                       ❌            ✅
Custom User Fields                      ❌            ✅
Organization Context                    ❌            ✅
Multi-Project Support                   ✅            ✅
SuperTokens Integration                 ✅            ✅
API Key Authentication                  ✅            ✅
JWT Token Authentication                ❌            ✅
```

---

## Quick Troubleshooting

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMMON ISSUES                                     │
└─────────────────────────────────────────────────────────────────────┘

ISSUE: "User authentication mismatch"
├─ CAUSE: SuperTokens user ID doesn't match database
├─ FIX: Password reset now handles this automatically
└─ ACTION: Run forgot password flow again

ISSUE: "Multiple session cookies"
├─ CAUSE: Old cookies from previous configuration
├─ FIX: Clear browser cookies
└─ ACTION: DevTools → Application → Cookies → Delete all

ISSUE: "Email provider not configured"
├─ CAUSE: No active email provider
├─ FIX: Configure email provider in settings
└─ ACTION: Settings → Communications → Email Providers

ISSUE: "Column does not exist"
├─ CAUSE: Missing custom field columns
├─ FIX: Applied migration 0014
└─ ACTION: Already fixed! ✅

ISSUE: "OTP not received"
├─ CAUSE: Email in spam or SMTP issue
├─ FIX: Check spam folder, verify SMTP config
└─ ACTION: Test email provider with actual send
```

---

## Testing Checklist

```
FORGOT PASSWORD FLOW
├─ [ ] Send OTP via email
├─ [ ] Send OTP via SMS
├─ [ ] Verify valid OTP
├─ [ ] Verify invalid OTP (check attempts)
├─ [ ] Verify expired OTP
├─ [ ] Reset password with valid token
├─ [ ] Reset password with expired token
├─ [ ] Login with new password
└─ [ ] Verify SuperTokens user synced

EDGE CASES
├─ [ ] Non-existent email (no enumeration)
├─ [ ] Missing phone for SMS
├─ [ ] Missing SuperTokens user ID
├─ [ ] Orphaned SuperTokens user ID
├─ [ ] Duplicate SuperTokens users
├─ [ ] Password too short
└─ [ ] Max OTP attempts exceeded

EMAIL TESTING
├─ [ ] Test email provider with address
├─ [ ] Verify email received
└─ [ ] Check email formatting
```

---

## Documentation Map

```
START HERE
    ↓
docs/client-sdk/08-FORGOT-PASSWORD.md (Client implementation)
    ↓
docs/FORGOT_PASSWORD_FEATURE.md (Complete backend details)
    ↓
docs/FORGOT_PASSWORD_SMS_SUPPORT.md (SMS implementation)
    ↓
docs/AUTH_IMPROVEMENTS_DEC_2025.md (All improvements)
    ↓
docs/SUPERTOKENS_COOKIE_FIX.md (Troubleshooting)
    ↓
TODAYS_WORK_SUMMARY.md (Complete summary)
```

---

**Quick Reference:** This document  
**Complete Guide:** `FORGOT_PASSWORD_FEATURE.md`  
**Client SDK:** `client-sdk/08-FORGOT-PASSWORD.md`  
**All Improvements:** `AUTH_IMPROVEMENTS_DEC_2025.md`

---

**Last Updated:** December 3, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.1.0

