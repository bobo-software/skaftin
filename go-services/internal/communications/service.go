package communications

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime/multipart"
	"net"
	"net/http"
	"net/smtp"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// General command deadline for SMTP stages.
	smtpCommandTimeout = 25 * time.Second
	// DATA close waits for server final acceptance; remote domains can take longer.
	smtpDataCloseTimeout = 90 * time.Second
)

// Service contains business logic for email/SMS dispatch and template rendering.
type Service struct {
	store *Store
}

// NewService creates a new communications Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

func (s *Service) ListEmailProviders(ctx context.Context, projectID int) ([]EmailProvider, error) {
	return s.store.ListEmailProviders(ctx, projectID)
}

func (s *Service) GetEmailProvider(ctx context.Context, projectID, providerID int) (*EmailProvider, error) {
	return s.store.GetEmailProvider(ctx, projectID, providerID, false)
}

func (s *Service) CreateEmailProvider(ctx context.Context, projectID int, in EmailProvider) (*EmailProvider, error) {
	return s.store.CreateEmailProvider(ctx, projectID, in)
}

func (s *Service) UpdateEmailProvider(ctx context.Context, projectID, providerID int, fields map[string]any) (*EmailProvider, error) {
	return s.store.UpdateEmailProvider(ctx, projectID, providerID, fields)
}

func (s *Service) DeleteEmailProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	return s.store.DeleteEmailProvider(ctx, projectID, providerID)
}

func (s *Service) TestEmailProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	p, err := s.store.GetEmailProvider(ctx, projectID, providerID, true)
	if err != nil || p == nil {
		return false, err
	}

	switch p.ProviderType {
	case EmailProviderTypeAWSSES:
		_, err := buildSESClient(ctx, p)
		return err == nil, err
	case EmailProviderTypeSMTP, EmailProviderTypeMailtrap:
		err = sendSMTPHandshakeWithFailover(p, 20*time.Second)
		return err == nil, err
	default:
		return false, fmt.Errorf("unsupported email provider_type: %s", p.ProviderType)
	}
}

func (s *Service) SendEmail(ctx context.Context, projectID int, providerID int, to []string, cc []string, bcc []string, subject string, text, html string, attachments []EmailAttachment) (map[string]any, error) {
	p, err := s.store.GetEmailProvider(ctx, projectID, providerID, true)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("Email provider not found")
	}
	if !p.IsActive {
		return nil, errors.New("Email provider is not active")
	}

	switch p.ProviderType {
	case EmailProviderTypeAWSSES:
		return s.sendEmailViaSES(ctx, p, to, subject, html, text)
	case EmailProviderTypeSMTP, EmailProviderTypeMailtrap:
		// Continue with SMTP send path below.
	default:
		return nil, fmt.Errorf("unsupported email provider_type: %s", p.ProviderType)
	}

	messageID := fmt.Sprintf("<skaftin-%d@%s>", time.Now().UnixNano(), p.SMTPHost)
	raw, err := buildEmailMessage(p.FromEmail, to, cc, subject, text, html, attachments, messageID)
	if err != nil {
		return nil, err
	}

	recipients := append([]string{}, to...)
	recipients = append(recipients, cc...)
	recipients = append(recipients, bcc...)

	if err := sendEmailWithSMTPTimeout(p, recipients, raw, smtpCommandTimeout); err != nil {
		return nil, err
	}

	return map[string]any{"messageId": messageID, "accepted": recipients, "rejected": []string{}}, nil
}

// buildSESClient creates an AWS SES v2 client using credentials stored on the provider.
// smtp_host = AWS region, smtp_user = access key ID, smtp_password = secret access key.
func buildSESClient(ctx context.Context, p *EmailProvider) (*sesv2.Client, error) {
	region := p.SMTPHost
	if region == "" {
		region = "eu-west-2"
	}
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(p.SMTPUser, p.SMTPPassword, ""),
		),
	)
	if err != nil {
		return nil, err
	}
	return sesv2.NewFromConfig(cfg), nil
}

func (s *Service) sendEmailViaSES(ctx context.Context, p *EmailProvider, to []string, subject, htmlBody, textBody string) (map[string]any, error) {
	client, err := buildSESClient(ctx, p)
	if err != nil {
		return nil, err
	}

	if htmlBody == "" {
		htmlBody = textBody
	}
	if textBody == "" {
		textBody = htmlBody
	}

	input := &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(p.FromEmail),
		Destination: &types.Destination{
			ToAddresses: to,
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data:    aws.String(subject),
					Charset: aws.String("UTF-8"),
				},
				Body: &types.Body{
					Html: &types.Content{
						Data:    aws.String(htmlBody),
						Charset: aws.String("UTF-8"),
					},
					Text: &types.Content{
						Data:    aws.String(textBody),
						Charset: aws.String("UTF-8"),
					},
				},
			},
		},
	}

	out, err := client.SendEmail(ctx, input)
	if err != nil {
		return nil, err
	}

	messageID := ""
	if out.MessageId != nil {
		messageID = *out.MessageId
	}
	return map[string]any{"messageId": messageID, "accepted": to, "rejected": []string{}}, nil
}

func openSMTPClient(p *EmailProvider, timeout time.Duration) (*smtp.Client, net.Conn, error) {
	address := net.JoinHostPort(p.SMTPHost, strconv.Itoa(p.SMTPPort))
	dialer := &net.Dialer{Timeout: timeout}
	deadline := time.Now().Add(timeout)

	// Port 465 typically requires implicit TLS from connect time.
	if p.SMTPSecure && p.SMTPPort == 465 {
		tlsConn, err := tls.DialWithDialer(dialer, "tcp", address, &tls.Config{ServerName: p.SMTPHost})
		if err != nil {
			return nil, nil, err
		}
		_ = tlsConn.SetDeadline(deadline)
		client, err := smtp.NewClient(tlsConn, p.SMTPHost)
		if err != nil {
			tlsConn.Close()
			return nil, nil, err
		}
		return client, tlsConn, nil
	}

	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		return nil, nil, err
	}
	_ = conn.SetDeadline(deadline)
	client, err := smtp.NewClient(conn, p.SMTPHost)
	if err != nil {
		conn.Close()
		return nil, nil, err
	}
	return client, conn, nil
}

func isNetworkTimeout(err error) bool {
	if err == nil {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "i/o timeout")
}

func fallbackSMTPProvider(p *EmailProvider) *EmailProvider {
	fallback := *p
	if p.SMTPPort == 465 {
		// 587 with STARTTLS is the most common fallback when implicit TLS is blocked.
		fallback.SMTPPort = 587
		fallback.SMTPSecure = false
		return &fallback
	}
	if p.SMTPPort == 587 {
		// Try implicit TLS when STARTTLS route is blocked.
		fallback.SMTPPort = 465
		fallback.SMTPSecure = true
		return &fallback
	}
	return nil
}

func shouldUseStartTLS(p *EmailProvider, client *smtp.Client) bool {
	// For implicit TLS (465), TLS is already established at dial time.
	if p.SMTPSecure && p.SMTPPort == 465 {
		return false
	}
	ok, _ := client.Extension("STARTTLS")
	return ok
}

func sendSMTPHandshakeOnce(p *EmailProvider, timeout time.Duration) error {
	client, conn, err := openSMTPClient(p, timeout)
	if err != nil {
		return err
	}
	defer conn.Close()
	defer client.Close()

	if err := client.Hello("localhost"); err != nil {
		return err
	}
	if shouldUseStartTLS(p, client) {
		if err := client.StartTLS(&tls.Config{ServerName: p.SMTPHost}); err != nil {
			return err
		}
	}
	if p.SMTPUser != "" && p.SMTPPassword != "" {
		auth := smtp.PlainAuth("", p.SMTPUser, p.SMTPPassword, p.SMTPHost)
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	return nil
}

func sendSMTPHandshakeWithFailover(p *EmailProvider, timeout time.Duration) error {
	err := sendSMTPHandshakeOnce(p, timeout)
	if err == nil || !isNetworkTimeout(err) {
		return err
	}
	fallback := fallbackSMTPProvider(p)
	if fallback == nil {
		return err
	}
	fallbackErr := sendSMTPHandshakeOnce(fallback, timeout)
	if fallbackErr == nil {
		return nil
	}
	return err
}

func sendEmailWithSMTPTimeout(p *EmailProvider, recipients []string, raw []byte, timeout time.Duration) error {
	start := time.Now()
	slog.Info("smtp send attempt started",
		"host", p.SMTPHost,
		"port", p.SMTPPort,
		"secure", p.SMTPSecure,
		"recipientCount", len(recipients),
	)

	err := sendEmailWithSMTPTimeoutOnce(p, recipients, raw, timeout)
	if err == nil || !isNetworkTimeout(err) {
		if err == nil {
			slog.Info("smtp send attempt succeeded",
				"host", p.SMTPHost,
				"port", p.SMTPPort,
				"secure", p.SMTPSecure,
				"durationMs", time.Since(start).Milliseconds(),
			)
		} else {
			slog.Error("smtp send attempt failed without fallback",
				"host", p.SMTPHost,
				"port", p.SMTPPort,
				"secure", p.SMTPSecure,
				"durationMs", time.Since(start).Milliseconds(),
				"error", err,
			)
		}
		return err
	}

	fallback := fallbackSMTPProvider(p)
	if fallback == nil {
		slog.Error("smtp timeout and no fallback profile",
			"host", p.SMTPHost,
			"port", p.SMTPPort,
			"secure", p.SMTPSecure,
			"error", err,
		)
		return err
	}

	slog.Warn("smtp timeout detected, trying fallback profile",
		"primaryHost", p.SMTPHost,
		"primaryPort", p.SMTPPort,
		"primarySecure", p.SMTPSecure,
		"fallbackHost", fallback.SMTPHost,
		"fallbackPort", fallback.SMTPPort,
		"fallbackSecure", fallback.SMTPSecure,
		"primaryError", err.Error(),
	)

	fallbackErr := sendEmailWithSMTPTimeoutOnce(fallback, recipients, raw, timeout)
	if fallbackErr == nil {
		slog.Info("smtp send succeeded with fallback profile",
			"host", fallback.SMTPHost,
			"port", fallback.SMTPPort,
			"secure", fallback.SMTPSecure,
			"durationMs", time.Since(start).Milliseconds(),
		)
		return nil
	}

	slog.Error("smtp send failed on primary and fallback profiles",
		"primaryHost", p.SMTPHost,
		"primaryPort", p.SMTPPort,
		"primarySecure", p.SMTPSecure,
		"primaryError", err,
		"fallbackHost", fallback.SMTPHost,
		"fallbackPort", fallback.SMTPPort,
		"fallbackSecure", fallback.SMTPSecure,
		"fallbackError", fallbackErr,
		"durationMs", time.Since(start).Milliseconds(),
	)

	// Keep original timeout error for clearer diagnosis of primary profile failure.
	return err
}

func sendEmailWithSMTPTimeoutOnce(p *EmailProvider, recipients []string, raw []byte, timeout time.Duration) error {
	client, conn, err := openSMTPClient(p, timeout)
	if err != nil {
		return fmt.Errorf("smtp connect failed: %w", err)
	}
	defer conn.Close()
	defer client.Close()

	setStageDeadline := func() {
		_ = conn.SetDeadline(time.Now().Add(timeout))
	}
	setCustomDeadline := func(d time.Duration) {
		_ = conn.SetDeadline(time.Now().Add(d))
	}

	setStageDeadline()
	if err := client.Hello("localhost"); err != nil {
		return fmt.Errorf("smtp hello failed: %w", err)
	}
	if shouldUseStartTLS(p, client) {
		setStageDeadline()
		if err := client.StartTLS(&tls.Config{ServerName: p.SMTPHost}); err != nil {
			return fmt.Errorf("smtp starttls failed: %w", err)
		}
	}
	if p.SMTPUser != "" && p.SMTPPassword != "" {
		auth := smtp.PlainAuth("", p.SMTPUser, p.SMTPPassword, p.SMTPHost)
		setStageDeadline()
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth failed: %w", err)
		}
	}

	setStageDeadline()
	if err := client.Mail(p.FromEmail); err != nil {
		return fmt.Errorf("smtp mail from failed: %w", err)
	}
	for _, rcpt := range recipients {
		setStageDeadline()
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("smtp rcpt to %q failed: %w", rcpt, err)
		}
	}
	setStageDeadline()
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data open failed: %w", err)
	}
	setStageDeadline()
	if _, err := writer.Write(raw); err != nil {
		_ = writer.Close()
		return fmt.Errorf("smtp data write failed: %w", err)
	}
	setCustomDeadline(smtpDataCloseTimeout)
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp data close failed: %w", err)
	}
	setStageDeadline()
	if err := client.Quit(); err != nil {
		return fmt.Errorf("smtp quit failed: %w", err)
	}
	return nil
}

func (s *Service) ListEmailTemplates(ctx context.Context, projectID int) ([]EmailTemplate, error) {
	return s.store.ListEmailTemplates(ctx, projectID)
}

func (s *Service) GetEmailTemplate(ctx context.Context, projectID, templateID int) (*EmailTemplate, error) {
	return s.store.GetEmailTemplate(ctx, projectID, templateID)
}

func (s *Service) CreateEmailTemplate(ctx context.Context, projectID int, name, subject string, htmlContent, textContent *string, vars []string) (*EmailTemplate, error) {
	return s.store.CreateEmailTemplate(ctx, projectID, name, subject, htmlContent, textContent, vars)
}

func (s *Service) UpdateEmailTemplate(ctx context.Context, projectID, templateID int, fields map[string]any) (*EmailTemplate, error) {
	return s.store.UpdateEmailTemplate(ctx, projectID, templateID, fields)
}

func (s *Service) DeleteEmailTemplate(ctx context.Context, projectID, templateID int) (bool, error) {
	return s.store.DeleteEmailTemplate(ctx, projectID, templateID)
}

func (s *Service) ListSMSTemplates(ctx context.Context, projectID int) ([]SMSTemplate, error) {
	return s.store.ListSMSTemplates(ctx, projectID)
}

func (s *Service) GetSMSTemplate(ctx context.Context, projectID, templateID int) (*SMSTemplate, error) {
	return s.store.GetSMSTemplate(ctx, projectID, templateID)
}

func (s *Service) CreateSMSTemplate(ctx context.Context, projectID int, name, content string, vars []string) (*SMSTemplate, error) {
	return s.store.CreateSMSTemplate(ctx, projectID, name, content, vars)
}

func (s *Service) UpdateSMSTemplate(ctx context.Context, projectID, templateID int, fields map[string]any) (*SMSTemplate, error) {
	return s.store.UpdateSMSTemplate(ctx, projectID, templateID, fields)
}

func (s *Service) DeleteSMSTemplate(ctx context.Context, projectID, templateID int) (bool, error) {
	return s.store.DeleteSMSTemplate(ctx, projectID, templateID)
}

func (s *Service) ListSMSProviders(ctx context.Context, projectID int) ([]SMSProvider, error) {
	return s.store.ListSMSProviders(ctx, projectID)
}

func (s *Service) GetSMSProvider(ctx context.Context, projectID, providerID int) (*SMSProvider, error) {
	return s.store.GetSMSProvider(ctx, projectID, providerID, true)
}

func (s *Service) CreateSMSProvider(ctx context.Context, projectID int, p SMSProvider) (*SMSProvider, error) {
	return s.store.CreateSMSProvider(ctx, projectID, p)
}

func (s *Service) UpdateSMSProvider(ctx context.Context, projectID, providerID int, fields map[string]any) (*SMSProvider, error) {
	return s.store.UpdateSMSProvider(ctx, projectID, providerID, fields)
}

func (s *Service) DeleteSMSProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	return s.store.DeleteSMSProvider(ctx, projectID, providerID)
}

func (s *Service) SendSMS(ctx context.Context, projectID int, messages []SmsMessage) (any, error) {
	provider, err := s.store.GetActiveSMSProvider(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, errors.New("No active SMS provider configured for project")
	}
	return sendViaProvider(provider, messages, false, "")
}

func (s *Service) SendWhatsApp(ctx context.Context, projectID int, messages []SmsMessage) (any, error) {
	provider, err := s.store.GetActiveSMSProvider(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, errors.New("No active SMS provider configured for project")
	}
	return sendViaProvider(provider, messages, true, "")
}

func (s *Service) SendWhatsAppTemplate(ctx context.Context, projectID int, msg WhatsAppTemplateMessage) (any, error) {
	provider, err := s.store.GetActiveSMSProvider(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, errors.New("No active SMS provider configured for project")
	}
	if provider.ProviderType != "twilio" || provider.APIKey == nil || provider.APISecret == nil {
		return nil, errors.New("Provider does not support WhatsApp template messaging. Only Twilio providers support this feature.")
	}
	from := ""
	if provider.WhatsAppFrom != nil && *provider.WhatsAppFrom != "" {
		from = *provider.WhatsAppFrom
	} else if provider.PhoneNumber != nil && *provider.PhoneNumber != "" {
		from = "whatsapp:" + formatPhone(*provider.PhoneNumber)
	}
	if from == "" {
		return nil, errors.New("Twilio WhatsApp requires a whatsapp_from number or a phone_number configured on the provider")
	}
	form := url.Values{}
	form.Set("To", "whatsapp:"+formatPhone(msg.Destination))
	form.Set("From", from)
	form.Set("ContentSid", msg.ContentSID)
	if msg.ContentVariables != nil {
		b, _ := json.Marshal(msg.ContentVariables)
		form.Set("ContentVariables", string(b))
	}
	resp, err := twilioPost(*provider.APIKey, *provider.APISecret, form)
	if err != nil {
		return nil, err
	}
	return []any{resp}, nil
}

func (s *Service) GetMessageStatus(ctx context.Context, projectID int, messageSid string) (any, error) {
	provider, err := s.store.GetActiveSMSProvider(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, errors.New("No active SMS provider configured for project")
	}
	if provider.ProviderType != "twilio" || provider.APIKey == nil || provider.APISecret == nil {
		return nil, errors.New("Provider does not support message status tracking. Only Twilio providers support this feature.")
	}
	url := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages/%s.json", *provider.APIKey, messageSid)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.SetBasicAuth(*provider.APIKey, *provider.APISecret)
	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	errorCode, _ := payload["error_code"].(float64)
	errorInfo := twilioErrorInfo(int(errorCode))
	status, _ := payload["status"].(string)
	return map[string]any{
		"messageSid":           payload["sid"],
		"status":               payload["status"],
		"to":                   payload["to"],
		"from":                 payload["from"],
		"body":                 payload["body"],
		"errorCode":            payload["error_code"],
		"errorMessage":         payload["error_message"],
		"dateCreated":          payload["date_created"],
		"dateSent":             payload["date_sent"],
		"dateUpdated":          payload["date_updated"],
		"price":                payload["price"],
		"priceUnit":            payload["price_unit"],
		"errorCodeExplanation": errorInfo["explanation"],
		"statusExplanation":    twilioStatusExplanation(status),
		"troubleshooting":      errorInfo["troubleshooting"],
	}, nil
}

func sendViaProvider(provider *SMSProvider, messages []SmsMessage, whatsapp bool, bodyOverride string) (any, error) {
	switch provider.ProviderType {
	case "mymobileapi", "sa_mobile_sms":
		if provider.PostURL == nil || provider.APIKey == nil || provider.APISecret == nil {
			return nil, errors.New("Missing provider credentials")
		}
		payload := map[string]any{"messages": messages}
		b, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, *provider.PostURL, strings.NewReader(string(b)))
		req.Header.Set("Content-Type", "application/json")
		creds := base64.StdEncoding.EncodeToString([]byte(*provider.APIKey + ":" + *provider.APISecret))
		req.Header.Set("Authorization", "Basic "+creds)
		client := &http.Client{}
		res, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer res.Body.Close()
		var payloadResp any
		_ = json.NewDecoder(res.Body).Decode(&payloadResp)
		if res.StatusCode >= 400 {
			return nil, fmt.Errorf("%v", payloadResp)
		}
		return payloadResp, nil
	case "twilio":
		if provider.APIKey == nil || provider.APISecret == nil {
			return nil, errors.New("Missing Twilio credentials")
		}
		results := make([]any, 0, len(messages))
		for _, m := range messages {
			form := url.Values{}
			to := formatPhone(m.Destination)
			if whatsapp {
				to = "whatsapp:" + to
			}
			form.Set("To", to)
			if bodyOverride != "" {
				form.Set("Body", bodyOverride)
			} else {
				form.Set("Body", m.Content)
			}
			if whatsapp {
				if provider.WhatsAppFrom != nil && *provider.WhatsAppFrom != "" {
					form.Set("From", *provider.WhatsAppFrom)
				} else if provider.PhoneNumber != nil && *provider.PhoneNumber != "" {
					form.Set("From", "whatsapp:"+formatPhone(*provider.PhoneNumber))
				}
			} else if provider.PhoneNumber != nil && *provider.PhoneNumber != "" {
				form.Set("From", formatPhone(*provider.PhoneNumber))
			} else if provider.MessagingServiceSID != nil && *provider.MessagingServiceSID != "" {
				form.Set("MessagingServiceSid", *provider.MessagingServiceSID)
			}
			resp, err := twilioPost(*provider.APIKey, *provider.APISecret, form)
			if err != nil {
				return nil, err
			}
			results = append(results, resp)
		}
		return results, nil
	default:
		return nil, fmt.Errorf("Unsupported SMS provider_type: %s", provider.ProviderType)
	}
}

func twilioPost(accountSID, authToken string, form url.Values) (map[string]any, error) {
	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSID)
	req, _ := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(accountSID, authToken)
	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var payload map[string]any
	_ = json.NewDecoder(res.Body).Decode(&payload)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("%v", payload)
	}
	return payload, nil
}

func formatPhone(phone string) string {
	p := strings.TrimSpace(phone)
	if strings.HasPrefix(p, "0") {
		return "+27" + strings.TrimPrefix(p, "0")
	}
	if strings.HasPrefix(p, "+") {
		return p
	}
	return "+" + p
}

func buildEmailMessage(from string, to []string, cc []string, subject, text, html string, attachments []EmailAttachment, messageID string) ([]byte, error) {
	var buf bytes.Buffer
	mainWriter := multipart.NewWriter(&buf)
	altBoundary := "alt_" + strings.ReplaceAll(mainWriter.Boundary(), "-", "")

	headers := map[string]string{
		"From":         from,
		"To":           strings.Join(to, ", "),
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Message-ID":   messageID,
		"Content-Type": fmt.Sprintf("multipart/mixed; boundary=%s", mainWriter.Boundary()),
	}
	if len(cc) > 0 {
		headers["Cc"] = strings.Join(cc, ", ")
	}
	for k, v := range headers {
		buf.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	buf.WriteString("\r\n")

	altHeader := textproto.MIMEHeader{}
	altHeader.Set("Content-Type", fmt.Sprintf("multipart/alternative; boundary=%s", altBoundary))
	altPart, err := mainWriter.CreatePart(altHeader)
	if err != nil {
		return nil, err
	}

	writePart := func(contentType, content string) error {
		if content == "" {
			return nil
		}
		_, err := fmt.Fprintf(altPart, "--%s\r\nContent-Type: %s; charset=utf-8\r\n\r\n%s\r\n", altBoundary, contentType, content)
		return err
	}
	if text == "" && html != "" {
		text = html
	}
	if err := writePart("text/plain", text); err != nil {
		return nil, err
	}
	if err := writePart("text/html", html); err != nil {
		return nil, err
	}
	if _, err := fmt.Fprintf(altPart, "--%s--\r\n", altBoundary); err != nil {
		return nil, err
	}

	for _, a := range attachments {
		if a.Filename == "" {
			continue
		}
		contentBytes := []byte(a.Content)
		if strings.EqualFold(a.Encoding, "base64") {
			decoded, err := base64.StdEncoding.DecodeString(a.Content)
			if err == nil {
				contentBytes = decoded
			}
		}
		pHeader := textproto.MIMEHeader{}
		pHeader.Set("Content-Type", "application/octet-stream")
		pHeader.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, a.Filename))
		pHeader.Set("Content-Transfer-Encoding", "base64")
		part, err := mainWriter.CreatePart(pHeader)
		if err != nil {
			return nil, err
		}
		encoded := make([]byte, base64.StdEncoding.EncodedLen(len(contentBytes)))
		base64.StdEncoding.Encode(encoded, contentBytes)
		if _, err := part.Write(encoded); err != nil {
			return nil, err
		}
	}

	if err := mainWriter.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func twilioStatusExplanation(status string) string {
	statusMap := map[string]string{
		"queued":      "Message is queued for sending",
		"sending":     "Message is being sent",
		"sent":        "Message was sent to the carrier/provider",
		"delivered":   "Message was delivered to recipient",
		"undelivered": "Message could not be delivered",
		"failed":      "Message failed to send",
		"received":    "Inbound message was received",
		"read":        "Message was read by the recipient (WhatsApp only)",
	}
	return statusMap[status]
}

func twilioErrorInfo(code int) map[string]any {
	errMap := map[int]map[string]any{
		63016: {"explanation": "Recipient has not opted-in to receive WhatsApp messages.", "troubleshooting": "Recipient must message your Twilio WhatsApp sender first."},
		63007: {"explanation": "Invalid WhatsApp number format.", "troubleshooting": "Use E.164 format (+countrycode...)."},
		21608: {"explanation": "Recipient has unsubscribed/opted out of messages."},
		21610: {"explanation": "Destination number is not a valid WhatsApp number."},
		30003: {"explanation": "Unreachable destination handset."},
		30004: {"explanation": "Message blocked by carrier or recipient filtering."},
		30005: {"explanation": "Unknown destination number."},
		21704: {"explanation": "Messaging Service has no sender numbers.", "troubleshooting": "Add a sender phone number in Twilio Console."},
	}
	if v, ok := errMap[code]; ok {
		return v
	}
	return map[string]any{}
}
