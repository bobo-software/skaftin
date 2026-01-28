# Payment API Requests

This document provides comprehensive guides for integrating payments into your React Web and React Native applications using the Skaftin Payment API.

## Overview

The Payment API allows you to:
- Initiate payments (once-off and subscriptions)
- Check transaction status
- Cancel subscriptions
- Handle payment redirects and deep links

Currently supported payment gateways:
- **PayFast** (South African payment gateway)
- Yoco, Paystack, Peach Payments, Ozow, Flutterwave (coming soon)

## Table of Contents

1. [Quick Start](#quick-start)
2. [React Web Implementation](#react-web-implementation)
3. [React Native Implementation](#react-native-implementation)
4. [API Reference](#api-reference)
5. [Deep Links & URL Handling](#deep-links--url-handling)
6. [Best Practices](#best-practices)

## Authentication

All payment endpoints require API Key authentication. You can use either `x-api-key` (lowercase) or `X-API-Key` (uppercase) header:

```typescript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'your-api-key'  // Recommended: lowercase
  // OR
  'X-API-Key': 'your-api-key'   // Also supported
}
```

**Getting an API Key:**
1. Navigate to your project in the Skaftin dashboard
2. Go to the "API Credentials" section
3. Create a new API Key credential
4. Copy the token value (starts with `sk_`)
5. Use this token as your API key in requests

**Note:** The API key must be active (`is_active: true`) and have the required permissions. The system automatically extracts the project ID from the API key, so you don't need to include it in the request.

## Quick Start

### React Web
```typescript
// 1. Install dependencies (if using a service)
// npm install axios

// 2. Create payment service
import axios from 'axios';

const API_BASE_URL = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

export const initiatePayment = async (paymentData: InitiatePaymentRequest) => {
  const response = await axios.post(`${API_BASE_URL}/payments/initiate`, paymentData, {
    headers: { 'X-API-Key': API_KEY }
  });
  return response.data;
};

// 3. Use in component
const handlePayment = async () => {
  const result = await initiatePayment({
    amount: 99.00,
    item_name: 'Premium Plan',
    customer_email: 'user@example.com'
  });
  
  if (result.success && result.paymentUrl) {
    window.location.href = result.paymentUrl;
  }
};
```

### React Native
```typescript
// 1. Install dependencies
// npm install react-native-webview react-native-inappbrowser-reborn
// npm install @react-navigation/native

// 2. Configure deep links (see Deep Links section)

// 3. Use WebView or InAppBrowser (see React Native section below)
```

---

## React Web Implementation

### Complete Example: Payment Component

```typescript
// PaymentButton.tsx
import React, { useState } from 'react';
import axios from 'axios';

interface PaymentButtonProps {
  amount: number;
  itemName: string;
  customerEmail?: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-backend.com/app-api';
const API_KEY = process.env.REACT_APP_API_KEY || '';

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  amount,
  itemName,
  customerEmail,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/payments/initiate`,
        {
          amount,
          item_name: itemName,
          customer_email: customerEmail,
          payment_type: 'once_off',
          return_url: `${window.location.origin}/payment/success`,
          cancel_url: `${window.location.origin}/payment/cancel`,
          metadata: {
            source: 'web_app',
            timestamp: new Date().toISOString()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          }
        }
      );

      if (response.data.success && response.data.paymentUrl) {
        // Store transaction ID for verification
        localStorage.setItem('pending_transaction', response.data.transactionId);
        
        // Redirect to payment gateway
        window.location.href = response.data.paymentUrl;
        
        onSuccess?.(response.data.transactionId);
      } else {
        throw new Error(response.data.error || 'Payment initiation failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      onError?.(error.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="payment-button"
    >
      {loading ? 'Processing...' : `Pay R${amount.toFixed(2)}`}
    </button>
  );
};
```

### Payment Success/Cancel Pages

```typescript
// PaymentSuccess.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-backend.com/app-api';
const API_KEY = process.env.REACT_APP_API_KEY || '';

export const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  useEffect(() => {
    // Get transaction ID from URL params or localStorage
    const txId = searchParams.get('transaction_id') || 
                 localStorage.getItem('pending_transaction');
    
    if (txId) {
      setTransactionId(txId);
      verifyPayment(txId);
    } else {
      setVerifying(false);
    }
  }, [searchParams]);

  const verifyPayment = async (txId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/payments/transaction/${txId}`,
        {
          headers: { 'x-api-key': API_KEY }  // Use lowercase header name
        }
      );

      if (response.data.success && response.data.data.status === 'complete') {
        setVerified(true);
        localStorage.removeItem('pending_transaction');
        
        // Update user's subscription/access here
        // await updateUserAccess();
      } else {
        setVerified(false);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return <div>Verifying payment...</div>;
  }

  if (verified) {
    return (
      <div className="payment-success">
        <h1>Payment Successful!</h1>
        <p>Your transaction ID: {transactionId}</p>
        <p>Thank you for your purchase.</p>
      </div>
    );
  }

  return (
    <div className="payment-error">
      <h1>Payment Verification Failed</h1>
      <p>Please contact support if you were charged.</p>
    </div>
  );
};

// PaymentCancel.tsx
export const PaymentCancel: React.FC = () => {
  useEffect(() => {
    // Clean up pending transaction
    localStorage.removeItem('pending_transaction');
  }, []);

  return (
    <div className="payment-cancel">
      <h1>Payment Cancelled</h1>
      <p>You cancelled the payment process.</p>
      <button onClick={() => window.location.href = '/'}>
        Return to Home
      </button>
    </div>
  );
};
```

### Router Configuration

```typescript
// App.tsx or Router.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentCancel } from './pages/PaymentCancel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        {/* ... other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## React Native Implementation

### Option 1: Using WebView (Recommended for Full Control)

#### Installation

```bash
npm install react-native-webview
# For iOS
cd ios && pod install
```

#### Complete WebView Payment Component

```typescript
// PaymentWebView.tsx
import React, { useRef, useState } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios';

interface PaymentWebViewProps {
  amount: number;
  itemName: string;
  customerEmail?: string;
  onSuccess: (transactionId: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

const API_BASE_URL = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

export const PaymentWebView: React.FC<PaymentWebViewProps> = ({
  amount,
  itemName,
  customerEmail,
  onSuccess,
  onCancel,
  onError
}) => {
  const [loading, setLoading] = useState(true);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  React.useEffect(() => {
    initiatePayment();
  }, []);

  const initiatePayment = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/payments/initiate`,
        {
          amount,
          item_name: itemName,
          customer_email: customerEmail,
          payment_type: 'once_off',
          // Use HTTPS URLs (Universal Links/App Links) - PayFast requires HTTP/HTTPS
          return_url: 'https://yourapp.com/payment/success',
          cancel_url: 'https://yourapp.com/payment/cancel',
          metadata: {
            source: 'mobile_app',
            platform: 'react_native'
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          }
        }
      );

      if (response.data.success && response.data.paymentUrl) {
        setPaymentUrl(response.data.paymentUrl);
      } else {
        onError(response.data.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      onError(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;

    // Check for success URL (Universal Link or App Link)
    if (url.includes('/payment/success')) {
      // Extract transaction ID from URL if present
      const urlObj = new URL(url);
      const transactionId = urlObj.searchParams.get('transaction_id') || 
                           urlObj.pathname.split('/').pop();
      
      if (transactionId) {
        verifyAndComplete(transactionId);
      } else {
        // If no transaction ID in URL, check localStorage/cookies
        // You may need to inject JS to get it
        webViewRef.current?.injectJavaScript(`
          (function() {
            const params = new URLSearchParams(window.location.search);
            const txId = params.get('transaction_id') || 
                        localStorage.getItem('transaction_id');
            if (txId) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_success',
                transaction_id: txId
              }));
            }
          })();
        `);
      }
      return false; // Prevent navigation
    }

    // Check for cancel URL (Universal Link or App Link)
    if (url.includes('/payment/cancel')) {
      onCancel();
      return false; // Prevent navigation
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success' && data.transaction_id) {
        verifyAndComplete(data.transaction_id);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  const verifyAndComplete = async (transactionId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/payments/transaction/${transactionId}`,
        {
          headers: { 'x-api-key': API_KEY }  // Use lowercase header name
        }
      );

      if (response.data.success && response.data.data.status === 'complete') {
        onSuccess(transactionId);
      } else {
        onError('Payment verification failed');
      }
    } catch (error) {
      onError('Failed to verify payment');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!paymentUrl) {
    return null;
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: paymentUrl }}
      onNavigationStateChange={handleNavigationStateChange}
      onMessage={handleMessage}
      style={styles.webview}
      startInLoadingState={true}
      renderLoading={() => (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      )}
      // Allow navigation to payment gateway
      onShouldStartLoadWithRequest={(request) => {
        // Allow navigation to payment gateway domains
        if (request.url.includes('payfast.co.za') || 
            request.url.includes('sandbox.payfast.co.za')) {
          return true;
        }
        // Allow navigation to payment gateway domains and our app's HTTPS URLs
        // Universal Links/App Links will automatically open the app
        return true;
      }}
    />
  );
};

const styles = StyleSheet.create({
  webview: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
```

#### Using the PaymentWebView Component

```typescript
// CheckoutScreen.tsx
import React, { useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { PaymentWebView } from './components/PaymentWebView';

export const CheckoutScreen: React.FC = () => {
  const [showPayment, setShowPayment] = useState(false);

  const handlePaymentSuccess = (transactionId: string) => {
    setShowPayment(false);
    Alert.alert(
      'Payment Successful',
      `Transaction ID: ${transactionId}`,
      [{ text: 'OK', onPress: () => {
        // Navigate to success screen or update app state
        // navigation.navigate('Success');
      }}]
    );
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    Alert.alert('Payment Cancelled', 'You cancelled the payment.');
  };

  const handlePaymentError = (error: string) => {
    setShowPayment(false);
    Alert.alert('Payment Error', error);
  };

  if (showPayment) {
    return (
      <PaymentWebView
        amount={99.00}
        itemName="Premium Subscription"
        customerEmail="user@example.com"
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
        onError={handlePaymentError}
      />
    );
  }

  return (
    <View>
      <Button
        title="Pay R99.00"
        onPress={() => setShowPayment(true)}
      />
    </View>
  );
};
```

### Option 2: Using InAppBrowser (Simpler, Less Control)

#### Installation

```bash
npm install react-native-inappbrowser-reborn
# For iOS
cd ios && pod install
```

#### InAppBrowser Implementation

```typescript
// PaymentInAppBrowser.tsx
import React from 'react';
import { Alert, Linking } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import axios from 'axios';

const API_BASE_URL = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

export const initiatePaymentWithInAppBrowser = async (
  amount: number,
  itemName: string,
  customerEmail?: string
) => {
  try {
    // 1. Initiate payment
    const response = await axios.post(
      `${API_BASE_URL}/payments/initiate`,
      {
          amount,
          item_name: itemName,
          customer_email: customerEmail,
          payment_type: 'once_off',
          // Use HTTPS URLs (Universal Links/App Links) - PayFast requires HTTP/HTTPS
          return_url: 'https://yourapp.com/payment/success',
          cancel_url: 'https://yourapp.com/payment/cancel'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY  // Use lowercase header name
        }
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Payment initiation failed');
    }

    const { paymentUrl, transactionId } = response.data;

    // 2. Open payment URL in InAppBrowser
    if (await InAppBrowser.isAvailable()) {
      const result = await InAppBrowser.open(paymentUrl, {
        // iOS options
        dismissButtonStyle: 'close',
        preferredBarTintColor: '#453AA4',
        preferredControlTintColor: 'white',
        readerMode: false,
        animated: true,
        modalPresentationStyle: 'fullScreen',
        modalEnabled: true,
        enableBarCollapsing: false,
        
        // Android options
        showTitle: true,
        toolbarColor: '#453AA4',
        secondaryToolbarColor: 'black',
        navigationBarColor: 'black',
        enableUrlBarHiding: true,
        enableDefaultShare: false,
        forceCloseOnRedirection: false,
        
        // Shared options
        animations: {
          startEnter: 'slide_in_right',
          startExit: 'slide_out_left',
          endEnter: 'slide_in_left',
          endExit: 'slide_out_right'
        }
      });

      // 3. Handle result
      if (result.type === 'cancel') {
        Alert.alert('Payment Cancelled', 'You cancelled the payment.');
      } else if (result.type === 'dismiss') {
        // Browser was dismissed - check payment status
        await checkPaymentStatus(transactionId);
      }
    } else {
      // Fallback to system browser
      await Linking.openURL(paymentUrl);
    }
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to initiate payment');
  }
};

const checkPaymentStatus = async (transactionId: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/payments/transaction/${transactionId}`,
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );

    if (response.data.success) {
      const status = response.data.data.status;
      if (status === 'complete') {
        Alert.alert('Payment Successful', `Transaction ID: ${transactionId}`);
        // Update app state, grant access, etc.
      } else if (status === 'pending' || status === 'processing') {
        // Poll again after delay
        setTimeout(() => checkPaymentStatus(transactionId), 5000);
      } else {
        Alert.alert('Payment Failed', 'The payment was not successful.');
      }
    }
  } catch (error) {
    console.error('Status check error:', error);
  }
};
```

### Deep Link Configuration

#### iOS (Info.plist)

```xml
<!-- ios/YourApp/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>yourapp</string>
    </array>
    <key>CFBundleURLName</key>
    <string>com.yourapp.payments</string>
  </dict>
</array>
```

#### Android (AndroidManifest.xml)

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity
  android:name=".MainActivity"
  android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="yourapp" />
  </intent-filter>
</activity>
```

#### Handling Deep Links in App

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import axios from 'axios';

const API_BASE_URL = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

export const App: React.FC = () => {
  useEffect(() => {
    // Handle deep link when app is opened via URL
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink({ url });
      }
    };

    // Handle deep link when app is already running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (event: { url: string }) => {
    const url = event.url;
    
    if (url.includes('payment/success')) {
      // Extract transaction ID
      const urlObj = new URL(url);
      const transactionId = urlObj.searchParams.get('transaction_id');
      
      if (transactionId) {
        await verifyPayment(transactionId);
      } else {
        // Transaction ID might be in the path
        const parts = url.split('/');
        const txId = parts[parts.length - 1];
        if (txId) {
          await verifyPayment(txId);
        }
      }
    } else if (url.includes('payment/cancel')) {
      Alert.alert('Payment Cancelled', 'You cancelled the payment.');
    }
  };

  const verifyPayment = async (transactionId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/payments/transaction/${transactionId}`,
        {
          headers: { 'x-api-key': API_KEY }  // Use lowercase header name
        }
      );

      if (response.data.success && response.data.data.status === 'complete') {
        Alert.alert(
          'Payment Successful',
          `Transaction ID: ${transactionId}`,
          [{ text: 'OK', onPress: () => {
            // Navigate to success screen
            // navigation.navigate('PaymentSuccess', { transactionId });
          }}]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify payment');
    }
  };

  // ... rest of your app
};
```

---

## API Reference

### 1. Initiate Payment

Start a payment and get the redirect URL.

**Endpoint:** `POST /app-api/payments/initiate`

**Request Body:**

```typescript
interface InitiatePaymentRequest {
  // Provider selection (optional - uses first active provider if not specified)
  provider_id?: number;       // Payment provider ID (recommended for reliability)
  
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

**Note:** Use `provider_id` for reliable provider selection. If not provided, the system will use the first active payment provider for your project. To get available provider IDs, use the `list_payment_providers` MCP tool or call `/api/payments/{projectId}/providers`.

**Response:**

```typescript
interface InitiatePaymentResponse {
  success: boolean;
  transactionId: string;    // Your reference ID (UUID) - camelCase
  paymentUrl: string;      // Redirect user here to complete payment - camelCase
  paymentData?: object;    // Raw data sent to gateway (optional)
  error?: string;          // Error message if success is false
}
```

**Important:** The response uses camelCase (`paymentUrl`, `transactionId`), not snake_case. Make sure your code checks `result.paymentUrl` (not `result.payment_url` or `result.data.payment_url`).

**Examples:**

```typescript
// React Web - With provider_id (recommended)
const initiatePayment = async (providerId?: number) => {
  const response = await fetch('/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      provider_id: providerId,  // Optional: specify provider ID for reliability
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
  
  if (result.success && result.paymentUrl) {
    // Store transactionId for later status checks
    localStorage.setItem('pending_transaction', result.transactionId);
    
    // Redirect to payment page
    window.location.href = result.paymentUrl;
  } else {
    console.error('Payment failed:', result.error);
  }
};

// Without provider_id (uses first active provider)
const initiatePaymentAuto = async () => {
  const response = await fetch('/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      // provider_id omitted - will use first active provider
      amount: 99.00,
      item_name: 'Premium Subscription',
      customer_email: 'user@example.com',
      payment_type: 'once_off'
    })
  });
  // ... handle response
};
```

```typescript
// React Native - With provider_id (recommended)
import { Linking } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const initiatePayment = async (providerId?: number) => {
  const response = await fetch('https://your-backend.com/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      provider_id: providerId,  // Optional: specify provider ID for reliability
      amount: 99.00,
      item_name: 'Premium Subscription',
      customer_email: user.email,
      // Use HTTPS URLs (Universal Links/App Links) - PayFast requires HTTP/HTTPS
      return_url: 'https://yourapp.com/payment/success',
      cancel_url: 'https://yourapp.com/payment/cancel'
    })
  });

  const result = await response.json();
  
      if (result.success && result.paymentUrl) {
        // Option 1: Open in system browser
        await Linking.openURL(result.paymentUrl);
        
        // Option 2: Open in in-app browser (recommended)
        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(result.paymentUrl, {
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
      provider_id: 1,          // Optional: specify provider ID for reliability
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

### 1. Use Provider ID for Reliability

Always use `provider_id` instead of relying on automatic provider selection. This ensures you're using the exact provider you intend to use.

**Getting Provider ID:**

```typescript
// Option 1: Using MCP tool
// Use the list_payment_providers MCP tool to get available providers

// Option 2: Using Admin API (requires SuperTokens auth)
const getProviders = async () => {
  const response = await fetch(`/api/payments/${projectId}/providers`, {
    headers: {
      'Authorization': `Bearer ${superTokensToken}`
    }
  });
  const result = await response.json();
  
  if (result.success) {
    // Find the provider you want
    const payfastProvider = result.data.find(
      (p: any) => p.provider_type === 'payfast' && p.is_active
    );
    return payfastProvider?.id;
  }
};

// Option 3: Store provider_id in your app config
const PAYMENT_PROVIDER_ID = 1; // Set this after initial setup

// Then use it in payment requests
const initiatePayment = async () => {
  const response = await fetch('/app-api/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      provider_id: PAYMENT_PROVIDER_ID,  // ✅ Reliable
      amount: 99.00,
      item_name: 'Premium Plan'
    })
  });
  // ...
};
```

**Benefits of using provider_id:**
- ✅ More reliable - won't break if provider names change
- ✅ Explicit - you know exactly which provider is being used
- ✅ Better for multiple providers - can switch between sandbox/live easily

### 2. Store Transaction IDs

Always store the `transaction_id` returned from `initiatePayment`. You'll need it to:
- Check payment status
- Cancel subscriptions
- Reconcile payments

**React Web:**
```typescript
// Store in localStorage
localStorage.setItem('pending_transaction', transactionId);

// Or in state management (Redux, Zustand, etc.)
dispatch(setPendingTransaction(transactionId));
```

**React Native:**
```typescript
// Store in AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.setItem('pending_transaction', transactionId);

// Or in state management
dispatch(setPendingTransaction(transactionId));
```

### 2. Always Verify Payment Status

Never trust client-side redirects alone. Always verify payment status server-side:

```typescript
// ✅ Good: Verify on backend
const verifyPayment = async (transactionId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/payments/transaction/${transactionId}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const result = await response.json();
  
  if (result.success && result.data.status === 'complete') {
    // Only then grant access
    return true;
  }
  return false;
};

// ❌ Bad: Trusting redirect URL
if (window.location.href.includes('success')) {
  // Don't do this - user could manually navigate here!
  grantAccess();
}
```

### 3. Handle Payment Timeouts

Payment gateways may take time to process. Implement polling:

```typescript
const pollPaymentStatus = async (
  transactionId: string,
  maxAttempts: number = 12,
  interval: number = 5000
): Promise<boolean> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkPaymentStatus(transactionId);
    
    if (status === 'complete') {
      return true;
    } else if (status === 'failed' || status === 'cancelled') {
      return false;
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  // Timeout - payment still pending
  return false;
};
```

### 4. Error Handling

Implement comprehensive error handling:

```typescript
const handlePaymentError = (error: any) => {
  if (error.response) {
    // API error
    switch (error.response.status) {
      case 400:
        // Bad request - invalid data
        Alert.alert('Invalid Payment', error.response.data.error);
        break;
      case 401:
        // Unauthorized - invalid API key
        Alert.alert('Authentication Error', 'Please check your API key');
        break;
      case 404:
        // Provider not found
        Alert.alert('Payment Error', 'Payment provider not configured');
        break;
      case 500:
        // Server error
        Alert.alert('Server Error', 'Please try again later');
        break;
      default:
        Alert.alert('Error', error.response.data.error || 'Unknown error');
    }
  } else if (error.request) {
    // Network error
    Alert.alert('Network Error', 'Please check your internet connection');
  } else {
    // Other error
    Alert.alert('Error', error.message || 'An unexpected error occurred');
  }
};
```

### 5. Security Considerations

- **Never expose API keys in client code** - Use environment variables
- **Always verify payments server-side** - Don't trust client-side status
- **Use HTTPS** - Always use secure connections
- **Validate amounts** - Double-check amounts before initiating payment
- **Rate limiting** - Implement rate limiting on payment initiation

### 6. User Experience

- **Show loading states** - Let users know payment is processing
- **Clear error messages** - Provide helpful error messages
- **Retry mechanisms** - Allow users to retry failed payments
- **Payment history** - Show users their payment history
- **Receipts** - Provide payment receipts/confirmations

## Deep Links & URL Handling

### Important: PayFast URL Requirements

**PayFast requires HTTP/HTTPS URLs for `return_url` and `cancel_url`. Custom URL schemes (e.g., `yourapp://payment/success`) are NOT supported.**

For mobile apps, you have three options:

### Option 1: Universal Links (iOS) / App Links (Android) - Recommended

Use HTTPS URLs that automatically open your app:

**Return URL (Success):**
```
https://yourapp.com/payment/success?transaction_id=abc-123
```

**Cancel URL:**
```
https://yourapp.com/payment/cancel
```

Configure your app to handle these URLs:
- **iOS**: Set up Universal Links in `apple-app-site-association` file
- **Android**: Set up App Links in `assetlinks.json` file

### Option 2: Web Redirect Page

Create a web page that redirects to your app's deep link:

```html
<!-- https://yourapp.com/payment/success -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>
    // Extract transaction_id from URL
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transaction_id');
    
    // Try to open app, fallback to web
    const deepLink = `yourapp://payment/success?transaction_id=${transactionId}`;
    window.location.href = deepLink;
    
    // Fallback after 2 seconds
    setTimeout(() => {
      window.location.href = 'https://yourapp.com/payment-success-web';
    }, 2000);
  </script>
</head>
<body>
  <p>Redirecting to app...</p>
</body>
</html>
```

### Option 3: Backend Redirect Endpoint

Create an endpoint on your backend that redirects to the app:

```typescript
// Backend endpoint: GET /api/payment/redirect/success
app.get('/api/payment/redirect/success', (req, res) => {
  const transactionId = req.query.transaction_id;
  const userAgent = req.headers['user-agent'] || '';
  
  // Detect mobile app
  if (userAgent.includes('YourApp')) {
    res.redirect(`yourapp://payment/success?transaction_id=${transactionId}`);
  } else {
    // Web fallback
    res.redirect(`https://yourapp.com/payment-success-web?transaction_id=${transactionId}`);
  }
});
```

Then use this endpoint as your return_url:
```
https://your-backend.com/api/payment/redirect/success
```

### URL Structure Examples

**For Web Apps:**
```
return_url: https://yourapp.com/payment/success
cancel_url: https://yourapp.com/payment/cancel
```

**For Mobile Apps (Universal Links):**
```
return_url: https://yourapp.com/payment/success
cancel_url: https://yourapp.com/payment/cancel
```

**For Mobile Apps (Redirect Page):**
```
return_url: https://yourapp.com/payment-redirect/success
cancel_url: https://yourapp.com/payment-redirect/cancel
```

### React Web URL Handling

```typescript
// utils/paymentUtils.ts
export const extractTransactionId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('transaction_id');
  } catch {
    // Fallback for relative URLs
    const match = url.match(/transaction_id=([^&]+)/);
    return match ? match[1] : null;
  }
};

// In your success page component
const transactionId = extractTransactionId(window.location.href) || 
                      localStorage.getItem('pending_transaction');
```

### React Native Deep Link Handling

#### Using React Navigation

```typescript
// navigation/PaymentNavigator.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking } from 'react-native';

const Stack = createNativeStackNavigator();

export const PaymentNavigator = () => {
  useEffect(() => {
    // Handle deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });
    
    return () => subscription.remove();
  }, []);

  const handleDeepLink = ({ url }: { url: string }) => {
    // Handle Universal Links/App Links (HTTPS URLs that open the app)
    if (url.includes('/payment/success')) {
      const transactionId = extractTransactionId(url);
      navigation.navigate('PaymentSuccess', { transactionId });
    } else if (url.includes('/payment/cancel')) {
      navigation.navigate('PaymentCancel');
    }
  };

  return (
    <Stack.Navigator>
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <Stack.Screen name="PaymentCancel" component={PaymentCancelScreen} />
    </Stack.Navigator>
  );
};
```

#### Universal Links (iOS) / App Links (Android)

For production apps, use Universal Links (iOS) or App Links (Android) instead of custom schemes:

**iOS Universal Links:**
```
https://yourapp.com/payment/success
```

**Android App Links:**
```
https://yourapp.com/payment/success
```

Configure in your payment provider settings:
- Return URL: `https://yourapp.com/payment/success`
- Cancel URL: `https://yourapp.com/payment/cancel`

Then configure your app to handle these URLs (see React Native documentation for setup).

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

### Common API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Payment provider not found" | No provider configured | Add provider in Skaftin dashboard |
| "Payment provider is not active" | Provider disabled | Activate provider in dashboard |
| "Missing merchant_id or merchant_key" | Incomplete credentials | Update provider credentials |
| "Invalid amount" | Amount <= 0 | Ensure amount is positive |
| "Transaction not found" | Invalid transaction ID | Check transactionId value |
| "Invalid API key" | Wrong or expired API key | Check API key in credentials section |
| "No active API key found" | No active API key credential | Create an API key in API Credentials section |
| "Network error" | Connection failed | Check internet connection, retry |
| 404 Not Found on `/api/client/payments/initiate` | Wrong endpoint path | Use `/app-api/payments/initiate` instead |
| "Failed to initiate payment" (but response is successful) | Wrong response field name | Use `result.paymentUrl` (camelCase), not `result.data.payment_url` |

### React Native Specific Issues

**Issue: Deep links not working**
- **Solution:** Ensure deep links are configured in `Info.plist` (iOS) and `AndroidManifest.xml` (Android)
- **Check:** Test deep links using `adb shell am start -W -a android.intent.action.VIEW -d "yourapp://payment/success"` (Android)

**Issue: WebView not loading payment page**
- **Solution:** Check if payment gateway URL is allowed in WebView settings
- **Check:** Ensure `onShouldStartLoadWithRequest` allows payment gateway domains

**Issue: Payment redirects to browser instead of app**
- **Solution:** Use Universal Links (iOS) or App Links (Android) instead of custom schemes
- **Alternative:** Use InAppBrowser which handles redirects better

**Issue: Transaction ID not found after redirect**
- **Solution:** Store transaction ID before redirecting, don't rely on URL parameters
- **Check:** Payment gateway may not include transaction ID in redirect URL

### React Web Specific Issues

**Issue: Payment page opens in same tab, user can't go back**
- **Solution:** Open payment URL in new window/tab: `window.open(paymentUrl, '_blank')`
- **Alternative:** Use a modal with iframe (not recommended for security)

**Issue: CORS errors when calling API**
- **Solution:** Ensure API server allows requests from your domain
- **Check:** Verify `Access-Control-Allow-Origin` headers

**Issue: Payment success page shows before payment completes**
- **Solution:** Always verify payment status via API, don't trust URL alone
- **Check:** Implement polling to check payment status

## Troubleshooting Guide

### Payment Not Initiating

1. **Check API Key:**
   ```typescript
   console.log('API Key:', API_KEY); // Should not be empty
   ```
   
   **Getting API Key from Credentials API:**
   ```typescript
   // Fetch credentials for your project
   const credentialsResponse = await fetch(`/api/credentials/${projectId}/credentials`, {
     headers: { 'Authorization': `Bearer ${yourAuthToken}` }
   });
   const credentials = await credentialsResponse.json();
   
   // Find an active API key
   const apiKey = credentials.data.find(
     (cred: any) => cred.credential_type === 'api_key' && cred.is_active
   );
   
   // Use apiKey.token (not apiKey.key_value)
   const API_KEY = apiKey?.token;
   ```

2. **Check Network Request:**
   ```typescript
   // Add logging
   console.log('Request URL:', `${API_BASE_URL}/app-api/payments/initiate`);
   console.log('Request Body:', paymentData);
   console.log('Response:', response.data);
   ```
   
   **Important:** Make sure you're using the correct endpoint:
   - ✅ Correct: `/app-api/payments/initiate`
   - ❌ Wrong: `/api/client/payments/initiate`

3. **Check Response Structure:**
   ```typescript
   // Correct response handling
   if (result.success && result.paymentUrl) {  // camelCase, top-level
     window.location.href = result.paymentUrl;
   }
   
   // Common mistakes:
   // ❌ result.data.payment_url  (wrong - not nested, wrong case)
   // ❌ result.payment_url        (wrong - should be camelCase)
   // ✅ result.paymentUrl         (correct)
   ```

4. **Check Provider Configuration:**
   - Verify provider is active in Skaftin dashboard
   - Check provider credentials are correct
   - Ensure provider is in sandbox mode for testing

### Payment Redirect Not Working

1. **React Web:**
   - Check return_url format: `https://yourapp.com/payment/success`
   - Verify route exists in your router
   - Check browser console for errors

2. **React Native:**
   - Test deep link manually: `adb shell am start -W -a android.intent.action.VIEW -d "yourapp://payment/success"`
   - Check WebView `onNavigationStateChange` is firing
   - Verify deep link configuration in native files

### Payment Status Not Updating

1. **Check Webhook Configuration:**
   - Verify webhook URL is correct in payment provider dashboard
   - Test webhook endpoint is accessible
   - Check webhook logs for errors

2. **Implement Polling:**
   ```typescript
   // Poll every 5 seconds for up to 2 minutes
   const pollInterval = setInterval(async () => {
     const status = await checkPaymentStatus(transactionId);
     if (status === 'complete' || status === 'failed') {
       clearInterval(pollInterval);
     }
   }, 5000);
   
   setTimeout(() => clearInterval(pollInterval), 120000);
   ```

### Testing Checklist

- [ ] API key is valid and active
- [ ] Payment provider is configured and active
- [ ] Provider is in sandbox mode (for testing)
- [ ] Return URLs are correctly formatted
- [ ] Deep links are configured (React Native)
- [ ] Payment success/cancel pages exist
- [ ] Payment verification is implemented
- [ ] Error handling is in place
- [ ] Loading states are shown
- [ ] Transaction IDs are stored

## Complete Example Implementations

### React Web: Full Payment Flow

```typescript
// services/paymentService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL;
const API_KEY = process.env.REACT_APP_API_KEY;

export const paymentService = {
  async initiatePayment(data: InitiatePaymentRequest) {
    const response = await axios.post(
      `${API_BASE_URL}/payments/initiate`,
      {
        ...data,
        return_url: `${window.location.origin}/payment/success`,
        cancel_url: `${window.location.origin}/payment/cancel`
      },
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );
    return response.data;
  },

  async getTransactionStatus(transactionId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/payments/transaction/${transactionId}`,
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );
    return response.data;
  },

  async cancelSubscription(transactionId: string) {
    const response = await axios.post(
      `${API_BASE_URL}/payments/subscription/cancel`,
      { transaction_id: transactionId },
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );
    return response.data;
  }
};

// components/PaymentButton.tsx
import React, { useState } from 'react';
import { paymentService } from '../services/paymentService';

interface PaymentButtonProps {
  amount: number;
  itemName: string;
  providerId?: number;  // Optional: specify provider ID for reliability
  onSuccess?: () => void;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  amount,
  itemName,
  providerId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await paymentService.initiatePayment({
        provider_id: providerId,  // Use provider_id if provided
        amount,
        item_name: itemName,
        customer_email: 'user@example.com',
        payment_type: 'once_off'
      });

      if (result.success && result.paymentUrl) {
        localStorage.setItem('pending_transaction', result.transactionId);
        window.location.href = result.paymentUrl;
      }
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Processing...' : `Pay R${amount.toFixed(2)}`}
    </button>
  );
};
```

### React Native: Full Payment Flow

```typescript
// services/paymentService.ts
import axios from 'axios';

const API_BASE_URL = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

export const paymentService = {
  async initiatePayment(data: InitiatePaymentRequest) {
      const response = await axios.post(
        `${API_BASE_URL}/payments/initiate`,
        {
          ...data,
          // Use HTTPS URLs (Universal Links/App Links) - PayFast requires HTTP/HTTPS
          return_url: 'https://yourapp.com/payment/success',
          cancel_url: 'https://yourapp.com/payment/cancel'
        },
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );
    return response.data;
  },

  async getTransactionStatus(transactionId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/payments/transaction/${transactionId}`,
      {
        headers: { 'x-api-key': API_KEY }  // Use lowercase header name
      }
    );
    return response.data;
  }
};

// screens/PaymentScreen.tsx
import React, { useState } from 'react';
import { View, Button, Alert, StyleSheet } from 'react-native';
import { PaymentWebView } from '../components/PaymentWebView';
import { paymentService } from '../services/paymentService';

export const PaymentScreen: React.FC = () => {
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const handlePayment = async () => {
    try {
      const result = await paymentService.initiatePayment({
        provider_id: 1,  // Optional: specify provider ID for reliability
        amount: 99.00,
        item_name: 'Premium Subscription',
        customer_email: 'user@example.com',
        payment_type: 'once_off',
        // Use HTTPS URLs (Universal Links/App Links) - PayFast requires HTTP/HTTPS
        return_url: 'https://yourapp.com/payment/success',
        cancel_url: 'https://yourapp.com/payment/cancel'
      });

      if (result.success && result.paymentUrl) {
        setPaymentUrl(result.paymentUrl);
        setShowWebView(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Network error');
    }
  };

  const handleSuccess = async (transactionId: string) => {
    setShowWebView(false);
    
    // Verify payment
    const status = await paymentService.getTransactionStatus(transactionId);
    
    if (status.success && status.data.status === 'complete') {
      Alert.alert('Success', 'Payment completed successfully!');
      // Navigate to success screen or update app state
    } else {
      Alert.alert('Error', 'Payment verification failed');
    }
  };

  const handleCancel = () => {
    setShowWebView(false);
    Alert.alert('Cancelled', 'Payment was cancelled');
  };

  if (showWebView && paymentUrl) {
    return (
      <PaymentWebView
        paymentUrl={paymentUrl}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Button title="Pay R99.00" onPress={handlePayment} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  }
});
```

## Environment Variables

### React Web (.env)

```bash
REACT_APP_API_URL=https://your-backend.com/app-api
REACT_APP_API_KEY=your-api-key-here
```

### React Native (.env)

```bash
API_BASE_URL=https://your-backend.com/app-api
API_KEY=your-api-key-here
```

Access in code:
```typescript
// React Web
const API_URL = process.env.REACT_APP_API_URL;

// React Native (using react-native-config)
import Config from 'react-native-config';
const API_URL = Config.API_BASE_URL;
```

## Related Documentation

- [PayFast Developer Docs](https://developers.payfast.co.za/)
- [PayFast Sandbox Testing](https://sandbox.payfast.co.za/)
- [Auth Requests](./01-AUTH-REQUESTS.md)
- [User Requests](./02-USER-REQUESTS.md)
- [React Native WebView Docs](https://github.com/react-native-webview/react-native-webview)
- [React Native InAppBrowser Docs](https://github.com/proyecto26/react-native-inappbrowser)
