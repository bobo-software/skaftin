# Client SDK - Account Deletion

## Overview
Allow your app users to delete their own accounts with optional OTP verification and a 7-day grace period.

---

## 🔐 API Endpoints

### Base URL
```
http://your-backend.com/app-api/auth
```

### Authentication
All endpoints require authentication:
```
Headers:
  x-api-key: YOUR_PROJECT_API_KEY
  Authorization: Bearer USER_ACCESS_TOKEN
```

---

## 📡 Endpoint 1: Request Account Deletion

### Request
```http
POST /app-api/auth/auth/request-account-deletion
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "password": "UserCurrentPassword",
  "reason": "Optional reason for deletion",
  "otp_method": "email"  // Optional: "email" or "sms"
}
```

### Response (No OTP Required)
```json
{
  "success": true,
  "message": "Account deletion scheduled",
  "data": {
    "message": "Your account will be deleted on 2025-12-10...",
    "scheduled_at": "2025-12-10T14:30:00.000Z"
  }
}
```

### Response (OTP Required)
```json
{
  "success": true,
  "message": "OTP sent successfully via email",
  "data": {
    "requires_otp": true,
    "otp_method": "email",
    "destination": "us***@example.com",
    "message": "A verification code has been sent..."
  }
}
```

### Errors
- `400` - Missing/invalid fields
- `401` - Invalid password
- `409` - Deletion already scheduled
- `500` - Provider not configured

---

## 📡 Endpoint 2: Verify Deletion OTP

### Request
```http
POST /app-api/auth/auth/verify-account-deletion-otp
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "code": "123456"
}
```

### Response
```json
{
  "success": true,
  "message": "Account deletion scheduled",
  "data": {
    "message": "Your account will be deleted on...",
    "scheduled_at": "2025-12-10T14:30:00.000Z"
  }
}
```

### Errors
- `400` - Invalid/expired OTP, max attempts exceeded
- `401` - Authentication required
- `404` - No pending OTP found

---

## 📡 Endpoint 3: Cancel Deletion

### Request
```http
POST /app-api/auth/auth/cancel-account-deletion
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "password": "UserCurrentPassword"
}
```

### Response
```json
{
  "success": true,
  "message": "Account deletion cancelled",
  "data": {
    "message": "Your account deletion has been cancelled..."
  }
}
```

### Errors
- `400` - Deletion date has passed
- `401` - Invalid password
- `404` - No deletion scheduled
- `410` - Account already deleted

---

## 💻 Implementation Examples

### React/TypeScript Example

```typescript
import { useState } from 'react';

interface AccountDeletionProps {
  accessToken: string;
  apiKey: string;
}

const AccountDeletion: React.FC<AccountDeletionProps> = ({ accessToken, apiKey }) => {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Step 1: Request deletion
  const requestDeletion = async () => {
    try {
      const response = await fetch('/app-api/auth/auth/request-account-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          password,
          reason,
          otp_method: 'email'
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      if (data.data.requires_otp) {
        // OTP required - show OTP input
        setRequiresOtp(true);
      } else {
        // Deletion scheduled immediately
        setScheduledAt(data.data.scheduled_at);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Step 2: Verify OTP (if required)
  const verifyOtp = async () => {
    try {
      const response = await fetch('/app-api/auth/auth/verify-account-deletion-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ code: otpCode })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      // Deletion scheduled after OTP verification
      setScheduledAt(data.data.scheduled_at);
      setRequiresOtp(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Cancel deletion
  const cancelDeletion = async () => {
    try {
      const response = await fetch('/app-api/auth/auth/cancel-account-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      // Deletion cancelled
      setScheduledAt(null);
      alert('Account deletion cancelled successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // UI rendering...
  if (scheduledAt) {
    return (
      <div className="deletion-scheduled">
        <h2>⚠️ Account Deletion Scheduled</h2>
        <p>Your account will be deleted on: {new Date(scheduledAt).toLocaleString()}</p>
        <button onClick={cancelDeletion}>Cancel Deletion</button>
      </div>
    );
  }

  if (requiresOtp) {
    return (
      <div className="otp-verification">
        <h2>Verify Account Deletion</h2>
        <p>Enter the code sent to your email:</p>
        <input 
          type="text" 
          value={otpCode} 
          onChange={(e) => setOtpCode(e.target.value)}
          placeholder="123456"
        />
        <button onClick={verifyOtp}>Verify & Schedule Deletion</button>
      </div>
    );
  }

  return (
    <div className="delete-account">
      <h2>Delete Account</h2>
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <textarea 
        value={reason} 
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
      />
      <button onClick={requestDeletion}>Request Account Deletion</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
};
```

### Vanilla JavaScript Example

```javascript
// Request account deletion
async function requestAccountDeletion(password, reason = '') {
  try {
    const response = await fetch('/app-api/auth/auth/request-account-deletion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        password: password,
        reason: reason,
        otp_method: 'email'
      })
    });

    const data = await response.json();

    if (data.success) {
      if (data.data.requires_otp) {
        // Show OTP input form
        showOtpForm();
      } else {
        // Deletion scheduled
        alert(`Account will be deleted on ${new Date(data.data.scheduled_at).toLocaleDateString()}`);
      }
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Verify OTP
async function verifyDeletionOtp(code) {
  const response = await fetch('/app-api/auth/auth/verify-account-deletion-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY',
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: JSON.stringify({ code })
  });

  const data = await response.json();
  
  if (data.success) {
    alert(`Deletion scheduled for ${new Date(data.data.scheduled_at).toLocaleDateString()}`);
  }
}

// Cancel deletion
async function cancelAccountDeletion(password) {
  const response = await fetch('/app-api/auth/auth/cancel-account-deletion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY',
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: JSON.stringify({ password })
  });

  const data = await response.json();
  
  if (data.success) {
    alert('Account deletion cancelled successfully!');
  }
}
```

---

## 🎨 UI/UX Best Practices

### 1. Clear Warning Messages
```
⚠️ WARNING: This action is permanent!

Your account will be deleted in 7 days. During this time:
- You can still use your account normally
- You can cancel the deletion at any time
- After 7 days, your account will be deactivated

Are you sure you want to continue?
```

### 2. Reason Collection
```
We're sorry to see you go!

Help us improve by telling us why you're leaving:
[ ] No longer need the service
[ ] Found a better alternative
[ ] Too expensive
[ ] Missing features
[ ] Other: _________________
```

### 3. Deletion Scheduled Notice
```
✅ Account Deletion Scheduled

Your account will be deleted on: December 10, 2025 at 2:00 PM

You have 7 days to change your mind. To cancel, click below:

[Cancel Account Deletion]
```

### 4. Cancellation Confirmation
```
✅ Deletion Cancelled

Your account deletion has been cancelled.
Your account will remain active.

Welcome back!
```

---

## 🔔 Notification Flow

### User Journey
1. **Request deletion**
   - User enters password
   - Optionally provides reason
   - Clicks "Delete Account"

2. **OTP verification** (if enabled)
   - OTP sent to email/SMS
   - User enters 6-digit code
   - Up to 3 attempts, 10-minute expiry

3. **Deletion scheduled**
   - Email sent confirming schedule
   - Shows countdown in UI
   - Option to cancel

4. **Grace period** (7 days)
   - User can login normally
   - Reminder emails (optional)
   - Can cancel anytime

5. **Final deletion** (Day 7 at 2 AM)
   - Account deactivated
   - Sessions revoked
   - Final email sent
   - User cannot login

---

## ⚙️ Admin Configuration

### Enable OTP Verification

**Dashboard**: Project → Auth → Messaging → Notifications

**Toggle**: "Require OTP verification for account deletion"

**When to enable**:
- High-security applications
- Financial/health apps
- Apps with sensitive data

**When to disable**:
- Low-risk applications
- Internal tools
- Testing environments

---

## 🎯 Integration Checklist

### Backend Setup
- [x] Apply migration 0017
- [x] Restart backend server
- [x] Verify cron job initialized (check logs)

### Frontend Implementation
- [ ] Create account deletion UI component
- [ ] Add "Delete Account" button to settings
- [ ] Implement OTP verification modal
- [ ] Show deletion countdown/status
- [ ] Add "Cancel Deletion" option

### Testing
- [ ] Test without OTP (immediate scheduling)
- [ ] Test with OTP (two-step flow)
- [ ] Test cancellation
- [ ] Test password validation
- [ ] Verify email notifications
- [ ] Wait for background job (or run manually)

### Production
- [ ] Configure email provider
- [ ] Decide on OTP requirement
- [ ] Test full flow in staging
- [ ] Deploy to production
- [ ] Monitor deletion logs

---

## 🚨 Important Notes

### Security
- **Always** require password verification
- **Consider** enabling OTP for sensitive data
- **Never** allow deletion without authentication
- **Log** all deletion requests for audit

### User Experience
- **Clearly warn** about permanent nature
- **Provide** grace period for cancellation
- **Send** email notifications at all steps
- **Make** cancellation easy and obvious

### Data Compliance
- Soft delete retains data for compliance
- Admin can restore if requested
- Permanent purge requires separate action
- Check your local data protection laws

---

## 📞 Support

For questions about account deletion:
- Check backend logs for detailed errors
- Verify auth settings are correct
- Ensure email/SMS provider is configured
- Test with a non-production account first

---

**Last Updated**: December 3, 2025  
**Version**: 1.0.0

