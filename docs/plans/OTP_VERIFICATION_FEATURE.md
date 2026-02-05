# OTP Verification Feature

**Date:** November 12, 2025  
**Status:** ✅ Complete

---

## 🎯 Overview

Implemented email-based OTP (One-Time Password) verification during user registration. When enabled, users must verify their email address with a 6-digit code before their account is activated.

---

## ✨ Key Features

### Smart Activation Logic

**OTP Enabled:**
1. User registers → Account created as **INACTIVE**
2. OTP sent via email (6-digit code, 10-minute expiry)
3. User enters OTP → Account **ACTIVATED**
4. Welcome email sent (if enabled)
5. User can now log in ✅

**OTP Disabled:**
1. User registers → Account created as **ACTIVE**
2. No OTP sent
3. User can log in immediately ✅

---

## 🔄 Complete Registration Flow

```
User → POST /api/app-auth/auth/register
         ↓
    Check Settings:
    ┌────────────────────────────────────┐
    │ send_registration_email = true?    │
    └────────────────────────────────────┘
         ↓                    ↓
        YES                  NO
         ↓                    ↓
    is_active = FALSE    is_active = TRUE
         ↓                    ↓
    Generate OTP          Return success
    (6-digit, 10min)          ↓
         ↓                User can login
    Send OTP email            immediately
    Store in metadata
         ↓
    Return success with:
    {
      requires_otp_verification: true,
      message: "Check your email"
    }
         ↓
    User receives email
         ↓
    User → POST /api/app-auth/auth/verify-otp
           { user_id, code }
         ↓
    Verify OTP:
    ├─ Check exists
    ├─ Check not expired
    └─ Check matches
         ↓
    ✅ OTP Valid
         ↓
    Update user:
    ├─ is_active = TRUE
    ├─ email_verified = TRUE
    └─ Remove OTP from metadata
         ↓
    Check: send_welcome_email = true?
         ↓
        YES → Send welcome email
         ↓
    Return success
         ↓
    User can now login
```

---

## 📡 API Endpoints

### 1. Register User (Updated)

```typescript
POST /api/app-auth/auth/register

Headers:
{
  "x-api-key": "sk_your_key"
}

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Secure123!",
  "phone": "+1234567890"
}

Response (OTP Enabled):
{
  "success": true,
  "message": "User registered successfully. Please check your email for the OTP code to activate your account.",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "is_active": false  // ← Inactive until OTP verified
    },
    "token": "eyJhbGc...",
    "requires_otp_verification": true,  // ← Flag indicating OTP required
    "message": "Check your email for OTP code. Your account will be activated after verification."
  }
}

Response (OTP Disabled):
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "is_active": true  // ← Active immediately
    },
    "token": "eyJhbGc...",
    "requires_otp_verification": false,
    "message": "Account is active and ready to use."
  }
}
```

### 2. Verify OTP (New Public Endpoint)

```typescript
POST /api/app-auth/auth/verify-otp

Headers:
{
  "x-api-key": "sk_your_key"
}

Body:
{
  "user_id": 123,  // Can use user_id OR email
  "code": "123456"
}

// Or using email:
{
  "email": "john@example.com",
  "code": "123456"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "message": "Your account has been activated. You can now log in.",
    "user": {
      "id": 123,
      "email": "john@example.com",
      "name": "John Doe",
      "is_active": true,
      "email_verified": true
    }
  }
}

Response (Invalid OTP):
{
  "success": false,
  "message": "Invalid OTP code. Please check the code and try again.",
  "statusCode": 400
}

Response (Expired OTP):
{
  "success": false,
  "message": "OTP code has expired. Please request a new registration or contact support.",
  "statusCode": 400
}

Response (No OTP Found):
{
  "success": false,
  "message": "No OTP found for this user. OTP may have already been verified or expired.",
  "statusCode": 400
}
```

### 3. Login (Updated Behavior)

```typescript
POST /api/app-auth/auth/login

Body:
{
  "email": "john@example.com",
  "password": "Secure123!"
}

Response (User Not Verified):
{
  "success": false,
  "message": "Account pending verification. Please verify your email with the OTP code sent to you.",
  "data": {
    "requires_otp": true,
    "user_id": 123,
    "email": "john@example.com"
  },
  "statusCode": 403
}

Response (User Inactive - Other Reason):
{
  "success": false,
  "message": "Account is inactive. Please contact support.",
  "statusCode": 403
}
```

---

## 🔐 OTP Details

### Generation
```typescript
// 6-digit random number
const otp = crypto.randomInt(100000, 999999).toString();
// Example: "123456", "789012", "456789"
```

### Storage
```typescript
// Stored in user.metadata as JSONB
{
  "otp": "123456",
  "otp_expires_at": "2025-11-12T17:10:00.000Z"  // 10 minutes from creation
}
```

### Expiration
- **Duration:** 10 minutes
- **Behavior:** OTP becomes invalid after expiration
- **Error:** "OTP code has expired"

### Cleanup
- **After Verification:** OTP and expiration removed from metadata
- **Cleanup Method:** `metadata - 'otp' - 'otp_expires_at'`

---

## 📧 Email Content

### Registration Email with OTP

```
Subject: Welcome to [Project Name]!

Hi [User Name],

Thank you for registering with [Project Name]!

Your OTP verification code is: 123456

This code will expire in 10 minutes.

Please enter this code to activate your account.

If you didn't register for an account, please ignore this email.

Best regards,
The [Project Name] Team
```

---

## 🎮 Usage Examples

### Example 1: Enable OTP Verification

```typescript
// Enable registration email toggle
PUT /api/app-auth/2/settings
{
  "send_registration_email": true,
  "email_provider_id": 5
}
```

### Example 2: Register User (OTP Required)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/register \
  -H "x-api-key: sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Secure123!"
  }'

# Response:
{
  "success": true,
  "message": "User registered successfully. Please check your email for the OTP code to activate your account.",
  "data": {
    "user": {
      "id": 124,
      "email": "john@example.com",
      "is_active": false  // ← Inactive!
    },
    "requires_otp_verification": true  // ← Must verify
  }
}
```

### Example 3: User Tries to Login (Before OTP)

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "x-api-key: sk_your_key" \
  -d '{
    "email": "john@example.com",
    "password": "Secure123!"
  }'

# Response:
{
  "success": false,
  "message": "Account pending verification. Please verify your email with the OTP code sent to you.",
  "data": {
    "requires_otp": true,
    "user_id": 124,
    "email": "john@example.com"
  },
  "statusCode": 403
}
```

### Example 4: Verify OTP

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/verify-otp \
  -H "x-api-key: sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "code": "123456"
  }'

# Response:
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "message": "Your account has been activated. You can now log in.",
    "user": {
      "id": 124,
      "email": "john@example.com",
      "name": "John Doe",
      "is_active": true,  // ← Now active!
      "email_verified": true
    }
  }
}
```

### Example 5: Login After OTP Verification

```bash
curl -X POST http://localhost:4006/api/app-auth/auth/login \
  -H "x-api-key: sk_your_key" \
  -d '{
    "email": "john@example.com",
    "password": "Secure123!"
  }'

# Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": 124, "email": "john@example.com", ... },
    "token": "eyJhbGc..."  // ← JWT token!
  }
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: OTP Enabled + Welcome Email Enabled

```typescript
Settings:
{
  send_registration_email: true,
  send_welcome_email: true,
  email_provider_id: 5
}

Flow:
1. User registers
   → Account inactive
   → OTP email sent
2. User verifies OTP
   → Account activated
   → Welcome email sent  ✅
3. User logs in
   → Success ✅
```

### Scenario 2: OTP Enabled + Welcome Email Disabled

```typescript
Settings:
{
  send_registration_email: true,
  send_welcome_email: false,
  email_provider_id: 5
}

Flow:
1. User registers
   → Account inactive
   → OTP email sent
2. User verifies OTP
   → Account activated
   → No welcome email  ❌
3. User logs in
   → Success ✅
```

### Scenario 3: OTP Disabled

```typescript
Settings:
{
  send_registration_email: false,
  send_welcome_email: true  // Sent during registration
}

Flow:
1. User registers
   → Account active immediately
   → Welcome email sent  ✅
2. User logs in
   → Success ✅
   (No OTP verification needed)
```

---

## 🔐 Security Features

### 1. OTP Expiration
- **Duration:** 10 minutes
- **Enforcement:** Checked on verification
- **User Experience:** Clear error message to request new code

### 2. OTP Cleanup
- **After Verification:** OTP removed from database
- **Prevents:** Reuse of old OTP codes
- **Security:** One-time use only

### 3. Login Protection
- **Before OTP:** Login blocked with helpful message
- **After OTP:** Login allowed
- **Error Differentiation:** Different messages for OTP pending vs other inactive reasons

### 4. Email Fallback
- **If OTP email fails:** User activated immediately (don't block registration)
- **Logging:** Email failures logged but don't return errors
- **User Experience:** Registration always succeeds

---

## 📊 Database Changes

### User Metadata Structure

**During Registration (OTP pending):**
```json
{
  "otp": "123456",
  "otp_expires_at": "2025-11-12T17:10:00.000Z",
  "department": "Engineering"  // Any custom metadata preserved
}
```

**After Verification:**
```json
{
  "department": "Engineering"  // OTP fields removed
}
```

### User Fields Updated

**On Registration (OTP enabled):**
```sql
is_active = FALSE
email_verified = FALSE
```

**After OTP Verification:**
```sql
is_active = TRUE
email_verified = TRUE
metadata = metadata - 'otp' - 'otp_expires_at'  -- Remove OTP
```

---

## 🚦 Error Handling

### Invalid OTP
```json
{
  "success": false,
  "message": "Invalid OTP code. Please check the code and try again.",
  "statusCode": 400
}
```

### Expired OTP
```json
{
  "success": false,
  "message": "OTP code has expired. Please request a new registration or contact support.",
  "statusCode": 400
}
```

### No OTP Found
```json
{
  "success": false,
  "message": "No OTP found for this user. OTP may have already been verified or expired.",
  "statusCode": 400
}
```

### Login Before Verification
```json
{
  "success": false,
  "message": "Account pending verification. Please verify your email with the OTP code sent to you.",
  "data": {
    "requires_otp": true,
    "user_id": 123,
    "email": "john@example.com"
  },
  "statusCode": 403
}
```

---

## 💻 Frontend Integration Example

### Registration Component

```typescript
const RegisterForm = () => {
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState('');

  const handleRegister = async (formData: any) => {
    const response = await AppUserAuthService.register(formData);

    if (response.success) {
      if (response.data.requires_otp_verification) {
        // OTP required - show verification modal
        setUserId(response.data.user.id);
        setUserEmail(response.data.user.email);
        setShowOTPModal(true);
        toast.info('Check your email for verification code');
      } else {
        // Account active immediately
        AppUserAuthService.storeToken(response.data.token);
        navigate('/dashboard');
        toast.success('Registration successful!');
      }
    }
  };

  return (
    <>
      <form onSubmit={handleRegister}>
        {/* Registration form fields */}
      </form>

      {showOTPModal && (
        <OTPVerificationModal
          userId={userId}
          email={userEmail}
          onSuccess={() => {
            setShowOTPModal(false);
            navigate('/login');
            toast.success('Account activated! Please log in.');
          }}
        />
      )}
    </>
  );
};
```

### OTP Verification Component

```typescript
const OTPVerificationModal = ({ userId, email, onSuccess }: Props) => {
  const [otp, setOTP] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/app-auth/auth/verify-otp', {
        method: 'POST',
        headers: {
          'x-api-key': SKAFTIN_CONFIG.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          code: otp
        })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <h2>Verify Your Email</h2>
      <p>Enter the 6-digit code sent to {email}</p>
      
      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={(e) => setOTP(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
      />

      {error && <div className="error">{error}</div>}

      <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </div>
  );
};
```

### Login Component (Updated)

```typescript
const LoginForm = () => {
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await AppUserAuthService.login({ email, password });
      
      if (response.success) {
        AppUserAuthService.storeToken(response.data.token);
        navigate('/dashboard');
      }
    } catch (error: any) {
      // Check if error is OTP verification required
      if (error.data?.requires_otp) {
        setPendingUser(error.data);
        setShowOTPModal(true);
        toast.warning('Please verify your email first');
      } else {
        toast.error(error.message);
      }
    }
  };

  return (
    <>
      <form onSubmit={handleLogin}>
        {/* Login form */}
      </form>

      {showOTPModal && pendingUser && (
        <OTPVerificationModal
          userId={pendingUser.user_id}
          email={pendingUser.email}
          onSuccess={() => {
            setShowOTPModal(false);
            toast.success('Account activated! Please log in again.');
          }}
        />
      )}
    </>
  );
};
```

---

## ⚙️ Configuration

### Enable OTP Verification

**Via UI:**
1. Go to: **Auth → Email Settings**
2. Toggle **"Send Registration Email"** ON
3. Ensure email provider is configured
4. Click "Save Email Settings"

**Via API:**
```bash
curl -X PUT http://localhost:4006/api/app-auth/2/settings \
  -H "Cookie: sAccessToken=..." \
  -d '{
    "send_registration_email": true,
    "email_provider_id": 5
  }'
```

### Optional: Enable Welcome Email After OTP

```bash
curl -X PUT http://localhost:4006/api/app-auth/2/settings \
  -H "Cookie: sAccessToken=..." \
  -d '{
    "send_registration_email": true,
    "send_welcome_email": true,
    "email_provider_id": 5
  }'
```

---

## 📋 Files Modified

### Backend:
1. ✅ `src/controllers/AppAuthController.ts`
   - Updated registration to create inactive users when OTP enabled
   - Generate and store OTP in metadata
   - Send OTP email if enabled
   - Updated response to include `requires_otp_verification` flag
   - Added public `verifyOTP` method
   - Updated login error messages for pending OTP

2. ✅ `src/controllers/AuthSettingsController.ts`
   - Kept admin `verifyOTP` endpoint (for manual verification)

3. ✅ `src/routers/AuthRouter.ts`
   - Added public routes: `/auth/verify-otp` and `/:projectId/auth/verify-otp`
   - No authentication required (uses project extractor only)

---

## 🎯 Benefits

### Security
- ✅ Verify email ownership
- ✅ Prevent fake registrations
- ✅ Time-limited codes (10min)
- ✅ One-time use only

### User Experience
- ✅ Simple 6-digit code
- ✅ Clear error messages
- ✅ Automatic cleanup after verification
- ✅ Welcome email after activation (optional)

### Flexibility
- ✅ Can be enabled/disabled per project
- ✅ No code changes needed
- ✅ Just toggle in settings
- ✅ Fallback if email fails

---

## ✅ Summary

**What Was Implemented:**

✅ **Smart User Activation**
- Inactive if OTP enabled
- Active if OTP disabled
- Email failure doesn't block registration

✅ **OTP Generation & Storage**
- 6-digit random code
- 10-minute expiration
- Stored in user metadata

✅ **Public Verification Endpoint**
- `/api/app-auth/auth/verify-otp`
- No authentication required
- Accepts user_id or email

✅ **Welcome Email Integration**
- Sent after OTP verification
- Only if toggle enabled
- Automatic timing

✅ **Login Protection**
- Blocks inactive users
- Helpful error messages
- Returns user info for OTP modal

✅ **Frontend-Ready**
- Response includes `requires_otp_verification` flag
- Error data includes user details
- Easy to integrate with UI

**The complete OTP verification flow is now live!** 🎉

---

**Last Updated:** November 12, 2025  
**Maintained by:** Skaftin Development Team

