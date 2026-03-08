# Email SMTP Integration Guide (Node API -> Go Server)

This document explains how the current SMTP email integration works in this API and how to implement the same pattern in a Go server.

## Provider Type Mapping (Current Go Backend)

Email providers are now strictly separated by `provider_type`:

- `smtp` for standard SMTP servers
- `mailtrap` for Mailtrap SMTP
- `aws_ses` for AWS SES API sending

Legacy values (`nodemailer`, `simple`) are deprecated and rejected by the API.

## 1) What was integrated

The API now sends all emails through Nodemailer using SMTP credentials from `.env`:

- Shared email sender service: `src/services/EmailService.ts`
- Controller endpoints: `src/controllers/EmailController.ts`
- Routes: `src/routes/emailRouter.ts`
- Scheduled communication job also uses same sender: `src/jobs/CommunicationJobs.ts`

### Current API endpoints

- `POST /api/email/send_email` (existing, auth required)
  - body: `recipients`, `subject`, `body`
- `POST /api/email/test_send_email` (new test route)
  - body: `email`, `message`

## 2) Environment variables

These are the SMTP-related env vars now used:

```env
EMAIL_SMTP_HOST=mail.example.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_SMTP_AUTH_USER=your-user@example.com
EMAIL_SMTP_AUTH_PASSWORD=your-smtp-password
EMAIL_FROM_NAME=Taxi Admin
EMAIL_FROM_ADDRESS=your-user@example.com
```

### Behavior notes

- `EMAIL_SMTP_SECURE=true` is typically for port `465` (SMTPS).
- For port `587`, use `EMAIL_SMTP_SECURE=false` (STARTTLS).
- `EMAIL_FROM_ADDRESS` falls back to `EMAIL_SMTP_AUTH_USER` if not set.

## 3) How the flow works

1. API receives request.
2. Controller validates required fields.
3. Controller calls shared email service.
4. Email service builds SMTP transporter from env.
5. Service sends plain-text email and returns provider response.
6. Controller returns standardized success/error response.

Using one email service keeps transport config centralized and reusable for:

- normal API sends
- test sends
- OTP/welcome/password reset
- cron/scheduled email sends

## 4) Request examples

### Test route

`POST /api/email/test_send_email`

```json
{
  "email": "recipient@example.com",
  "message": "SMTP test from Taxi Admin API"
}
```

### Main send route

`POST /api/email/send_email`

```json
{
  "recipients": ["a@example.com", "b@example.com"],
  "subject": "System Notice",
  "body": "Hello team, this is a scheduled update."
}
```

## 5) Equivalent implementation in Go

Below is a simple Go version using [`gopkg.in/mail.v2`](https://pkg.go.dev/gopkg.in/mail.v2).

```go
package mailer

import (
	"crypto/tls"
	"fmt"
	"os"
	"strconv"
	"strings"

	gomail "gopkg.in/mail.v2"
)

type SMTPConfig struct {
	Host       string
	Port       int
	Secure     bool
	AuthUser   string
	AuthPass   string
	FromName   string
	FromEmail  string
}

func LoadSMTPConfig() (*SMTPConfig, error) {
	port, err := strconv.Atoi(getEnv("EMAIL_SMTP_PORT", "587"))
	if err != nil {
		return nil, fmt.Errorf("invalid EMAIL_SMTP_PORT: %w", err)
	}

	secure := strings.ToLower(getEnv("EMAIL_SMTP_SECURE", "false")) == "true"
	authUser := os.Getenv("EMAIL_SMTP_AUTH_USER")
	fromEmail := getEnv("EMAIL_FROM_ADDRESS", authUser)

	if fromEmail == "" {
		return nil, fmt.Errorf("EMAIL_FROM_ADDRESS or EMAIL_SMTP_AUTH_USER must be set")
	}

	return &SMTPConfig{
		Host:      getEnv("EMAIL_SMTP_HOST", "smtp.gmail.com"),
		Port:      port,
		Secure:    secure,
		AuthUser:  authUser,
		AuthPass:  os.Getenv("EMAIL_SMTP_AUTH_PASSWORD"),
		FromName:  getEnv("EMAIL_FROM_NAME", "Taxi Admin"),
		FromEmail: fromEmail,
	}, nil
}

func SendPlainTextEmail(cfg *SMTPConfig, to []string, subject, body string) error {
	m := gomail.NewMessage()
	m.SetAddressHeader("From", cfg.FromEmail, cfg.FromName)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	d := gomail.NewDialer(cfg.Host, cfg.Port, cfg.AuthUser, cfg.AuthPass)
	d.SSL = cfg.Secure

	// STARTTLS support for non-SSL flows (e.g. 587)
	d.TLSConfig = &tls.Config{
		ServerName: cfg.Host,
	}

	return d.DialAndSend(m)
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
```

## 6) Go HTTP test endpoint example

```go
type TestEmailRequest struct {
	Email   string `json:"email"`
	Message string `json:"message"`
}

func TestSendEmailHandler(w http.ResponseWriter, r *http.Request) {
	var req TestEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Message == "" {
		http.Error(w, "email and message are required", http.StatusBadRequest)
		return
	}

	cfg, err := LoadSMTPConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := SendPlainTextEmail(cfg, []string{req.Email}, "Taxi Admin SMTP Test", req.Message); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"success":true,"message":"Test email sent successfully"}`))
}
```

## 7) Production checklist

- Use app passwords or SMTP credentials (never normal mailbox passwords).
- Keep all SMTP secrets only in environment variables.
- Add request validation and rate limiting to test endpoint.
- Log email provider response IDs for troubleshooting.
- Consider queue/retry logic for transient SMTP failures.

