# Communications Requests (Email & SMS)

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
  "content": "Your verification code is: 123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| destination | string | Yes | Phone number (E.164 format) |
| content | string | Yes | SMS message content |

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
      "is_active": true,
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "Backup SMS Provider",
      "provider_type": "sa_mobile_sms",
      "is_active": false,
      "created_at": "2024-01-10T08:00:00.000Z"
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Primary SMS Provider",
    "provider_type": "mymobileapi",
    "api_key": "sk_***hidden***",
    "post_url": "https://api.mymobileapi.com/sms/send",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 6. Create SMS Provider

Create a new SMS provider.

**Endpoint:** `POST /app-api/communications/sms/providers`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "My SMS Provider",
  "provider_type": "mymobileapi",
  "api_key": "your-api-key",
  "api_secret": "your-api-secret",
  "post_url": "https://api.mymobileapi.com/sms/send",
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Provider display name |
| provider_type | string | Yes | "mymobileapi" or "sa_mobile_sms" |
| api_key | string | Yes | API key from provider |
| api_secret | string | Yes | API secret from provider |
| post_url | string | Yes | Provider's API endpoint URL |
| is_active | boolean | No | Active status (default: true) |

**Response:**
```json
{
  "success": true,
  "message": "SMS provider created successfully",
  "data": {
    "id": 3,
    "name": "My SMS Provider",
    ...
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

## Common Use Cases

### Send Verification OTP via SMS

```bash
curl -X POST "http://localhost:4006/app-api/communications/sms/send-basic" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "destination": "+27821234567",
    "content": "Your verification code is: 123456. Valid for 10 minutes."
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
  "message": "SMS provider not found"
}
```

### Invalid Phone Number
```json
{
  "success": false,
  "message": "Invalid phone number format",
  "error": "Phone number must be in E.164 format (e.g., +27821234567)"
}
```

### Provider Inactive
```json
{
  "success": false,
  "message": "No active SMS provider found for this project"
}
```

### Rate Limit Exceeded
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later."
}
```
