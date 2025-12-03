# 🔐 Forgot Password Flow - Client SDK Guide

## Quick Start

The forgot password feature provides a secure, 3-step OTP-based password reset flow for your application users. This is completely separate from platform admin authentication.

**Flow:**
1. **Send OTP** → User enters email, receives OTP code (via email or SMS)
2. **Verify OTP** → User enters code, receives reset token (15 min expiry)
3. **Reset Password** → User enters new password

**Security Features:**
- ✅ Project-scoped: App users isolated from platform admins
- ✅ OTP expiration: 10 minutes
- ✅ Max 3 verification attempts
- ✅ Reset token expiration: 15 minutes
- ✅ One-time use OTPs and tokens
- ✅ Automatic SuperTokens user sync

---

## Step-by-Step Implementation

### Step 1: Send OTP

Request an OTP code to be sent to the user's email or phone:

```typescript
import AuthService from '@/services/AuthService';

const result = await AuthService.sendForgotPasswordOTP(
  'user@example.com',
  {
    projectId: 123,
    apiKey: 'your-api-key',
    method: 'email' // or 'sms'
  }
);

if (result.success) {
  // OTP sent successfully
  console.log(result.message); // "OTP sent successfully via email"
  console.log(result.data.destination); // "us***@example.com" (masked)
} else {
  // Handle error
  console.error(result.error);
}
```

**Parameters:**
- `email` (required): User's email address (app user, not platform admin)
- `options.projectId` (optional): Project ID (not needed if using x-api-key)
- `options.apiKey` (required): API key for project authentication
- `options.method` (optional): `'email'` or `'sms'` (default: `'email'`)

**Important:** This endpoint looks up users in your project's app user table (`skaftin_system_users`), NOT platform admin users. The same email can exist as both a platform admin and an app user.

---

### Step 2: Verify OTP

Verify the OTP code entered by the user:

```typescript
const result = await AuthService.verifyForgotPasswordOTP(
  'user@example.com',
  '123456', // OTP code from user
  {
    projectId: 123,
    apiKey: 'your-api-key'
  }
);

if (result.success) {
  // OTP verified, get reset token
  const resetToken = result.data.reset_token;
  const expiresInMinutes = result.data.expires_in_minutes; // 15
  
  // Store reset token for next step
  sessionStorage.setItem('reset_token', resetToken);
  
  // Proceed to password reset step
} else {
  // Handle error (invalid code, expired, max attempts, etc.)
  console.error(result.error);
}
```

**Parameters:**
- `email` (required): User's email address
- `code` (required): 6-digit OTP code
- `options.projectId` (optional): Project ID
- `options.apiKey` (optional): API key

**Response:**
- `reset_token`: Token for password reset (valid for 15 minutes)
- `expires_in_minutes`: Token expiration time

---

### Step 3: Reset Password

Reset the password using the reset token:

```typescript
const resetToken = sessionStorage.getItem('reset_token');

const result = await AuthService.resetPassword(
  'user@example.com',
  resetToken,
  'NewSecurePassword123!', // New password from user
  {
    projectId: 123,
    apiKey: 'your-api-key'
  }
);

if (result.success) {
  // Password reset successful
  console.log(result.message); // "Password reset successfully"
  
  // Clear reset token
  sessionStorage.removeItem('reset_token');
  
  // Redirect to login
  window.location.href = '/login';
} else {
  // Handle error
  console.error(result.error);
}
```

**Parameters:**
- `email` (required): User's email address
- `resetToken` (required): Token from step 2
- `newPassword` (required): New password (min 8 characters)
- `options.projectId` (optional): Project ID
- `options.apiKey` (optional): API key

---

## Complete React Example

### ForgotPasswordPage.tsx

```typescript
import React, { useState } from 'react';
import AuthService from '@/services/AuthService';

enum Step {
  REQUEST_OTP = 1,
  VERIFY_OTP = 2,
  RESET_PASSWORD = 3,
  SUCCESS = 4
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>(Step.REQUEST_OTP);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const projectId = 123; // Your project ID
  const apiKey = 'your-api-key';

  // Step 1: Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await AuthService.sendForgotPasswordOTP(email, {
      projectId,
      apiKey,
      method: 'email'
    });

    setLoading(false);

    if (result.success) {
      setStep(Step.VERIFY_OTP);
    } else {
      setError(result.error || 'Failed to send OTP');
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await AuthService.verifyForgotPasswordOTP(
      email,
      otpCode,
      { projectId, apiKey }
    );

    setLoading(false);

    if (result.success) {
      setResetToken(result.data.reset_token);
      setStep(Step.RESET_PASSWORD);
    } else {
      setError(result.error || 'Invalid OTP code');
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const result = await AuthService.resetPassword(
      email,
      resetToken,
      newPassword,
      { projectId, apiKey }
    );

    setLoading(false);

    if (result.success) {
      setStep(Step.SUCCESS);
    } else {
      setError(result.error || 'Failed to reset password');
    }
  };

  return (
    <div className="forgot-password-page">
      <h1>Reset Password</h1>
      
      {/* Progress Indicator */}
      <div className="progress">
        <div className={step >= 1 ? 'active' : ''}>1. Email</div>
        <div className={step >= 2 ? 'active' : ''}>2. Verify</div>
        <div className={step >= 3 ? 'active' : ''}>3. New Password</div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Step 1: Request OTP */}
      {step === Step.REQUEST_OTP && (
        <form onSubmit={handleSendOTP}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      )}

      {/* Step 2: Verify OTP */}
      {step === Step.VERIFY_OTP && (
        <form onSubmit={handleVerifyOTP}>
          <p>Enter the 6-digit code sent to {email}</p>
          <input
            type="text"
            placeholder="Enter OTP code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            maxLength={6}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button type="button" onClick={() => setStep(Step.REQUEST_OTP)}>
            Back
          </button>
        </form>
      )}

      {/* Step 3: Reset Password */}
      {step === Step.RESET_PASSWORD && (
        <form onSubmit={handleResetPassword}>
          <p>Enter your new password</p>
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}

      {/* Step 4: Success */}
      {step === Step.SUCCESS && (
        <div className="success">
          <h2>✅ Password Reset Successfully!</h2>
          <p>You can now log in with your new password.</p>
          <button onClick={() => window.location.href = '/login'}>
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## API Reference

### sendForgotPasswordOTP()

Sends an OTP code to the user's email or phone.

```typescript
sendForgotPasswordOTP(
  email: string,
  options?: {
    method?: 'email' | 'sms';
    projectId?: number;
    apiKey?: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  data?: {
    message: string;
    method: string;
    destination: string; // Masked
  };
  error?: string;
}>
```

---

### verifyForgotPasswordOTP()

Verifies the OTP code and returns a reset token.

```typescript
verifyForgotPasswordOTP(
  email: string,
  code: string,
  options?: {
    projectId?: number;
    apiKey?: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  data?: {
    message: string;
    reset_token: string;
    expires_in_minutes: number;
  };
  error?: string;
}>
```

---

### resetPassword()

Resets the user's password using the reset token.

```typescript
resetPassword(
  email: string,
  resetToken: string,
  newPassword: string,
  options?: {
    projectId?: number;
    apiKey?: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}>
```

---

## Error Handling

### Common Error Scenarios

```typescript
// Handle all possible errors
const result = await AuthService.verifyForgotPasswordOTP(email, code);

if (!result.success) {
  switch (result.error) {
    case 'User not found':
      showError('Account not found');
      break;
    case 'OTP code has expired. Please request a new password reset code.':
      showError('Code expired. Please request a new one.');
      setStep(Step.REQUEST_OTP);
      break;
    case 'Maximum verification attempts exceeded. Please request a new password reset code.':
      showError('Too many attempts. Please request a new code.');
      setStep(Step.REQUEST_OTP);
      break;
    default:
      if (result.error.includes('attempt(s) remaining')) {
        showError(result.error); // "Invalid OTP code. 2 attempt(s) remaining."
      } else {
        showError('Verification failed. Please try again.');
      }
  }
}
```

---

## Best Practices

### 1. Client-Side Validation

```typescript
// Validate email format
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate password strength
const isStrongPassword = (password: string) => {
  return password.length >= 8 &&
         /[A-Z]/.test(password) &&
         /[a-z]/.test(password) &&
         /[0-9]/.test(password);
};
```

### 2. OTP Input Component

```typescript
const OTPInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(val);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      onChange={handleChange}
      placeholder="000000"
      className="otp-input"
    />
  );
};
```

### 3. Countdown Timer

```typescript
const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes

useEffect(() => {
  if (step === Step.VERIFY_OTP && timeRemaining > 0) {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }
}, [step, timeRemaining]);

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Display: "Code expires in 9:45"
```

### 4. Resend OTP

```typescript
const [canResend, setCanResend] = useState(false);

useEffect(() => {
  if (step === Step.VERIFY_OTP) {
    setCanResend(false);
    const timer = setTimeout(() => setCanResend(true), 60000); // 1 minute
    return () => clearTimeout(timer);
  }
}, [step]);

const handleResendOTP = async () => {
  await handleSendOTP(new Event('submit') as any);
  setOtpCode('');
};
```

---

## Security Considerations

1. **Never log OTP codes** - Don't console.log or store OTP codes
2. **Clear sensitive data** - Clear reset tokens after use
3. **Use sessionStorage** - Don't use localStorage for reset tokens
4. **Rate limiting** - Prevent excessive OTP requests
5. **HTTPS only** - Always use HTTPS in production

---

## Troubleshooting

### OTP Not Received

```typescript
if (!result.success && result.error?.includes('Email provider not configured')) {
  showError('Email service is currently unavailable. Please contact support.');
}
```

### Reset Token Expired

```typescript
if (!result.success && result.error?.includes('Reset token has expired')) {
  showError('Your session has expired. Please start over.');
  setStep(Step.REQUEST_OTP);
  setResetToken('');
}
```

---

## Related Documentation

- [App User Authentication](./07-APP-USER-AUTHENTICATION.md)
- [Forgot Password Feature (Full)](../FORGOT_PASSWORD_FEATURE.md)
- [OTP Verification](../OTP_REGISTRATION_ENHANCEMENT_COMPLETE.md)

---

**Last Updated:** December 3, 2025  
**SDK Version:** 1.0.0

