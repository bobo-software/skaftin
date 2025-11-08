# MCP Communications Tools Documentation

## Overview
MCP (Model Context Protocol) tools for managing email communications in Skaftin platform. These tools enable AI assistants and external applications to manage email providers and send emails programmatically.

---

## Available Tools

### 1. list_email_providers
List all email providers configured for a project.

**Parameters:**
- `projectId` (string, required) - Project ID

**Example:**
```json
{
  "name": "list_email_providers",
  "arguments": {
    "projectId": "1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "id": 1,
      "project_id": "1",
      "name": "Gmail SMTP",
      "provider_type": "nodemailer",
      "smtp_host": "smtp.gmail.com",
      "smtp_port": 587,
      "smtp_secure": false,
      "smtp_user": "user@gmail.com",
      "from_email": "user@gmail.com",
      "from_name": "My App",
      "is_active": true,
      "created_at": "2025-11-08T07:00:00Z",
      "updated_at": "2025-11-08T07:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 2. get_email_provider
Get details of a specific email provider.

**Parameters:**
- `projectId` (string, required) - Project ID
- `providerId` (string, required) - Email provider ID

**Example:**
```json
{
  "name": "get_email_provider",
  "arguments": {
    "projectId": "1",
    "providerId": "1"
  }
}
```

---

### 3. create_email_provider
Create a new email provider (SMTP configuration).

**Parameters:**
- `projectId` (string, required) - Project ID
- `name` (string, required) - Provider name
- `provider_type` (string, required) - "nodemailer" or "mailtrap"
- `smtp_host` (string, required) - SMTP host
- `smtp_port` (number, required) - SMTP port (587, 465, 2525, or 25)
- `smtp_secure` (boolean, required) - Use SSL/TLS (true for port 465, false for 587)
- `smtp_user` (string, required) - SMTP username
- `smtp_password` (string, required) - SMTP password
- `from_email` (string, required) - From email address
- `from_name` (string, optional) - From name
- `is_active` (boolean, optional) - Whether provider is active (default: true)

**Example (Gmail):**
```json
{
  "name": "create_email_provider",
  "arguments": {
    "projectId": "1",
    "name": "Gmail SMTP",
    "provider_type": "nodemailer",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_secure": false,
    "smtp_user": "your-email@gmail.com",
    "smtp_password": "your-app-password",
    "from_email": "your-email@gmail.com",
    "from_name": "My Application",
    "is_active": true
  }
}
```

**Example (Mailtrap):**
```json
{
  "name": "create_email_provider",
  "arguments": {
    "projectId": "1",
    "name": "Mailtrap Testing",
    "provider_type": "mailtrap",
    "smtp_host": "sandbox.smtp.mailtrap.io",
    "smtp_port": 2525,
    "smtp_secure": false,
    "smtp_user": "your-mailtrap-username",
    "smtp_password": "your-mailtrap-password",
    "from_email": "noreply@yourapp.com",
    "from_name": "Test App"
  }
}
```

---

### 4. update_email_provider
Update an existing email provider.

**Parameters:**
- `projectId` (string, required) - Project ID
- `providerId` (string, required) - Email provider ID
- All other fields from create_email_provider are optional

**Example:**
```json
{
  "name": "update_email_provider",
  "arguments": {
    "projectId": "1",
    "providerId": "1",
    "from_name": "Updated App Name",
    "is_active": true
  }
}
```

**Note:** Leave `smtp_password` empty to keep the existing password.

---

### 5. delete_email_provider
Delete an email provider.

**Parameters:**
- `projectId` (string, required) - Project ID
- `providerId` (string, required) - Email provider ID

**Example:**
```json
{
  "name": "delete_email_provider",
  "arguments": {
    "projectId": "1",
    "providerId": "1"
  }
}
```

---

### 6. test_email_connection
Test SMTP connection for an email provider.

**Parameters:**
- `projectId` (string, required) - Project ID
- `providerId` (string, required) - Email provider ID

**Example:**
```json
{
  "name": "test_email_connection",
  "arguments": {
    "projectId": "1",
    "providerId": "1"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Connection failed",
  "message": "Connection timeout"
}
```

---

### 7. send_email
Send an email using a configured email provider.

**Parameters:**
- `projectId` (string, required) - Project ID
- `provider_id` (number, required) - Email provider ID to use
- `to` (string or array, required) - Recipient email address(es)
- `subject` (string, required) - Email subject
- `text` (string, optional) - Plain text email body
- `html` (string, optional) - HTML email body
- `cc` (string or array, optional) - CC recipients
- `bcc` (string or array, optional) - BCC recipients
- `attachments` (array, optional) - Email attachments

**Note:** Either `text` or `html` must be provided.

**Example (Simple Email):**
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": "user@example.com",
    "subject": "Welcome to Our Platform",
    "text": "Thank you for signing up!",
    "html": "<h1>Welcome!</h1><p>Thank you for signing up.</p>"
  }
}
```

**Example (Multiple Recipients):**
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": ["user1@example.com", "user2@example.com"],
    "cc": "manager@example.com",
    "bcc": "admin@example.com",
    "subject": "Team Update",
    "html": "<p>Important team announcement...</p>"
  }
}
```

**Example (With Attachments):**
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": "client@example.com",
    "subject": "Your Invoice",
    "html": "<p>Please find your invoice attached.</p>",
    "attachments": [
      {
        "filename": "invoice.pdf",
        "content": "base64-encoded-content-here",
        "encoding": "base64"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<unique-message-id@domain.com>",
  "accepted": ["user@example.com"],
  "rejected": []
}
```

---

## Common Use Cases

### 1. Automated Welcome Emails
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": "newuser@example.com",
    "subject": "Welcome to Our Platform!",
    "html": "<h1>Welcome!</h1><p>We're excited to have you on board.</p>"
  }
}
```

### 2. Password Reset Notifications
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": "user@example.com",
    "subject": "Reset Your Password",
    "html": "<p>Click <a href='https://yourapp.com/reset?token=xyz'>here</a> to reset your password.</p>"
  }
}
```

### 3. Transaction Receipts
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": "customer@example.com",
    "subject": "Payment Received",
    "html": "<h2>Thank you for your payment</h2><p>Amount: $99.99</p>",
    "attachments": [
      {
        "filename": "receipt.pdf",
        "content": "base64-encoded-receipt",
        "encoding": "base64"
      }
    ]
  }
}
```

### 4. Bulk Notifications
```json
{
  "name": "send_email",
  "arguments": {
    "projectId": "1",
    "provider_id": 1,
    "to": ["user1@example.com", "user2@example.com", "user3@example.com"],
    "subject": "System Maintenance Notice",
    "html": "<p>Our system will undergo maintenance on Sunday...</p>"
  }
}
```

---

## SMTP Port Configuration Guide

| Port | Type | Secure | Use Case |
|------|------|--------|----------|
| **587** | STARTTLS | `false` | **Recommended** - Most widely supported |
| **465** | SSL/TLS | `true` | Direct encryption, older standard |
| **2525** | Alternative | `false` | Used by Mailtrap and some services |
| **25** | Unencrypted | `false` | Often blocked by ISPs |

---

## Popular Email Provider Configurations

### Gmail
```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_secure": false,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "your-app-password"
}
```

**Note:** Use [App Password](https://support.google.com/accounts/answer/185833), not regular password.

### Outlook/Office 365
```json
{
  "smtp_host": "smtp-mail.outlook.com",
  "smtp_port": 587,
  "smtp_secure": false,
  "smtp_user": "your-email@outlook.com",
  "smtp_password": "your-password"
}
```

### Mailtrap (Testing)
```json
{
  "smtp_host": "sandbox.smtp.mailtrap.io",
  "smtp_port": 2525,
  "smtp_secure": false,
  "smtp_user": "your-mailtrap-username",
  "smtp_password": "your-mailtrap-password"
}
```

### SendGrid
```json
{
  "smtp_host": "smtp.sendgrid.net",
  "smtp_port": 587,
  "smtp_secure": false,
  "smtp_user": "apikey",
  "smtp_password": "your-sendgrid-api-key"
}
```

---

## Error Handling

All tools return responses in the following format:

**Success:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common Errors

1. **"Email provider not found"** - Invalid provider ID or project ID
2. **"Connection timeout"** - Wrong SMTP host/port or firewall blocking
3. **"Authentication failed"** - Invalid username/password
4. **"Email provider is not active"** - Provider is disabled
5. **"Connection failed"** - SMTP server unreachable

---

## Security Notes

1. **Passwords are stored encrypted** in the database
2. **All MCP tools require proper authentication** via SuperTokens
3. **Project isolation** - Users can only access their own projects
4. **Never log passwords** - Passwords are redacted from logs
5. **Use App Passwords** for Gmail and similar services

---

## Testing Workflow

1. **Create a Mailtrap account** (free tier available)
2. **Configure Mailtrap provider** in your project
3. **Test sending emails** - they'll appear in Mailtrap inbox
4. **Verify email rendering** - check HTML, links, attachments
5. **Switch to production provider** when ready (Gmail, SendGrid, etc.)

---

## Integration Examples

### Using with AI Assistants

```typescript
// AI can send welcome emails automatically
await mcpClient.callTool({
  name: 'send_email',
  arguments: {
    projectId: userProject.id,
    provider_id: 1,
    to: newUser.email,
    subject: 'Welcome!',
    html: generateWelcomeEmail(newUser.name)
  }
});
```

### Using in Workflows

```typescript
// Send notification when payment is received
async function onPaymentReceived(payment) {
  await mcpClient.callTool({
    name: 'send_email',
    arguments: {
      projectId: payment.projectId,
      provider_id: 1,
      to: payment.customerEmail,
      subject: 'Payment Received',
      html: generateReceipt(payment),
      attachments: [
        {
          filename: 'receipt.pdf',
          content: await generatePdfReceipt(payment),
          encoding: 'base64'
        }
      ]
    }
  });
}
```

---

## Summary

The MCP Communications Tools provide a complete email management system for AI assistants and applications:

- ✅ **7 tools** for email provider management and sending
- ✅ **Support for popular providers** (Gmail, Outlook, SendGrid, Mailtrap)
- ✅ **HTML emails** with attachments
- ✅ **Multiple recipients** (to, cc, bcc)
- ✅ **Connection testing** before going live
- ✅ **Project isolation** for security
- ✅ **Full CRUD operations** for providers

Start with Mailtrap for testing, then switch to production providers when ready! 🚀

