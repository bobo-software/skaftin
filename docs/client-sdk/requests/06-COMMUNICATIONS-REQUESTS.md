# Communications Requests (Email, SMS & WhatsApp)

All communications endpoints are available at `/app-api/communications`.

## Base URL
```
/app-api/communications
```

## Authentication
All endpoints require either:
- `x-api-key` header with a valid API key
- `Authorization: Bearer <jwt-token>` header

---

## Email Operations

### 1. Send Email

Send an email using a configured email provider.

**Endpoint:** `POST /app-api/communications/email/send`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "provider_id": 1,
  "to": "recipient@example.com",
  "subject": "Welcome to Our Platform",
  "html": "<h1>Welcome!</h1><p>Thank you for joining us.</p>",
  "text": "Welcome! Thank you for joining us.",
  "cc": "cc@example.com",
  "bcc": ["bcc1@example.com", "bcc2@example.com"],
  "attachments": [
    {
      "filename": "welcome.pdf",
      "content": "base64-encoded-content",
      "encoding": "base64"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| provider_id | number | Yes | Email provider ID |
| to | string or array | Yes | Recipient email(s) |
| subject | string | Yes | Email subject |
| html | string | No | HTML body content |
| text | string | No | Plain text body content |
| cc | string or array | No | CC recipients |
| bcc | string or array | No | BCC recipients |
| attachments | array | No | File attachments |

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "<abc123@mail.example.com>",
    "accepted": ["recipient@example.com"],
    "rejected": []
  }
}
```

---

### Send to Multiple Recipients

```json
{
  "provider_id": 1,
  "to": ["user1@example.com", "user2@example.com", "user3@example.com"],
  "subject": "Announcement",
  "html": "<p>Important update...</p>"
}
```

---

## SMS Operations

### 2. Send Single SMS

Send a single SMS message.

**Endpoint:** `POST /app-api/communications/sms/send-basic`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "destination": "+27821234567",
  "message": "Your verification code is: 123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| destination | string | Yes | Phone number (E.164 format) |
| message | string | Yes | SMS message content |

**Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "messageId": "msg_abc123",
    "status": "sent",
    "destination": "+27821234567"
  }
}
```

---

### 3. Send Bulk SMS

Send multiple SMS messages at once.

**Endpoint:** `POST /app-api/communications/sms/send`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "messages": [
    {
      "destination": "+27821234567",
      "content": "Hello John, your order is ready!"
    },
    {
      "destination": "+27829876543",
      "content": "Hello Jane, your appointment is confirmed."
    },
    {
      "destination": "+27823456789",
      "content": "Hello Bob, please verify your account."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messages | array | Yes | Array of message objects |
| messages[].destination | string | Yes | Phone number |
| messages[].content | string | Yes | Message content |

**Response:**
```json
{
  "success": true,
  "message": "3 SMS messages sent successfully",
  "data": {
    "sent": 3,
    "failed": 0,
    "results": [
      { "destination": "+27821234567", "status": "sent", "messageId": "msg_1" },
      { "destination": "+27829876543", "status": "sent", "messageId": "msg_2" },
      { "destination": "+27823456789", "status": "sent", "messageId": "msg_3" }
    ]
  }
}
```

---

## SMS Provider Management

### 4. List SMS Providers

Get all SMS providers for the project.

**Endpoint:** `GET /app-api/communications/sms/providers`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Primary SMS Provider",
      "provider_type": "mymobileapi",
      "post_url": "https://rest.mymobileapi.com/bulkmessages",
      "messaging_service_sid": null,
      "phone_number": null,
      "whatsapp_from": null,
      "is_active": true,
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "Twilio Provider",
      "provider_type": "twilio",
      "post_url": null,
      "messaging_service_sid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "phone_number": "+1234567890",
      "whatsapp_from": "whatsapp:+14155238886",
      "is_active": true,
      "created_at": "2024-02-01T08:00:00.000Z"
    }
  ]
}
```

---

### 5. Get SMS Provider

Get a specific SMS provider.

**Endpoint:** `GET /app-api/communications/sms/providers/:providerId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (MyMobileAPI):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Primary SMS Provider",
    "provider_type": "mymobileapi",
    "api_key": "your-api-key",
    "api_secret": "your-api-secret",
    "post_url": "https://rest.mymobileapi.com/bulkmessages",
    "messaging_service_sid": null,
    "phone_number": null,
    "whatsapp_from": null,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (Twilio):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Twilio Provider",
    "provider_type": "twilio",
    "api_key": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "api_secret": "auth_token_here",
    "post_url": null,
    "messaging_service_sid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "phone_number": "+1234567890",
    "whatsapp_from": "whatsapp:+14155238886",
    "is_active": true,
    "created_at": "2024-02-01T08:00:00.000Z",
    "updated_at": "2024-02-01T08:00:00.000Z"
  }
}
```

---

### 6. Create SMS Provider

Create a new SMS provider. Supports MyMobileAPI, SA Mobile SMS, and Twilio.

**Endpoint:** `POST /app-api/communications/sms/providers`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body (MyMobileAPI / SA Mobile SMS):**
```json
{
  "name": "My SMS Provider",
  "provider_type": "mymobileapi",
  "api_key": "your-api-key",
  "api_secret": "your-api-secret",
  "post_url": "https://rest.mymobileapi.com/bulkmessages",
  "is_active": true
}
```

**Request Body (Twilio):**
```json
{
  "name": "Twilio Provider",
  "provider_type": "twilio",
  "api_key": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "api_secret": "your_auth_token_here",
  "messaging_service_sid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "phone_number": "+1234567890",
  "whatsapp_from": "whatsapp:+14155238886",
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Provider display name |
| provider_type | string | Yes | `"mymobileapi"`, `"sa_mobile_sms"`, or `"twilio"` |
| api_key | string | Yes | API key (MyMobileAPI/SA Mobile) or Account SID (Twilio) |
| api_secret | string | Yes | API secret (MyMobileAPI/SA Mobile) or Auth Token (Twilio) |
| post_url | string | Conditional | Provider API URL (required for MyMobileAPI/SA Mobile, not needed for Twilio) |
| phone_number | string | Recommended | Twilio From phone number (Twilio only). **Recommended** -- used as the direct sender. |
| messaging_service_sid | string | No | Twilio Messaging Service SID (Twilio only, fallback if no phone_number) |
| whatsapp_from | string | No | WhatsApp sender number e.g. `whatsapp:+14155238886` (Twilio only) |
| is_active | boolean | No | Active status (default: true) |

> **Twilio note:** `phone_number` is the recommended field for sending SMS -- it is used directly as the `From` value and is the most reliable approach. If only `messaging_service_sid` is provided (without `phone_number`), Twilio will select a number from the service's sender pool, which can fail with error 21704 if no numbers are assigned to the pool. The `whatsapp_from` field is needed for WhatsApp messaging; for Twilio Sandbox testing use `whatsapp:+14155238886`.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Twilio Provider",
    "provider_type": "twilio",
    "messaging_service_sid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "phone_number": "+1234567890",
    "whatsapp_from": "whatsapp:+14155238886",
    "is_active": true,
    "created_at": "2026-02-09T10:00:00.000Z",
    "updated_at": "2026-02-09T10:00:00.000Z"
  }
}
```

---

### 7. Update SMS Provider

Update an existing SMS provider.

**Endpoint:** `PUT /app-api/communications/sms/providers/:providerId`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Updated Provider Name",
  "is_active": false
}
```

---

### 8. Delete SMS Provider

Delete an SMS provider.

**Endpoint:** `DELETE /app-api/communications/sms/providers/:providerId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

## SMS Templates

### 9. List SMS Templates

Get all SMS templates.

**Endpoint:** `GET /app-api/communications/sms/templates`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Verification OTP",
      "content": "Your verification code is: {{otp}}. Valid for {{expiry}} minutes.",
      "variables": ["otp", "expiry"],
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "Order Confirmation",
      "content": "Hi {{name}}, your order #{{order_id}} has been confirmed. Total: R{{total}}",
      "variables": ["name", "order_id", "total"],
      "created_at": "2024-01-10T08:00:00.000Z"
    }
  ]
}
```

---

### 10. Get SMS Template

Get a specific SMS template.

**Endpoint:** `GET /app-api/communications/sms/templates/:templateId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

### 11. Create SMS Template

Create a new SMS template.

**Endpoint:** `POST /app-api/communications/sms/templates`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Password Reset",
  "content": "Hi {{name}}, your password reset code is: {{code}}. This code expires in {{expiry}} minutes."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Template name |
| content | string | Yes | Template content with {{variables}} |

**Response:**
```json
{
  "success": true,
  "message": "SMS template created successfully",
  "data": {
    "id": 3,
    "name": "Password Reset",
    "content": "Hi {{name}}, your password reset code is: {{code}}...",
    "variables": ["name", "code", "expiry"]
  }
}
```

---

### 12. Update SMS Template

Update an existing SMS template.

**Endpoint:** `PUT /app-api/communications/sms/templates/:templateId`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Password Reset V2",
  "content": "Your password reset code: {{code}}. Valid for {{expiry}} min."
}
```

---

### 13. Delete SMS Template

Delete an SMS template.

**Endpoint:** `DELETE /app-api/communications/sms/templates/:templateId`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

## WhatsApp Operations (Twilio)

WhatsApp messaging is available when the active SMS provider is Twilio with a `whatsapp_from` number configured. Phone numbers starting with `0` are automatically formatted to `+27` (South Africa).

### 14. Send Single WhatsApp Message

Send a single WhatsApp message.

**Endpoint:** `POST /app-api/communications/whatsapp/send-basic`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "destination": "+27712345678",
  "message": "Hello from Skaftin via WhatsApp!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| destination | string | Yes | Phone number (E.164 format, or SA format like `0712345678`) |
| message | string | Yes | WhatsApp message content |

**Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "to": "whatsapp:+27712345678",
      "from": "whatsapp:+14155238886",
      "sid": "SM1234567890abcdef1234567890abcdef",
      "status": "queued",
      "errorCode": null,
      "errorMessage": null,
      "errorCodeExplanation": null,
      "dateCreated": "2026-02-09T10:00:00.000Z",
      "dateSent": null
    }
  ]
}
```

**Response (Recipient Not Opted In):**
```json
{
  "success": true,
  "data": [
    {
      "to": "whatsapp:+27712345678",
      "from": "whatsapp:+14155238886",
      "sid": "SM1234567890abcdef1234567890abcdef",
      "status": "undelivered",
      "errorCode": 63016,
      "errorCodeExplanation": "Recipient has not opted-in to receive WhatsApp messages. They must send a message to your Twilio WhatsApp number first.",
      "troubleshooting": "To fix this:\n1. Have the recipient send a WhatsApp message to your Twilio WhatsApp number\n2. If using Twilio Sandbox, they need to send: join [your-sandbox-code]\n3. Check your Twilio Console → Messaging → Try it out for the exact opt-in code"
    }
  ]
}
```

---

### 15. Send Bulk WhatsApp Messages

Send multiple WhatsApp messages at once.

**Endpoint:** `POST /app-api/communications/whatsapp/send`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "messages": [
    {
      "destination": "+27712345678",
      "content": "Hi John, your order has been dispatched!"
    },
    {
      "destination": "0829876543",
      "content": "Hi Jane, your appointment is confirmed for tomorrow."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messages | array | Yes | Array of message objects |
| messages[].destination | string | Yes | Phone number |
| messages[].content | string | Yes | Message content |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "to": "whatsapp:+27712345678",
      "from": "whatsapp:+14155238886",
      "sid": "SMabc123...",
      "status": "queued"
    },
    {
      "to": "whatsapp:+27829876543",
      "from": "whatsapp:+14155238886",
      "sid": "SMdef456...",
      "status": "queued"
    }
  ]
}
```

---

### 16. Send WhatsApp Template Message

Send a pre-approved WhatsApp template message using Twilio Content Templates. Templates must be created and approved in the Twilio Console under Content > Content Templates. Each template has a Content SID (starting with `HX`) and can accept variable parameters.

**Endpoint:** `POST /app-api/communications/whatsapp/template`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone | string | Yes | Recipient phone number (E.164 format, or SA format like `0712345678`) |
| contentSid | string | Yes | Twilio Content Template SID (starts with `HX`) |
| contentVariables | object | No | Template variable values keyed by placeholder number (e.g. `"1"` for `{{1}}`) |

> **Note:** `contentVariables` can also be passed as a JSON string: `"{\"1\":\"12/1\",\"2\":\"3pm\"}"`.

**Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "to": "whatsapp:+27712442080",
      "from": "whatsapp:+14155238886",
      "sid": "SM1234567890abcdef1234567890abcdef",
      "status": "queued",
      "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
      "contentVariables": { "1": "12/1", "2": "3pm" },
      "errorCode": null,
      "errorMessage": null,
      "errorCodeExplanation": null,
      "troubleshooting": null,
      "dateCreated": "2026-02-09T10:00:00.000Z",
      "dateSent": null,
      "dateUpdated": "2026-02-09T10:00:00.000Z"
    }
  ]
}
```

**Response (Recipient Not Opted In):**
```json
{
  "success": true,
  "data": [
    {
      "to": "whatsapp:+27712442080",
      "from": "whatsapp:+14155238886",
      "sid": "SM1234567890abcdef1234567890abcdef",
      "status": "undelivered",
      "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
      "errorCode": 63016,
      "errorCodeExplanation": "Recipient has not opted-in to receive WhatsApp messages. They must send a message to your Twilio WhatsApp number first.",
      "troubleshooting": "To fix this:\n1. Have the recipient send a WhatsApp message to your Twilio WhatsApp number\n2. If using Twilio Sandbox, they need to send: join [your-sandbox-code]\n3. Check your Twilio Console → Messaging → Try it out for the exact opt-in code"
    }
  ]
}
```

**Response (Provider Not Supported):**
```json
{
  "success": false,
  "error": "Provider type 'mymobileapi' does not support WhatsApp template messaging. Only Twilio providers support this feature."
}
```

**Getting Your Content Template SID:**
1. Go to Twilio Console → Content → Content Templates
2. Create a new template or select an existing approved template
3. Copy the Content SID (starts with `HX`)
4. Note the template variables (e.g. `{{1}}`, `{{2}}`) and their expected values

> **Important:** WhatsApp templates must be pre-approved by WhatsApp before they can be used. You can create and submit templates in Twilio Console → Content → Content Templates. Freeform messages sent outside the 24-hour customer service window will be rejected -- templates are the only way to initiate a conversation.

---

## Message Status Tracking (Twilio)

Check the delivery status of any SMS or WhatsApp message sent via Twilio using its message SID.

### 17. Check Message Status

**Endpoint:** `POST /app-api/communications/sms/check-status`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "messageSid": "SM1234567890abcdef1234567890abcdef"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messageSid | string | Yes | The Twilio message SID (returned from send operations) |

**Response:**
```json
{
  "success": true,
  "data": {
    "messageSid": "SM1234567890abcdef1234567890abcdef",
    "status": "delivered",
    "to": "+27712345678",
    "from": "+14155238886",
    "body": "Hello from Skaftin!",
    "errorCode": null,
    "errorMessage": null,
    "errorCodeExplanation": null,
    "dateCreated": "2026-02-09T10:00:00.000Z",
    "dateSent": "2026-02-09T10:00:01.000Z",
    "dateUpdated": "2026-02-09T10:00:02.000Z",
    "price": "-0.00750",
    "priceUnit": "USD",
    "statusExplanation": "Message was delivered to recipient",
    "troubleshooting": null
  }
}
```

### Message Statuses

| Status | Description |
|--------|-------------|
| `queued` | Message is queued for sending |
| `sending` | Message is being sent |
| `sent` | Message was sent to the carrier/provider |
| `delivered` | Message was delivered to recipient |
| `read` | Message was read by recipient (WhatsApp only) |
| `undelivered` | Message could not be delivered |
| `failed` | Message failed to send |

---

## Twilio Error Codes

When a Twilio message fails or is undelivered, the response includes an `errorCode` with an explanation:

| Error Code | Description | Solution |
|------------|-------------|----------|
| 21704 | Messaging Service has no phone numbers | Add a phone number to the Messaging Service sender pool, or use a direct `phone_number` instead |
| 63016 | Recipient not opted-in to WhatsApp | Recipient must send a message to your WhatsApp number first |
| 63007 | Invalid WhatsApp number format | Ensure number is in E.164 format (`+[country][number]`) |
| 21608 | Recipient has unsubscribed | Recipient opted out of messages |
| 21610 | Not a valid WhatsApp number | Number does not have WhatsApp |
| 30003 | Unreachable destination | Phone is off or out of coverage |
| 30004 | Message blocked | Carrier or recipient blocked the message |
| 30005 | Unknown destination | Invalid phone number |

> **Note on error 21704:** This is a common issue when `messaging_service_sid` is configured but no phone numbers are assigned to that Messaging Service's sender pool. The message will show status `accepted` initially but then fail. The fix is to either add a phone number to the Messaging Service in the Twilio Console, or configure the provider with a `phone_number` field which is used directly as the sender.

---

## Common Use Cases

### Send Verification OTP via SMS

```bash
curl -X POST "http://localhost:4006/app-api/communications/sms/send-basic" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "destination": "+27821234567",
    "message": "Your verification code is: 123456. Valid for 10 minutes."
  }'
```

### Send Order Notification to Multiple Customers

```bash
curl -X POST "http://localhost:4006/app-api/communications/sms/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "messages": [
      {"destination": "+27821234567", "content": "Your order #1001 has shipped!"},
      {"destination": "+27829876543", "content": "Your order #1002 has shipped!"}
    ]
  }'
```

### Send Welcome Email

```bash
curl -X POST "http://localhost:4006/app-api/communications/email/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "provider_id": 1,
    "to": "newuser@example.com",
    "subject": "Welcome to Our Platform!",
    "html": "<h1>Welcome!</h1><p>We are excited to have you on board.</p>",
    "text": "Welcome! We are excited to have you on board."
  }'
```

### Send Email with Attachment

```bash
curl -X POST "http://localhost:4006/app-api/communications/email/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "provider_id": 1,
    "to": "customer@example.com",
    "subject": "Your Invoice",
    "html": "<p>Please find your invoice attached.</p>",
    "attachments": [
      {
        "filename": "invoice-001.pdf",
        "content": "JVBERi0xLjQK...",
        "encoding": "base64"
      }
    ]
  }'
```

### Send WhatsApp Message

```bash
curl -X POST "http://localhost:4006/app-api/communications/whatsapp/send-basic" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "destination": "0712345678",
    "message": "Hi! Your order has been dispatched and will arrive tomorrow."
  }'
```

### Send WhatsApp to Multiple Recipients

```bash
curl -X POST "http://localhost:4006/app-api/communications/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "messages": [
      {"destination": "+27712345678", "content": "Your appointment is confirmed for 10:00 AM."},
      {"destination": "+27829876543", "content": "Your appointment is confirmed for 11:30 AM."}
    ]
  }'
```

### Send WhatsApp Template Message

```bash
curl -X POST "http://localhost:4006/app-api/communications/whatsapp/template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "phone": "0712442080",
    "contentSid": "HX350d429d32e64a552466cafecbe95f3c",
    "contentVariables": {
      "1": "12/1",
      "2": "3pm"
    }
  }'
```

### Send WhatsApp Template (No Variables)

```bash
curl -X POST "http://localhost:4006/app-api/communications/whatsapp/template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "phone": "+27712345678",
    "contentSid": "HX350d429d32e64a552466cafecbe95f3c"
  }'
```

### Check Message Delivery Status

```bash
curl -X POST "http://localhost:4006/app-api/communications/sms/check-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "messageSid": "SM1234567890abcdef1234567890abcdef"
  }'
```

### Create a Twilio Provider with WhatsApp Support

```bash
curl -X POST "http://localhost:4006/app-api/communications/sms/providers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Twilio (SMS + WhatsApp)",
    "provider_type": "twilio",
    "api_key": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "api_secret": "your_auth_token",
    "phone_number": "+1234567890",
    "whatsapp_from": "whatsapp:+14155238886",
    "is_active": true
  }'
```

---

## Template Variables

SMS templates support variable interpolation using `{{variable}}` syntax:

| Template | Variables | Example Output |
|----------|-----------|----------------|
| `Hi {{name}}, your code is {{code}}` | name, code | "Hi John, your code is 123456" |
| `Order #{{id}} - Total: R{{total}}` | id, total | "Order #1001 - Total: R299.99" |
| `Your appointment is on {{date}} at {{time}}` | date, time | "Your appointment is on 2024-01-15 at 10:00" |

---

## Error Responses

### Provider Not Found
```json
{
  "success": false,
  "error": "SMS provider not found"
}
```

### Invalid Phone Number
```json
{
  "success": false,
  "error": "Phone number must be in E.164 format (e.g., +27821234567)"
}
```

### Provider Inactive
```json
{
  "success": false,
  "error": "No active SMS provider configured for project"
}
```

### WhatsApp Not Supported
```json
{
  "success": false,
  "error": "Provider type 'mymobileapi' does not support WhatsApp messaging. Only Twilio providers support WhatsApp."
}
```

### WhatsApp Templates Not Supported
```json
{
  "success": false,
  "error": "Provider type 'mymobileapi' does not support WhatsApp template messaging. Only Twilio providers support this feature."
}
```

### Message Status Not Supported
```json
{
  "success": false,
  "error": "Provider type 'sa_mobile_sms' does not support message status tracking. Only Twilio providers support this feature."
}
```

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```
