# Email Notification Toggles Feature

**Date:** November 12, 2025  
**Status:** ✅ Complete

---

## 🎯 Overview

Added granular control over authentication email notifications. Platform admins can now enable/disable specific email types for each project through toggles in the Auth Settings UI.

---

## ✨ New Features

### Four Email Notification Toggles

1. **Send Registration Email** 📧
   - Sent when: User registers via `/api/app-auth/auth/register`
   - Contains: Welcome message, OTP code, project name
   - Default: OFF

2. **Send Verification Email** ✉️
   - Sent when: User registers (if enabled) or admin manually triggers
   - Contains: Email verification link (24h expiry)
   - Default: OFF

3. **Send Password Reset Email** 🔐
   - Sent when: User requests password reset via `/api/app-auth/:projectId/settings/send-reset`
   - Contains: Password reset link (1h expiry), security notice
   - Default: ON

4. **Send Welcome Email** 🎉
   - Sent when: User completes registration
   - Contains: Welcome message, getting started information
   - Default: OFF

---

## 🗄️ Database Changes

### New Columns in `auth_settings` Table

```sql
ALTER TABLE public.auth_settings 
ADD COLUMN send_registration_email BOOLEAN DEFAULT false,
ADD COLUMN send_verification_email BOOLEAN DEFAULT false,
ADD COLUMN send_password_reset_email BOOLEAN DEFAULT true,
ADD COLUMN send_welcome_email BOOLEAN DEFAULT false;
```

**Schema:**
```sql
CREATE TABLE public.auth_settings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  
  -- Existing fields...
  auth_enabled BOOLEAN DEFAULT true,
  registration_enabled BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT false,
  enable_password_reset BOOLEAN DEFAULT true,
  email_provider_id INTEGER,
  
  -- NEW: Email notification toggles
  send_registration_email BOOLEAN DEFAULT false,
  send_verification_email BOOLEAN DEFAULT false,
  send_password_reset_email BOOLEAN DEFAULT true,
  send_welcome_email BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Backend Implementation

### AppAuthController - Registration Flow

**Updated Logic:**
```typescript
// During user registration
const emailSettings = await getEmailSettings(projectId);

// 1. Send registration email (if enabled)
if (emailSettings.send_registration_email && emailSettings.email_provider_id) {
  const otp = generateOTP();
  await emailService.sendRegistrationEmail(projectId, email, name, otp);
}

// 2. Send verification email (if enabled)
if (emailSettings.send_verification_email && emailSettings.email_provider_id) {
  const verificationToken = generateToken();
  await emailService.sendVerificationEmail(projectId, email, name, verificationToken);
  // Store token in user.metadata.verification_token
}

// 3. Send welcome email (if enabled)
if (emailSettings.send_welcome_email && emailSettings.email_provider_id) {
  await emailService.sendWelcomeEmail(projectId, email, name);
}

// Note: Email failures don't prevent registration
```

### AuthSettingsController - Manual Email Triggers

**sendVerificationEmail Endpoint:**
```typescript
POST /api/app-auth/:projectId/settings/send-verification

// Checks:
1. Is send_verification_email enabled?
2. Is email_provider_id configured?

// If disabled:
403: "Email verification is not enabled for this project. Enable it in Auth Settings."

// If no provider:
400: "Email provider not configured. Please configure an email provider first."

// If enabled:
✅ Sends verification email + stores token
```

**sendPasswordResetEmail Endpoint:**
```typescript
POST /api/app-auth/:projectId/settings/send-reset

// Checks:
1. Is send_password_reset_email enabled?
2. Is email_provider_id configured?

// If disabled:
403: "Password reset emails are not enabled for this project. Enable it in Auth Settings."

// If no provider:
400: "Email provider not configured. Please configure an email provider first."

// If enabled:
✅ Sends password reset email + stores token
```

---

## 🎨 Frontend UI Changes

### AuthEmailSettingsTab Component

**New Section: "Email Notifications"**

Located in: `frontend/src/pages/user/dashboard/auth/tabs/AuthEmailSettingsTab.tsx`

**UI Components:**
- ✅ Four toggle switches (one per email type)
- ✅ Description for each toggle
- ✅ Save button to persist changes
- ✅ Warning if email provider not configured

**Example:**
```
┌─────────────────────────────────────────────┐
│ Email Notifications                         │
├─────────────────────────────────────────────┤
│ ☐ Send Registration Email                  │
│   Send welcome email with OTP code          │
│                                             │
│ ☐ Send Verification Email                  │
│   Send email verification link              │
│                                             │
│ ☑ Send Password Reset Email                │
│   Send reset link when requested            │
│                                             │
│ ☐ Send Welcome Email                       │
│   Send welcome message after registration   │
│                                             │
│ [Save Email Settings]                       │
└─────────────────────────────────────────────┘
```

---

## 📡 API Updates

### Get Auth Settings

```typescript
GET /api/app-auth/:projectId/settings

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "project_id": 2,
    "auth_enabled": true,
    "registration_enabled": true,
    "email_provider_id": 5,
    
    // NEW: Email toggle fields
    "send_registration_email": true,
    "send_verification_email": true,
    "send_password_reset_email": true,
    "send_welcome_email": false,
    
    // ... other fields
  }
}
```

### Update Auth Settings

```typescript
PUT /api/app-auth/:projectId/settings

Body:
{
  "send_registration_email": true,
  "send_verification_email": true,
  "send_password_reset_email": true,
  "send_welcome_email": false
}

Response:
{
  "success": true,
  "message": "Auth settings updated successfully",
  "data": { /* Updated settings */ }
}
```

---

## 🛠️ MCP Tools Updated

### update_auth_settings Tool

**New Parameters:**
```json
{
  "tool": "update_auth_settings",
  "arguments": {
    "projectId": "2",
    "send_registration_email": true,
    "send_verification_email": true,
    "send_password_reset_email": true,
    "send_welcome_email": false
  }
}
```

---

## 🚦 Email Flow Logic

### User Registration Flow

```
User → POST /api/app-auth/auth/register
  ↓
Check auth_settings for project
  ↓
Create user in database
  ↓
Assign default role
  ↓
Generate JWT token
  ↓
┌──────────────────────────────────┐
│ Check Email Toggles              │
├──────────────────────────────────┤
│ ✓ send_registration_email?       │
│   → Send OTP email               │
│                                  │
│ ✓ send_verification_email?       │
│   → Send verification link       │
│   → Store token in metadata      │
│                                  │
│ ✓ send_welcome_email?            │
│   → Send welcome message         │
└──────────────────────────────────┘
  ↓
Return success + JWT token
```

### Email Failures

**Important:** Email failures do NOT prevent registration
- ✅ User is created in database
- ✅ JWT token is returned
- ⚠️ Errors logged but not returned to user
- 💡 Admin can manually resend emails later

---

## 🔐 Security Considerations

### Toggle Defaults

- **Registration Email:** OFF (contains OTP, optional feature)
- **Verification Email:** OFF (requires verification flow implementation)
- **Password Reset Email:** ON (important security feature)
- **Welcome Email:** OFF (nice-to-have, optional)

### Email Provider Required

All email toggles require `email_provider_id` to be configured:
```typescript
if (settings.send_registration_email && !settings.email_provider_id) {
  // Email won't be sent, but registration continues
  console.warn('Registration email enabled but no provider configured');
}
```

### Error Messages

**When toggle is OFF:**
```json
{
  "success": false,
  "message": "Email verification is not enabled for this project. Enable it in Auth Settings."
}
```

**When provider missing:**
```json
{
  "success": false,
  "message": "Email provider not configured. Please configure an email provider first."
}
```

---

## 📋 Use Cases

### Use Case 1: Email Verification Flow

```typescript
// 1. Enable verification email in settings
PUT /api/app-auth/2/settings
{
  "send_verification_email": true,
  "require_email_verification": true
}

// 2. User registers (verification email sent automatically)
POST /api/app-auth/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure123"
}
// → Verification email sent with token

// 3. User clicks link in email
GET /verify-email?token=abc123...

// 4. Verify token and mark email as verified
POST /api/app-auth/2/settings/verify-otp
{
  "user_id": 5,
  "code": "abc123..."
}
```

### Use Case 2: Simple Registration (No Emails)

```typescript
// Disable all email notifications
PUT /api/app-auth/2/settings
{
  "send_registration_email": false,
  "send_verification_email": false,
  "send_welcome_email": false
}

// User registration works without emails
POST /api/app-auth/auth/register
// → User created, JWT returned, no emails sent
```

### Use Case 3: Full Email Experience

```typescript
// Enable all email notifications
PUT /api/app-auth/2/settings
{
  "send_registration_email": true,
  "send_verification_email": true,
  "send_password_reset_email": true,
  "send_welcome_email": true,
  "email_provider_id": 5
}

// User registration triggers 3 emails:
1. Registration email (OTP)
2. Verification email (link)
3. Welcome email (greeting)
```

---

## 🧪 Testing

### Test Email Toggles

```bash
# 1. Enable a toggle
curl -X PUT http://localhost:4006/api/app-auth/2/settings \
  -H "Cookie: sAccessToken=..." \
  -H "Content-Type: application/json" \
  -d '{"send_registration_email": true}'

# 2. Register a user
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-api-key: sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "secure123"
  }'

# 3. Check email inbox for registration email
```

### Test Toggle OFF

```bash
# 1. Disable verification email
curl -X PUT http://localhost:4006/api/app-auth/2/settings \
  -H "Cookie: sAccessToken=..." \
  -d '{"send_verification_email": false}'

# 2. Try to send verification email
curl -X POST http://localhost:4006/api/app-auth/2/settings/send-verification \
  -H "Cookie: sAccessToken=..." \
  -d '{"email": "test@example.com"}'

# Response:
# 403: "Email verification is not enabled for this project. Enable it in Auth Settings."
```

---

## 📊 Files Modified

### Backend:
1. ✅ `src/services/DatabaseInitializer.ts`
   - Added 4 new columns to auth_settings table schema

2. ✅ `src/controllers/AppAuthController.ts`
   - Imported AuthEmailService
   - Added email sending logic to register method
   - Checks email toggles before sending

3. ✅ `src/controllers/AuthSettingsController.ts`
   - Imported AuthEmailService
   - Initialized email service
   - Updated interfaces with new fields
   - Updated updateAuthSettings to handle email toggles
   - Implemented sendVerificationEmail with toggle check
   - Implemented sendPasswordResetEmail with toggle check
   - Implemented testEmailProvider (was TODO)

4. ✅ `go-services/internal/mcp` auth tools
   - Updated update_auth_settings tool schema
   - Added email toggle parameters
   - Updated handler to process email toggles

### Frontend:
1. ✅ `frontend/src/services/AuthSettingsService.ts`
   - Updated AuthSettings interface
   - Updated UpdateAuthSettingsRequest interface
   - Added 4 new email toggle fields

2. ✅ `frontend/src/pages/user/dashboard/auth/tabs/AuthEmailSettingsTab.tsx`
   - Added "Email Notifications" section
   - Added 4 toggle switches
   - Added Save button
   - Added warning for missing email provider

### Database:
1. ✅ Migration applied to add columns
   - `send_registration_email BOOLEAN DEFAULT false`
   - `send_verification_email BOOLEAN DEFAULT false`
   - `send_password_reset_email BOOLEAN DEFAULT true`
   - `send_welcome_email BOOLEAN DEFAULT false`

---

## 🎮 How to Use

### Via UI

1. **Navigate to:** Project → Auth → Email Settings
2. **Toggle desired emails:** Click switches to enable/disable
3. **Save:** Click "Save Email Settings"
4. **Test:** Register a user and check if emails are sent

### Via API

```typescript
// Enable all emails
const response = await fetch('/api/app-auth/2/settings', {
  method: 'PUT',
  headers: {
    'Cookie': 'sAccessToken=...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    send_registration_email: true,
    send_verification_email: true,
    send_password_reset_email: true,
    send_welcome_email: true
  })
});
```

### Via MCP

```json
{
  "tool": "update_auth_settings",
  "arguments": {
    "projectId": "2",
    "send_registration_email": true,
    "send_verification_email": true,
    "send_welcome_email": true
  }
}
```

---

## 🔍 Validation Rules

### Email Provider Required

All email toggles require an email provider to be configured:

```typescript
if (send_registration_email && !email_provider_id) {
  // Emails won't be sent during registration
  // But registration will still succeed
}
```

### Toggle-Specific Checks

**Manual Email Endpoints:**
```typescript
// Verification email endpoint
if (!settings.send_verification_email) {
  return 403: "Email verification is not enabled for this project."
}

// Password reset endpoint
if (!settings.send_password_reset_email) {
  return 403: "Password reset emails are not enabled for this project."
}
```

**Automatic Emails (Registration):**
- Toggles checked silently
- Emails sent if enabled
- Failures logged but don't block registration

---

## 🎯 Benefits

### Flexibility
- ✅ Choose which emails to send
- ✅ Different configurations per project
- ✅ Easy to test with toggles

### Cost Control
- ✅ Reduce unnecessary emails
- ✅ Save on email provider costs
- ✅ Only send what's needed

### User Experience
- ✅ Avoid email spam
- ✅ Streamlined registration
- ✅ Optional features

### Developer Experience
- ✅ Test without emails
- ✅ Enable features gradually
- ✅ Quick on/off control

---

## ⚙️ Configuration Examples

### Minimal Setup (Development)
```typescript
{
  "auth_enabled": true,
  "registration_enabled": true,
  "send_registration_email": false,   // No emails
  "send_verification_email": false,
  "send_password_reset_email": false,
  "send_welcome_email": false
}
```

### Standard Setup (Production)
```typescript
{
  "auth_enabled": true,
  "registration_enabled": true,
  "send_registration_email": false,
  "send_verification_email": true,    // Verify emails
  "send_password_reset_email": true,  // Allow resets
  "send_welcome_email": true,         // Welcome users
  "email_provider_id": 5
}
```

### High Security Setup
```typescript
{
  "auth_enabled": true,
  "registration_enabled": true,
  "require_email_verification": true,  // Require verification
  "send_registration_email": true,     // Send OTP
  "send_verification_email": true,     // Send link
  "send_password_reset_email": true,   // Allow resets
  "send_welcome_email": true,          // Welcome
  "email_provider_id": 5
}
```

---

## 🐛 Bug Fixes Included

### 1. Test Email Provider
**Before:** Returned fake success (TODO comment)  
**After:** Actually sends test email with provider details

### 2. Verification Email
**Before:** Returned fake token (TODO comment)  
**After:** Sends actual verification email + stores token

### 3. Password Reset Email
**Before:** Returned fake token (TODO comment)  
**After:** Sends actual reset email + stores token

---

## 📚 Related Documentation

- `docs/AUTH_SYSTEM_IMPLEMENTATION.md` - Auth system overview
- `docs/client-sdk/07-APP-USER-AUTHENTICATION.md` - Client SDK guide
- `docs/MCP_AUTH_TOOLS_COMPLETE.md` - MCP auth tools

---

## ✅ Summary

**What Changed:**
- ✅ Added 4 new email toggle columns to database
- ✅ Updated registration flow to send emails based on toggles
- ✅ Updated verification/reset endpoints with toggle checks
- ✅ Added toggle UI in Auth Email Settings tab
- ✅ Updated MCP tools with new parameters
- ✅ Implemented test email functionality (was TODO)
- ✅ Implemented verification email sending (was TODO)
- ✅ Implemented password reset email sending (was TODO)

**Benefits:**
- 🎯 Granular control over email notifications
- 🔐 Better security with toggle-based protection
- 💰 Cost savings by disabling unnecessary emails
- 🚀 Faster testing without email delays
- 📧 Professional email templates ready to use

**Breaking Changes:**
- ⚠️ None - all toggles default to OFF (except password reset)
- ✅ Existing functionality preserved
- ✅ Backward compatible

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

