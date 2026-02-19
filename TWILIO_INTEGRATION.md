# Twilio Integration Guide

This document explains how Twilio SMS and WhatsApp messaging is integrated into the SlipSam API, and how to integrate it into other codebases.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Integration Steps](#integration-steps)
- [Troubleshooting](#troubleshooting)

## Overview

The Twilio integration provides:
- **SMS Messaging**: Send SMS messages to phone numbers
- **WhatsApp Messaging**: Send WhatsApp messages (requires opt-in)
- **Message Status Tracking**: Check delivery status of sent messages
- **Error Handling**: Comprehensive error codes and explanations

## Prerequisites

1. **Twilio Account**: Sign up at [twilio.com](https://www.twilio.com)
2. **Twilio Phone Number**: Purchase a phone number from Twilio Console
3. **WhatsApp Setup** (optional):
   - For testing: Use Twilio WhatsApp Sandbox
   - For production: Apply for WhatsApp Business API access

## Installation

### 1. Install Twilio SDK

```bash
npm install twilio
```

### 2. Install TypeScript Types (if using TypeScript)

```bash
npm install --save-dev @types/node
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# Required for all Twilio features
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Required for SMS
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required for WhatsApp
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

### Getting Your Credentials

1. **Account SID & Auth Token**:
   - Go to Twilio Console → Account → API Keys & Tokens
   - Copy your Account SID and Auth Token

2. **Phone Number**:
   - Go to Twilio Console → Phone Numbers → Manage → Buy a number
   - Copy the phone number (include country code, e.g., `+1234567890`)

3. **Messaging Service SID** (optional but recommended):
   - Go to Twilio Console → Messaging → Services
   - Create a new service or use existing one
   - Copy the Service SID

4. **WhatsApp Sender**:
   - **Sandbox**: Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Use the sandbox number: `whatsapp:+14155238886` (for testing)
   - **Production**: Use your approved WhatsApp Business number: `whatsapp:+1234567890`

## Architecture

### File Structure

```
src/
├── controllers/
│   └── TwilioController.ts      # Main controller with test endpoints
├── services/
│   └── SmsService.ts            # Service layer for SMS operations
└── routes/
    └── TwilioRoutes.ts          # API route definitions
```

### How It Works

1. **Client Initialization**: Twilio client is initialized once with credentials from environment variables
2. **Phone Number Formatting**: Phone numbers are automatically formatted to E.164 format (`+[country code][number]`)
3. **Message Sending**: Messages are sent via Twilio API and return a message SID
4. **Status Tracking**: Message status can be checked using the message SID
5. **Error Handling**: Comprehensive error codes are mapped to human-readable explanations

### Key Components

#### TwilioController
- `TestSms()`: Test endpoint for sending SMS
- `TestWhatsApp()`: Test endpoint for sending WhatsApp messages
- `CheckMessageStatus()`: Check the status of a sent message
- `getErrorCodeExplanation()`: Maps Twilio error codes to explanations

#### SmsService
- `sendSms()`: Generic SMS sending method
- `sendForgotPasswordSms()`: Specialized method for password reset OTPs
- `sendWelcomeSms()`: Specialized method for welcome/verification messages

## API Endpoints

### Base URL
All endpoints are prefixed with `/api/twilio`

### 1. Test SMS

**Endpoint**: `POST /api/twilio/test/sms`

**Request Body**:
```json
{
  "phone": "0712345678",
  "message": "This is a test SMS message"
}
```

**Response** (Success):
```json
{
  "message": "Test SMS sent successfully",
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "queued",
  "to": "+27123456789",
  "from": "+27600827840",
  "errorCode": null,
  "errorMessage": null,
  "dateCreated": "2026-02-09T06:38:45.000Z",
  "dateSent": "2026-02-09T06:38:45.000Z"
}
```

### 2. Test WhatsApp

**Endpoint**: `POST /api/twilio/test/whatsapp`

**Request Body**:
```json
{
  "phone": "0712345678",
  "message": "This is a test WhatsApp message"
}
```

**Response** (Success):
```json
{
  "message": "Test WhatsApp message sent successfully",
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "sent",
  "to": "whatsapp:+27123456789",
  "from": "whatsapp:+27600827840",
  "errorCode": null,
  "errorMessage": null,
  "errorCodeExplanation": null,
  "dateCreated": "2026-02-09T06:38:45.000Z",
  "dateSent": "2026-02-09T06:38:45.000Z",
  "dateUpdated": "2026-02-09T06:38:46.000Z",
  "note": null,
  "troubleshooting": null
}
```

**Response** (Error - Not Opted In):
```json
{
  "message": "Test WhatsApp message sent successfully",
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "undelivered",
  "errorCode": 63016,
  "errorCodeExplanation": "Recipient has not opted-in to receive WhatsApp messages. They must send a message to your Twilio WhatsApp number first.",
  "troubleshooting": "To fix this:\n1. Have the recipient send a WhatsApp message to: whatsapp:+27600827840\n2. If using Twilio Sandbox, they need to send: join [your-sandbox-code]\n3. Check your Twilio Console → Messaging → Try it out for the exact opt-in code"
}
```

### 3. Send WhatsApp Template Message

**Endpoint**: `POST /api/twilio/whatsapp/template`

**Description**: Send a pre-approved WhatsApp template message using Twilio Content Templates API. Templates must be approved by WhatsApp and created in your Twilio Console.

**Request Body**:
```json
{
  "phone": "0712442080",
  "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
  "contentVariables": {
    "1": "12/1",
    "2": "3pm"
  }
}
```

**Alternative Request Body** (with contentVariables as JSON string):
```json
{
  "phone": "0712442080",
  "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
  "contentVariables": "{\"1\":\"12/1\",\"2\":\"3pm\"}"
}
```

**Parameters**:
- `phone` (required): Recipient phone number (can be in format `0712442080`, `+27712442080`, or `27712442080`)
- `contentSid` (required): The Content Template SID from Twilio Console (starts with `HX`)
- `contentVariables` (optional): Template parameters as object or JSON string. Keys should match template placeholders (e.g., `{{1}}`, `{{2}}`)

**Response** (Success):
```json
{
  "message": "WhatsApp template message sent successfully",
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "sent",
  "to": "whatsapp:+27712442080",
  "from": "whatsapp:+27600827840",
  "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
  "contentVariables": "{\"1\":\"12/1\",\"2\":\"3pm\"}",
  "errorCode": null,
  "errorMessage": null,
  "errorCodeExplanation": null,
  "dateCreated": "2026-02-09T06:38:45.000Z",
  "dateSent": "2026-02-09T06:38:45.000Z",
  "dateUpdated": "2026-02-09T06:38:46.000Z",
  "troubleshooting": null
}
```

**Response** (Error - Not Opted In):
```json
{
  "message": "WhatsApp template message sent successfully",
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "undelivered",
  "errorCode": 63016,
  "errorCodeExplanation": "Recipient has not opted-in to receive WhatsApp messages. They must send a message to your Twilio WhatsApp number first.",
  "troubleshooting": "To fix this:\n1. Have the recipient send a WhatsApp message to: whatsapp:+27600827840\n2. If using Twilio Sandbox, they need to send: join [your-sandbox-code]\n3. Check your Twilio Console → Messaging → Try it out for the exact opt-in code"
}
```

**Getting Your Content Template SID**:
1. Go to Twilio Console → Content → Content Templates
2. Select your approved template
3. Copy the Content SID (starts with `HX`)
4. Note the template variables (e.g., `{{1}}`, `{{2}}`) and their expected values

**Note**: WhatsApp templates must be pre-approved by WhatsApp. You can create and submit templates in Twilio Console → Content → Content Templates.

### 4. Check Message Status

**Endpoint**: `POST /api/twilio/check-status`

**Request Body**:
```json
{
  "messageId": "SM1234567890abcdef1234567890abcdef"
}
```

**Response**:
```json
{
  "messageId": "SM1234567890abcdef1234567890abcdef",
  "status": "delivered",
  "to": "+27123456789",
  "from": "+27600827840",
  "body": "This is a test SMS message",
  "errorCode": null,
  "errorMessage": null,
  "errorCodeExplanation": null,
  "dateCreated": "2026-02-09T06:38:45.000Z",
  "dateSent": "2026-02-09T06:38:45.000Z",
  "dateUpdated": "2026-02-09T06:38:46.000Z",
  "price": "-0.00750",
  "priceUnit": "USD",
  "uri": "/2010-04-01/Accounts/ACxxx/Messages/SMxxx.json",
  "statusExplanation": "Message was delivered to recipient",
  "troubleshooting": null
}
```

## Usage Examples

### cURL Examples

#### Send SMS
```bash
curl -X POST http://localhost:4000/api/twilio/test/sms \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0712345678",
    "message": "Hello from SlipSam!"
  }'
```

#### Send WhatsApp
```bash
curl -X POST http://localhost:4000/api/twilio/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0712345678",
    "message": "Hello from SlipSam via WhatsApp!"
  }'
```

#### Send WhatsApp Template
```bash
curl -X POST http://localhost:4000/api/twilio/whatsapp/template \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0712442080",
    "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
    "contentVariables": {
      "1": "12/1",
      "2": "3pm"
    }
  }'
```

#### Check Status
```bash
curl -X POST http://localhost:4000/api/twilio/check-status \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "SM1234567890abcdef1234567890abcdef"
  }'
```

### JavaScript/TypeScript Examples

#### Using the Service Layer

```typescript
import SmsService from './services/SmsService';

// Send generic SMS
const result = await SmsService.sendSms(
  '0712345678',
  'Your order has been confirmed!'
);

// Send OTP for password reset
const otpResult = await SmsService.sendForgotPasswordSms(
  '0712345678',
  123456
);

// Send welcome SMS with verification code
const welcomeResult = await SmsService.sendWelcomeSms(
  '0712345678',
  'ABC123',
  'user'
);
```

#### Direct Twilio Client Usage

```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send SMS
const message = await client.messages.create({
  body: 'Hello from Twilio!',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: '+27123456789'
});

// Send WhatsApp
const whatsappMessage = await client.messages.create({
  body: 'Hello from WhatsApp!',
  from: 'whatsapp:+27600827840',
  to: 'whatsapp:+27123456789'
});

// Send WhatsApp Template
const whatsappTemplate = await client.messages.create({
  from: 'whatsapp:+27600827840',
  to: 'whatsapp:+27123456789',
  contentSid: 'HX350d429d32e64a552466cafecbe95f3c',
  contentVariables: JSON.stringify({
    '1': '12/1',
    '2': '3pm'
  })
});

// Check status
const status = await client.messages(message.sid).fetch();
console.log('Status:', status.status);
```

## Error Handling

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| 63016 | Recipient not opted-in to WhatsApp | Recipient must send a message to your WhatsApp number first |
| 63007 | Invalid WhatsApp number format | Ensure number is in E.164 format (`+[country][number]`) |
| 21608 | Recipient unsubscribed | Recipient has opted out |
| 21610 | Not a valid WhatsApp number | Number doesn't have WhatsApp |
| 30003 | Unreachable destination | Phone is off or out of coverage |
| 30004 | Message blocked | Carrier blocked the message |
| 30005 | Unknown destination | Invalid phone number |

### Error Response Format

```json
{
  "message": "Failed to send test SMS",
  "error": "Error message from Twilio",
  "code": 63016,
  "details": { /* Full error object */ }
}
```

## Integration Steps

### Step 1: Install Dependencies

```bash
npm install twilio
```

### Step 2: Create Twilio Service

Create `src/services/TwilioService.ts`:

```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default class TwilioService {
  static async sendSms(phone: string, message: string) {
    // Format phone number
    let formattedPhone = phone;
    if (phone.startsWith('0')) {
      formattedPhone = `+27${phone.replace(/^0/, '')}`;
    } else if (!phone.startsWith('+')) {
      formattedPhone = `+${phone}`;
    }

    const result = await client.messages.create({
      body: message,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status
    };
  }

  static async sendWhatsApp(phone: string, message: string) {
    // Format phone number
    let formattedPhone = phone;
    if (phone.startsWith('0')) {
      formattedPhone = `+27${phone.replace(/^0/, '')}`;
    } else if (!phone.startsWith('+')) {
      formattedPhone = `+${phone}`;
    }

    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 
      `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: `whatsapp:${formattedPhone}`
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status
    };
  }

  static async sendWhatsAppTemplate(
    phone: string, 
    contentSid: string, 
    contentVariables?: Record<string, string> | string
  ) {
    // Format phone number
    let formattedPhone = phone;
    if (phone.startsWith('0')) {
      formattedPhone = `+27${phone.replace(/^0/, '')}`;
    } else if (!phone.startsWith('+')) {
      formattedPhone = `+${phone}`;
    }

    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 
      `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

    // Prepare contentVariables
    let contentVariablesString: string | undefined;
    if (contentVariables) {
      if (typeof contentVariables === 'string') {
        contentVariablesString = contentVariables;
      } else {
        contentVariablesString = JSON.stringify(contentVariables);
      }
    }

    const messageOptions: any = {
      from: whatsappFrom,
      to: `whatsapp:${formattedPhone}`,
      contentSid: contentSid
    };

    if (contentVariablesString) {
      messageOptions.contentVariables = contentVariablesString;
    }

    const result = await client.messages.create(messageOptions);

    return {
      success: true,
      messageId: result.sid,
      status: result.status
    };
  }

  static async getMessageStatus(messageId: string) {
    const message = await client.messages(messageId).fetch();
    return {
      messageId: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    };
  }
}
```

### Step 3: Create Controller (Optional - for API endpoints)

Create `src/controllers/TwilioController.ts`:

```typescript
import { Request, Response } from 'express';
import TwilioService from '../services/TwilioService';

export default class TwilioController {
  static async sendSms(req: Request, res: Response) {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        error: 'Missing required fields: phone, message'
      });
    }

    try {
      const result = await TwilioService.sendSms(phone, message);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }

  static async sendWhatsApp(req: Request, res: Response) {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        error: 'Missing required fields: phone, message'
      });
    }

    try {
      const result = await TwilioService.sendWhatsApp(phone, message);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }

  static async sendWhatsAppTemplate(req: Request, res: Response) {
    const { phone, contentSid, contentVariables } = req.body;
    
    if (!phone || !contentSid) {
      return res.status(400).json({
        error: 'Missing required fields: phone, contentSid'
      });
    }

    try {
      const result = await TwilioService.sendWhatsAppTemplate(
        phone, 
        contentSid, 
        contentVariables
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }
}
```

### Step 4: Create Routes (Optional - for API endpoints)

Create `src/routes/TwilioRoutes.ts`:

```typescript
import { Router } from 'express';
import TwilioController from '../controllers/TwilioController';

const router = Router();

router.post('/sms', TwilioController.sendSms);
router.post('/whatsapp', TwilioController.sendWhatsApp);
router.post('/whatsapp/template', TwilioController.sendWhatsAppTemplate);

export { router };
```

### Step 5: Register Routes in Server

In your main server file:

```typescript
import { router as TwilioRoutes } from './routes/TwilioRoutes';

app.use('/api/twilio', TwilioRoutes);
```

## Troubleshooting

### WhatsApp Messages Stay "Queued"

**Problem**: Message status shows "queued" but recipient doesn't receive it.

**Solutions**:
1. **Recipient Not Opted-In** (Error Code 63016):
   - Recipient must send a message to your Twilio WhatsApp number first
   - For sandbox: Recipient sends `join [sandbox-code]` to `whatsapp:+14155238886`
   - Check Twilio Console → Messaging → Try it out for your sandbox code

2. **Check Message Status**:
   ```bash
   POST /api/twilio/check-status
   {
     "messageId": "SM..."
   }
   ```

3. **Check Twilio Console**:
   - Go to Twilio Console → Monitor → Logs → Messaging
   - Look for error codes and messages

### SMS Not Delivering

**Problem**: SMS messages not reaching recipients.

**Solutions**:
1. Verify phone number format (must be E.164: `+[country][number]`)
2. Check Twilio account balance
3. Verify phone number is not blocked
4. Check carrier restrictions
5. Review Twilio Console logs for error codes

### Invalid Phone Number Format

**Problem**: Getting format errors.

**Solution**: Ensure numbers are in E.164 format:
- ✅ Correct: `+27123456789`, `+1234567890`
- ❌ Incorrect: `0712345678`, `1234567890`, `27 12 345 6789`

The integration automatically formats South African numbers (starting with `0`) to `+27[number]`.

### Environment Variables Not Loading

**Problem**: Getting "configuration error" responses.

**Solutions**:
1. Ensure `.env` file exists in project root
2. Verify all required variables are set
3. Restart your server after changing `.env`
4. Check for typos in variable names
5. Ensure no spaces around `=` in `.env` file

### WhatsApp Sandbox Setup

1. Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Note your sandbox number (usually `whatsapp:+14155238886`)
3. Note your join code (e.g., `join abc-xyz`)
4. Set `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` in `.env`
5. Have recipients send `join abc-xyz` to `whatsapp:+14155238886`

## Best Practices

1. **Use Messaging Service SID**: More reliable than direct phone numbers
2. **Handle Errors Gracefully**: Always wrap Twilio calls in try-catch
3. **Log Message SIDs**: Store message SIDs for tracking and debugging
4. **Validate Phone Numbers**: Validate format before sending
5. **Rate Limiting**: Implement rate limiting for production
6. **Opt-in Management**: Track WhatsApp opt-ins in your database
7. **Error Monitoring**: Monitor error codes and handle common ones
8. **Cost Management**: Monitor Twilio usage and costs

## Additional Resources

- [Twilio Node.js Documentation](https://www.twilio.com/docs/libraries/node)
- [Twilio SMS API Reference](https://www.twilio.com/docs/sms/api)
- [Twilio WhatsApp API Reference](https://www.twilio.com/docs/whatsapp/api)
- [Twilio Error Codes](https://www.twilio.com/docs/api/errors)

## Support

For issues specific to this integration, check:
1. Twilio Console → Monitor → Logs
2. Error codes and explanations in responses
3. Twilio documentation for API-specific issues
