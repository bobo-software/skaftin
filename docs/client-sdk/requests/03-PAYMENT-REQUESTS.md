# Payment API Requests

This document describes how to integrate payments into your React/React Native application using the Skaftin Payment API.

## Overview

The Payment API allows you to:
- Initiate payments (once-off and subscriptions)
- Check transaction status
- Cancel subscriptions

Currently supported payment gateways:
- **PayFast** (South African payment gateway)
- Yoco, Paystack, Peach Payments, Ozow, Flutterwave (coming soon)

## Authentication

All payment endpoints require API Key authentication:

```typescript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': 'your-api-key'
}
```

## Endpoints

### 1. Initiate Payment

Start a payment and get the redirect URL.

**Endpoint:** `POST /app-api/payments/initiate`

**Request Body:**

```typescript
interface InitiatePaymentRequest {
  // Provider selection (optional - uses first active provider if not specified)
  provider_id?: number;
  provider_name?: string;
  
  // Required fields
  amount: number;           // Amount in ZAR (e.g., 99.99)
  item_name: string;        // Product/service name (max 100 chars)
  
  // Optional customer info (recommended for better conversion)
  item_description?: string;
  customer_email?: string;
  customer_name?: string;   // "First Last" format
  customer_phone?: string;
  
  // Payment type
  payment_type?: 'once_off' | 'subscription';  // Default: 'once_off'
  
  // Subscription options (only for subscription payments)
  subscription_type?: number;  // PayFast: 1=subscription, 2=tokenization
  frequency?: number;          // PayFast: 3=monthly, 4=quarterly, 5=biannual, 6=annual
  cycles?: number;             // Number of cycles (0 = infinite)
  billing_date?: number;       // Day of month (1-31)
  
  // Custom data (stored with transaction, returned in webhooks)
  metadata?: Record<string, any>;
  
  // Override URLs for this transaction
  return_url?: string;         // Where user goes after success
  cancel_url?: string;         // Where user goes if cancelled
  notify_url?: string;         // Webhook URL for payment notifications
}
```

**Response:**

```typescript
interface InitiatePaymentResponse {
  success: boolean;
  transaction_id: string;  // Your reference ID (UUID)
  payment_url: string;     // Redirect user here to complete payment
  payment_data?: object;   // Raw data sent to gateway
  error?: string;
}
```

**Example (React/React Native):**

```typescript
// React Web
const initiatePayment = async () => {
  const response = await fetch('/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      amount: 99.00,
      item_name: 'Premium Subscription',
      customer_email: 'user@example.com',
      customer_name: 'John Doe',
      payment_type: 'once_off',
      metadata: {
        user_id: '123',
        plan: 'premium'
      }
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Store transaction_id for later status checks
    localStorage.setItem('pending_transaction', result.transaction_id);
    
    // Redirect to payment page
    window.location.href = result.payment_url;
  } else {
    console.error('Payment failed:', result.error);
  }
};
```

```typescript
// React Native
import { Linking } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const initiatePayment = async () => {
  const response = await fetch('https://your-backend.com/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      amount: 99.00,
      item_name: 'Premium Subscription',
      customer_email: user.email,
      return_url: 'yourapp://payment/success',  // Deep link
      cancel_url: 'yourapp://payment/cancelled'
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Option 1: Open in system browser
    await Linking.openURL(result.payment_url);
    
    // Option 2: Open in in-app browser (recommended)
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(result.payment_url, {
        dismissButtonStyle: 'close',
        preferredBarTintColor: '#453AA4',
        preferredControlTintColor: 'white',
        readerMode: false,
        animated: true,
      });
    }
  }
};
```

### 2. Get Transaction Status

Check the status of a payment.

**Endpoint:** `GET /app-api/payments/transaction/:transactionId`

**Response:**

```typescript
interface TransactionStatusResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled' | 'refunded';
    amount: number;
    currency: string;
    item_name: string;
    payment_type: 'once_off' | 'subscription';
    paid_at?: string;      // ISO timestamp when payment completed
    created_at: string;
  };
}
```

**Example:**

```typescript
const checkPaymentStatus = async (transactionId: string) => {
  const response = await fetch(`/app-api/payments/transaction/${transactionId}`, {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  });

  const result = await response.json();
  
  if (result.success) {
    switch (result.data.status) {
      case 'complete':
        // Payment successful - grant access
        console.log('Payment completed at:', result.data.paid_at);
        break;
      case 'pending':
      case 'processing':
        // Still waiting - check again later
        setTimeout(() => checkPaymentStatus(transactionId), 5000);
        break;
      case 'failed':
      case 'cancelled':
        // Payment failed - show error
        console.log('Payment was not successful');
        break;
    }
  }
};
```

### 3. Cancel Subscription

Cancel an active subscription.

**Endpoint:** `POST /app-api/payments/subscription/cancel`

**Request Body:**

```typescript
{
  transaction_id: string;  // The original subscription transaction ID
}
```

**Response:**

```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

**Example:**

```typescript
const cancelSubscription = async (transactionId: string) => {
  const response = await fetch('/app-api/payments/subscription/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      transaction_id: transactionId
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Subscription cancelled successfully');
  } else {
    console.error('Failed to cancel:', result.error);
  }
};
```

## Webhook Handling

Payment gateways send notifications (webhooks) when payment status changes. Skaftin handles these automatically and updates the transaction status.

### Webhook URL

Configure this URL in your payment gateway dashboard:

```
https://your-backend.com/api/payments/webhook/payfast/{projectId}
```

### Custom Webhook Handling (Optional)

If you need real-time updates in your app, you can:

1. **Polling:** Check transaction status periodically after initiating payment
2. **WebSocket:** Listen for transaction updates via Skaftin WebSocket (coming soon)

## PayFast Subscription Frequencies

When creating subscription payments with PayFast, use these frequency values:

| Value | Frequency |
|-------|-----------|
| 3     | Monthly   |
| 4     | Quarterly |
| 5     | Bi-annually (every 6 months) |
| 6     | Annually  |

**Example subscription payment:**

```typescript
const createSubscription = async () => {
  const response = await fetch('/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      amount: 99.00,
      item_name: 'Pro Plan - Monthly',
      customer_email: 'user@example.com',
      payment_type: 'subscription',
      subscription_type: 1,    // Subscription
      frequency: 3,            // Monthly
      cycles: 0,               // Infinite (until cancelled)
      billing_date: 1,         // Bill on 1st of each month
      metadata: {
        user_id: '123',
        plan_id: 'pro'
      }
    })
  });

  const result = await response.json();
  // Handle result...
};
```

## Best Practices

### 1. Store Transaction IDs

Always store the `transaction_id` returned from `initiatePayment`. You'll need it to:
- Check payment status
- Cancel subscriptions
- Reconcile payments

### 2. Handle Deep Links (React Native)

Configure your app to handle return URLs:

```typescript
// App.tsx
import { Linking } from 'react-native';

useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const url = event.url;
    if (url.includes('payment/success')) {
      // Extract transaction ID and verify
      const transactionId = /* extract from URL */;
      checkPaymentStatus(transactionId);
    }
  };

  Linking.addEventListener('url', handleDeepLink);
  return () => Linking.removeEventListener('url', handleDeepLink);
}, []);
```

### 3. Verify Payment on Backend

Never trust client-side payment status alone. Always verify:

```typescript
// On your server
app.get('/api/verify-payment/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  // Call Skaftin API to verify
  const response = await fetch(
    `https://your-skaftin-backend/app-api/payments/transaction/${transactionId}`,
    { headers: { 'X-API-Key': process.env.SKAFTIN_API_KEY } }
  );
  
  const result = await response.json();
  
  if (result.success && result.data.status === 'complete') {
    // Grant access, update database, etc.
  }
});
```

### 4. Test in Sandbox

Always test with sandbox/test mode enabled:
- PayFast Sandbox: Uses test credentials, no real money charged
- Test card: 4000 0000 0000 0000 (any CVV, any future expiry)

## Error Handling

Common error responses:

| Error | Cause | Solution |
|-------|-------|----------|
| "Payment provider not found" | No provider configured | Add provider in Skaftin dashboard |
| "Payment provider is not active" | Provider disabled | Activate provider in dashboard |
| "Missing merchant_id or merchant_key" | Incomplete credentials | Update provider credentials |
| "Invalid amount" | Amount <= 0 | Ensure amount is positive |
| "Transaction not found" | Invalid transaction ID | Check transaction_id value |

## Related Documentation

- [PayFast Developer Docs](https://developers.payfast.co.za/)
- [Auth Requests](./01-AUTH-REQUESTS.md)
- [User Requests](./02-USER-REQUESTS.md)
