# Client SDK Changelog

## December 3, 2025 - Authentication System Overhaul

### 🎉 New Features

#### Forgot Password Flow
Complete OTP-based password reset for app users.

**New Endpoints:**
- `POST /app-api/auth/auth/forgot-password` - Send OTP
- `POST /app-api/auth/auth/verify-forgot-password-otp` - Verify OTP
- `POST /app-api/auth/auth/reset-password` - Reset password

**Features:**
- Email and SMS OTP delivery
- 10-minute OTP expiration
- 15-minute reset token expiration
- Professional HTML email templates
- Max 3 verification attempts
- No user enumeration (security)

**Documentation:** See [`08-FORGOT-PASSWORD.md`](./08-FORGOT-PASSWORD.md)

---

#### Email Provider Testing Enhancement
Test email providers with actual email delivery.

**Changes:**
- Interactive email address prompt
- Sends real test email with provider details
- Beautiful HTML template
- Email validation

**Usage:**
```typescript
await CommunicationsService.testConnection(projectId, providerId, 'test@example.com');
```

---

### 🐛 Bug Fixes

#### Fixed: SuperTokens User ID Mismatch
- **Issue:** Login failed after password reset
- **Fix:** Automatic cleanup and sync of SuperTokens users
- **Impact:** Password reset now works reliably

#### Fixed: Email Provider Settings Empty
- **Issue:** Email providers endpoint returned empty array
- **Fix:** Updated table names to `skaftin_system_email_providers`
- **Impact:** Provider settings load correctly

#### Fixed: Custom Fields Column Missing
- **Issue:** User update failed with "column does not exist"
- **Fix:** Applied migration to add `custom_field_1` and `custom_field_2`
- **Impact:** User updates work for all projects

#### Fixed: OTP Verification Metadata Error
- **Issue:** OTP verification failed with SQL error
- **Fix:** Corrected nested `jsonb_set` operations
- **Impact:** OTP verification works correctly

#### Fixed: SuperTokens Cookie Domain Error
- **Issue:** Session refresh failed with multiple cookies error
- **Fix:** Added `OLDER_COOKIE_DOMAIN` support
- **Impact:** Users can clear old cookies and continue

---

### 📚 Documentation Updates

**New Guides:**
- `08-FORGOT-PASSWORD.md` - Complete forgot password guide
- `../FORGOT_PASSWORD_FEATURE.md` - Backend implementation details
- `../FORGOT_PASSWORD_SMS_SUPPORT.md` - SMS OTP guide
- `../SUPERTOKENS_COOKIE_FIX.md` - Cookie troubleshooting
- `../AUTH_IMPROVEMENTS_DEC_2025.md` - Complete improvement summary

**Updated Guides:**
- `07-APP-USER-AUTHENTICATION.md` - Added password reset section
- Enhanced security notes throughout

---

### 🔒 Security Enhancements

- ✅ Project isolation (app users separate from platform admins)
- ✅ No user enumeration in password reset
- ✅ Masked email/phone in responses
- ✅ Secure OTP and token management
- ✅ Automatic SuperTokens user cleanup
- ✅ Password strength validation

---

### 🚀 Breaking Changes

**None** - All changes are backward compatible.

---

### 📦 Migration Required

**Database Migrations:**
```bash
# Apply OTP purpose column
psql -U postgres -d skaftin_db -f migrations/0013_add_otp_purpose.sql

# Apply custom fields columns
psql -U postgres -d skaftin_db -f migrations/0014_add_custom_fields_columns.sql
```

---

### 🎯 Next Steps

1. Review forgot password documentation
2. Implement password reset UI in your app
3. Test email and SMS OTP delivery
4. Configure email provider if not already done

---

## Previous Releases

See individual documentation files for historical changes:
- `AUTHENTICATION_UPDATE_SUMMARY.md`
- `DOCUMENTATION_UPDATE_SUMMARY.md`

---

**For complete details, see:** [`../AUTH_IMPROVEMENTS_DEC_2025.md`](../AUTH_IMPROVEMENTS_DEC_2025.md)

