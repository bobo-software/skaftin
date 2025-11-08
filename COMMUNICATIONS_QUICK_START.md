# Communications Feature - Quick Start Guide

## 🚀 Get Started in 3 Minutes

### Step 1: Start the Application

```bash
# Start backend
npm run dev

# In a new terminal, start frontend
cd frontend
npm run dev
```

The backend will automatically create the `email_providers` table on startup.

---

### Step 2: Navigate to Communications

1. Open your browser and go to your Skaftin application
2. Login to your account
3. Select a project or create a new one
4. Click on **"Communications"** in the sidebar (below Storage)

---

### Step 3: Add Your First Email Provider

#### Option A: Using Mailtrap (Recommended for Testing)

1. Click **"Add Provider"**
2. Select **"Mailtrap"** provider type (pre-fills SMTP settings)
3. Fill in the required fields:
   - **Provider Name**: "Mailtrap Testing"
   - **SMTP Host**: `sandbox.smtp.mailtrap.io` (auto-filled)
   - **SMTP Port**: `2525` (auto-filled)
   - **SMTP Username**: Your Mailtrap username
   - **SMTP Password**: Your Mailtrap password
   - **From Email**: `noreply@yourapp.com`
   - **From Name**: "Your App Name" (optional)
4. Click **"Test Connection"** to verify credentials
5. Click **"Create Provider"**

**Get Mailtrap Credentials:**
- Sign up at [mailtrap.io](https://mailtrap.io) (free)
- Go to Email Testing → Inboxes → Your Inbox
- Copy the Username and Password from SMTP Settings

#### Option B: Using Gmail (Production Ready)

1. Click **"Add Provider"**
2. Select **"Nodemailer"** provider type
3. Fill in the fields:
   - **Provider Name**: "Gmail SMTP"
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **Use TLS/SSL**: Unchecked (TLS on port 587)
   - **SMTP Username**: Your Gmail address
   - **SMTP Password**: Your Gmail App Password (not regular password)
   - **From Email**: Your Gmail address
   - **From Name**: "Your App Name" (optional)
4. Click **"Test Connection"**
5. Click **"Create Provider"**

**Get Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Search for "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in the provider configuration

---

## 📧 Sending Your First Email

### Using the API

```bash
curl -X POST http://localhost:3000/api/communications/YOUR_PROJECT_ID/email/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 1,
    "to": "recipient@example.com",
    "subject": "Hello from Skaftin!",
    "text": "This is a test email from the communications system.",
    "html": "<h1>Hello!</h1><p>This is a test email from the communications system.</p>"
  }'
```

### Using JavaScript/TypeScript

```typescript
// Example: Send email from your application
const sendEmail = async () => {
  const response = await fetch(
    `http://localhost:3000/api/communications/${projectId}/email/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider_id: 1, // Your provider ID
        to: 'user@example.com',
        subject: 'Welcome to Our Platform',
        html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
        text: 'Welcome! Thank you for signing up.',
      }),
    }
  );
  
  const result = await response.json();
  console.log('Email sent:', result);
};
```

---

## 🎯 Common Use Cases

### 1. Welcome Emails
Send welcome emails to new users:

```json
{
  "provider_id": 1,
  "to": "newuser@example.com",
  "subject": "Welcome to Our Platform!",
  "html": "<h1>Welcome!</h1><p>We're excited to have you on board.</p>"
}
```

### 2. Password Reset
Send password reset links:

```json
{
  "provider_id": 1,
  "to": "user@example.com",
  "subject": "Reset Your Password",
  "html": "<p>Click <a href='https://yourapp.com/reset?token=xyz'>here</a> to reset your password.</p>"
}
```

### 3. Notifications
Send notification emails:

```json
{
  "provider_id": 1,
  "to": "user@example.com",
  "subject": "New Message Received",
  "html": "<p>You have a new message from John Doe.</p>"
}
```

### 4. Bulk Emails
Send to multiple recipients:

```json
{
  "provider_id": 1,
  "to": ["user1@example.com", "user2@example.com", "user3@example.com"],
  "subject": "Monthly Newsletter",
  "html": "<h1>This Month's Updates</h1><p>Check out what's new...</p>"
}
```

### 5. Emails with Attachments
Send files with your emails:

```json
{
  "provider_id": 1,
  "to": "user@example.com",
  "subject": "Your Invoice",
  "html": "<p>Please find your invoice attached.</p>",
  "attachments": [
    {
      "filename": "invoice.pdf",
      "content": "base64-encoded-pdf-content",
      "encoding": "base64"
    }
  ]
}
```

---

## 🔧 Managing Providers

### Edit a Provider
1. Click the **Edit** (pencil) icon on any provider
2. Modify the fields you want to change
3. Leave password blank to keep the existing password
4. Click **"Update Provider"**

### Test Connection
1. Click the **Test** (test tube) icon
2. System will verify SMTP credentials
3. Success or error message will appear

### Activate/Deactivate
1. Click the **Power** icon to toggle provider status
2. Deactivated providers cannot be used for sending emails
3. Use this instead of deleting when you want to temporarily disable a provider

### Delete a Provider
1. Click the **Delete** (trash) icon
2. Confirm the deletion
3. ⚠️ Warning: This action cannot be undone

---

## 🛠️ Troubleshooting

### "Connection failed" Error

**Issue**: SMTP credentials are invalid or connection settings are wrong

**Solutions**:
1. Verify SMTP host and port are correct
2. Check if username and password are correct
3. For Gmail:
   - Use an App Password, not your regular password
   - Ensure 2-Step Verification is enabled
4. For Mailtrap:
   - Copy credentials directly from Mailtrap dashboard
   - Ensure you're using the correct inbox credentials

### "Failed to send email" Error

**Issue**: Provider is inactive or email data is invalid

**Solutions**:
1. Check if provider is active (green badge)
2. Verify recipient email is valid
3. Ensure subject and body are not empty
4. Check if from_email is allowed by your SMTP server

### "Provider already exists" Error

**Issue**: Provider name must be unique per project

**Solution**: Choose a different name or edit the existing provider

### Port 587 vs 465 vs 25

- **Port 587** (STARTTLS): Use with `smtp_secure: false` - Most common, recommended
- **Port 465** (SSL): Use with `smtp_secure: true` - Deprecated but still works
- **Port 25** (Unencrypted): Rarely used, often blocked by ISPs

---

## 📊 Testing with Mailtrap

Mailtrap is perfect for testing because:
- ✅ Emails don't actually get delivered to real inboxes
- ✅ You can inspect all email details (headers, HTML, text)
- ✅ Test spam score and email client compatibility
- ✅ Free tier includes 500 emails/month

**Workflow:**
1. Configure Mailtrap provider in Skaftin
2. Send test emails via API
3. Check Mailtrap inbox to see how emails look
4. Verify HTML rendering, links, and formatting
5. When ready, switch to production provider (Gmail, SendGrid, etc.)

---

## 🚀 Production Deployment

### Recommended Providers for Production

1. **SendGrid** - Enterprise-grade, great deliverability
   - 100 free emails/day
   - Excellent analytics

2. **AWS SES** - Cost-effective for high volume
   - $0.10 per 1,000 emails
   - Requires AWS account

3. **Mailgun** - Developer-friendly
   - 5,000 free emails/month
   - Good API

4. **Gmail** - Easy setup for small projects
   - Free with limits
   - May hit sending limits

### Security Best Practices

1. **Never commit SMTP passwords** to version control
2. **Use environment variables** for production credentials
3. **Enable TLS/SSL** when possible
4. **Rotate passwords** regularly
5. **Monitor email sending** for abuse
6. **Implement rate limiting** to prevent spam
7. **Use dedicated email provider** (don't use personal Gmail for production)

---

## 📚 API Reference

### Send Email Endpoint

```
POST /api/communications/:projectId/email/send
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "provider_id": 1,           // Required: Provider ID to use
  "to": "user@example.com",   // Required: Recipient(s)
  "subject": "Hello",         // Required: Email subject
  "text": "Plain text",       // Required if html is not provided
  "html": "<p>HTML</p>",      // Required if text is not provided
  "cc": "cc@example.com",     // Optional: CC recipients
  "bcc": "bcc@example.com",   // Optional: BCC recipients
  "attachments": []           // Optional: File attachments
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "<unique-message-id>",
    "accepted": ["user@example.com"],
    "rejected": []
  }
}
```

---

## 🎉 You're All Set!

Your communications system is now ready to send emails. Start with Mailtrap for testing, then switch to a production provider when you're ready.

**Need Help?**
- Check the full documentation: `COMMUNICATIONS_FEATURE_SUMMARY.md`
- Review example code in this guide
- Test connection before going live

Happy emailing! 📧

