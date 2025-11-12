# Email Toggles - Quick Start Guide

✅ **Email notification toggles are now active!**

---

## 🎯 What You Have Now

Four new email toggles in **Auth Settings → Email** tab:

1. **📧 Send Registration Email** - OTP code on signup (Default: OFF)
2. **✉️ Send Verification Email** - Email verification link (Default: OFF)
3. **🔐 Send Password Reset Email** - Password reset link (Default: ON)
4. **🎉 Send Welcome Email** - Welcome message (Default: OFF)

---

## 🚀 Quick Start

### Step 1: View Your Current Settings

```sql
Project 2 (Bee Roll):
- Auth: ✅ Enabled
- Registration: ✅ Enabled
- Email Provider: ❌ Not configured
- Registration Email: ❌ OFF
- Verification Email: ❌ OFF
- Password Reset Email: ✅ ON
- Welcome Email: ❌ OFF

Project 3 (Bee Maker):
- Auth: ✅ Enabled
- Registration: ✅ Enabled
- Email Provider: ✅ Provider #2
- Registration Email: ❌ OFF
- Verification Email: ❌ OFF
- Password Reset Email: ✅ ON
- Welcome Email: ❌ OFF
```

### Step 2: Enable Email Toggles

**Via UI:**
1. Go to: **Auth → Email Settings**
2. Scroll to "Email Notifications" section
3. Toggle the emails you want to send
4. Click **"Save Email Settings"**

**Via API:**
```bash
curl -X PUT http://localhost:4006/api/app-auth/2/settings \
  -H "Cookie: sAccessToken=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "send_registration_email": true,
    "send_verification_email": true,
    "send_welcome_email": true
  }'
```

### Step 3: Test Registration with Emails

**Enable Project 3's emails** (it has an email provider):
```bash
curl -X PUT http://localhost:4006/api/app-auth/3/settings \
  -H "Cookie: sAccessToken=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "send_registration_email": true,
    "send_welcome_email": true
  }'
```

**Register a test user:**
```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-access-token: sat_755b67f8e434bb9f..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User 2",
    "email": "test2@example.com",
    "password": "Secure123!"
  }'
```

**Check your email** - you should receive:
- ✅ Registration email with OTP
- ✅ Welcome email

---

## 🎨 Email Templates Included

All emails are professionally designed with HTML + plain text versions:

### 1. Registration Email
```
Subject: Welcome to [Project Name]!

Hi [User Name],

Welcome to [Project Name]!

Your OTP code: 123456

This code will expire in 10 minutes.

Best regards,
The [Project Name] Team
```

### 2. Verification Email
```
Subject: Verify your email address - [Project Name]

Hi [User Name],

Please verify your email by clicking the link:
[Verification Link]

This link expires in 24 hours.

Best regards,
The [Project Name] Team
```

### 3. Password Reset Email
```
Subject: Password Reset Request - [Project Name]

Hi [User Name],

Click the link below to reset your password:
[Reset Link]

This link expires in 1 hour.

If you didn't request this, ignore this email.

Best regards,
The [Project Name] Team
```

### 4. Welcome Email
```
Subject: Welcome to [Project Name]! 🎉

Hi [User Name],

Welcome to [Project Name]!

We're excited to have you on board.

Get started by exploring your dashboard.

Best regards,
The [Project Name] Team
```

---

## 🔐 Security Features

### Toggle Checks

**If toggle is OFF:**
```json
{
  "success": false,
  "message": "Email verification is not enabled for this project. Enable it in Auth Settings.",
  "statusCode": 403
}
```

**If email provider missing:**
```json
{
  "success": false,
  "message": "Email provider not configured. Please configure an email provider first.",
  "statusCode": 400
}
```

### Email Failures Don't Block Registration

- ✅ User is created
- ✅ JWT token returned
- ⚠️ Email errors logged
- 💡 Admin can resend manually

---

## 💡 Common Scenarios

### Scenario 1: Development (No Emails)
```typescript
// All toggles OFF
send_registration_email: false
send_verification_email: false
send_password_reset_email: false
send_welcome_email: false

// Result: Fast registration, no email delays
```

### Scenario 2: Production (Full Email Experience)
```typescript
// All toggles ON
send_registration_email: true
send_verification_email: true
send_password_reset_email: true
send_welcome_email: true
email_provider_id: 5

// Result: Users get complete email experience
```

### Scenario 3: Verify Emails Only
```typescript
// Only verification
send_registration_email: false
send_verification_email: true    // ← Only this
send_password_reset_email: true
send_welcome_email: false

// Result: Users must verify email before using app
```

---

## 🧪 Testing Checklist

- [ ] Enable registration email toggle
- [ ] Register a user
- [ ] Check inbox for registration email with OTP
- [ ] Enable verification email toggle
- [ ] Manually send verification email via UI
- [ ] Check inbox for verification link
- [ ] Enable password reset toggle
- [ ] Request password reset
- [ ] Check inbox for reset link
- [ ] Enable welcome email toggle
- [ ] Register another user
- [ ] Check inbox for welcome email
- [ ] Disable all toggles
- [ ] Try manual sends - should get 403 errors
- [ ] Test email provider still works

---

## 📞 Quick Actions

### Enable All Emails for Testing

```bash
# Use Project 3 (has email provider)
curl -X PUT http://localhost:4006/api/app-auth/3/settings \
  -H "Cookie: sAccessToken=$(cat cookies.txt)" \
  -H "Content-Type: application/json" \
  -d '{
    "send_registration_email": true,
    "send_verification_email": true,
    "send_password_reset_email": true,
    "send_welcome_email": true
  }'
```

### Test Registration with All Emails

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-access-token: sat_755b67f8e434bb9f4f1c2d27950c0b71b5e1a5ab06fbaeac8e7d0a46b3cf90c6663c6e15cd4b4f99" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full Email Test",
    "email": "emailtest@example.com",
    "password": "Test123!"
  }'
```

Check console logs for:
```
✅ App user registered: emailtest@example.com (Project: 3)
📧 Sending registration email to emailtest@example.com...
   └─ ✅ Registration email sent
📧 Sending verification email to emailtest@example.com...
   └─ ✅ Verification email sent
📧 Sending welcome email to emailtest@example.com...
   └─ ✅ Welcome email sent
```

---

## ✨ Summary

**You now have:**
- ✅ 4 email notification toggles
- ✅ UI controls in Auth Email Settings
- ✅ API endpoints with toggle validation
- ✅ MCP tool support
- ✅ Professional email templates
- ✅ Test email functionality (was TODO - now implemented!)
- ✅ Full verification/reset email flows (was TODO - now implemented!)

**Next Steps:**
1. Configure an email provider for Project 2 (if needed)
2. Enable desired email toggles via UI
3. Test registration flow
4. Check email inbox
5. Adjust toggles as needed

**All features are live and ready to use!** 🎉

