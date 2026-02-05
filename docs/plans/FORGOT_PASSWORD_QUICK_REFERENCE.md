# 🔐 Forgot Password - Quick Reference Card

## API Endpoints

### 1️⃣ Send OTP
```http
POST /app-api/auth/auth/forgot-password
Headers: x-api-key: sk_your_key
Body: { "email": "user@example.com", "method": "email" }
```

### 2️⃣ Verify OTP
```http
POST /app-api/auth/auth/verify-forgot-password-otp
Headers: x-api-key: sk_your_key
Body: { "email": "user@example.com", "code": "123456" }
Response: { "reset_token": "...", "expires_in_minutes": 15 }
```

### 3️⃣ Reset Password
```http
POST /app-api/auth/auth/reset-password
Headers: x-api-key: sk_your_key
Body: { "email": "user@example.com", "reset_token": "...", "new_password": "NewPass123!" }
```

---

## Client SDK (TypeScript)

```typescript
import AuthService from '@/services/AuthService';

// Step 1: Send OTP
const result1 = await AuthService.sendForgotPasswordOTP(email, {
  apiKey: 'sk_your_key',
  method: 'email' // or 'sms'
});

// Step 2: Verify OTP
const result2 = await AuthService.verifyForgotPasswordOTP(email, code, {
  apiKey: 'sk_your_key'
});
const resetToken = result2.data.reset_token;

// Step 3: Reset Password
const result3 = await AuthService.resetPassword(email, resetToken, newPassword, {
  apiKey: 'sk_your_key'
});
```

---

## Security

| Feature | Value |
|---------|-------|
| OTP Expiration | 10 minutes |
| Reset Token Expiration | 15 minutes |
| Max OTP Attempts | 3 |
| Min Password Length | 8 characters |
| User Enumeration | ❌ Prevented |
| Email/Phone Masking | ✅ Enabled |

---

## Error Codes

| Code | Message | Action |
|------|---------|--------|
| 400 | Invalid OTP code | Show remaining attempts |
| 400 | OTP expired | Request new OTP |
| 400 | Max attempts exceeded | Request new OTP |
| 400 | Reset token expired | Start over from step 1 |
| 400 | Password too short | Show password requirements |
| 403 | Password reset disabled | Contact admin |
| 500 | Email provider not configured | Contact admin |

---

## Configuration

### Enable Password Reset
```sql
UPDATE skaftin_system_auth_settings 
SET enable_password_reset = true,
    email_provider_id = 1
WHERE project_id = 123;
```

### Email Provider Required
- Configure in: Settings → Communications → Email Providers
- Must be active

### SMS Provider (Optional)
- Configure in: Settings → Communications → SMS Providers
- Required only for SMS OTP

---

## Testing

### Quick Test (bash)
```bash
./test-forgot-password.sh
```

### Manual Test (curl)
```bash
# 1. Send OTP
curl -X POST http://localhost:4006/app-api/auth/auth/forgot-password \
  -H "x-api-key: sk_key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","method":"email"}'

# 2. Verify OTP
curl -X POST http://localhost:4006/app-api/auth/auth/verify-forgot-password-otp \
  -H "x-api-key: sk_key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456"}'

# 3. Reset Password
curl -X POST http://localhost:4006/app-api/auth/auth/reset-password \
  -H "x-api-key: sk_key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","reset_token":"...","new_password":"NewPass123!"}'
```

---

## Common Issues

### OTP Not Received
- Check spam folder
- Verify email provider is active
- Check SMTP credentials
- Review backend logs

### Invalid OTP
- Check code is correct (6 digits)
- Verify not expired (10 min)
- Check attempts not exceeded (max 3)

### Reset Token Invalid
- Verify token not expired (15 min)
- Check token copied correctly
- Ensure from step 2 response

### Login Fails After Reset
- Clear browser cookies
- Try forgot password flow again
- Check backend logs for SuperTokens sync

---

## Full Documentation

- **Complete Guide:** [`FORGOT_PASSWORD_FEATURE.md`](./FORGOT_PASSWORD_FEATURE.md)
- **Client SDK:** [`client-sdk/08-FORGOT-PASSWORD.md`](./client-sdk/08-FORGOT-PASSWORD.md)
- **SMS Support:** [`FORGOT_PASSWORD_SMS_SUPPORT.md`](./FORGOT_PASSWORD_SMS_SUPPORT.md)

---

**Version:** 1.0.0  
**Last Updated:** December 3, 2025  
**Status:** ✅ Production Ready

