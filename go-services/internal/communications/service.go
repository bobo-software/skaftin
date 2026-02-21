package communications

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/smtp"
	"net/textproto"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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
	conn, err := smtp.Dial(fmt.Sprintf("%s:%d", p.SMTPHost, p.SMTPPort))
	if err != nil {
		return false, err
	}
	defer conn.Close()
	if err := conn.Hello("localhost"); err != nil {
		return false, err
	}
	if ok, _ := conn.Extension("STARTTLS"); ok && p.SMTPSecure {
		_ = conn.StartTLS(nil)
	}
	if p.SMTPUser != "" && p.SMTPPassword != "" {
		auth := smtp.PlainAuth("", p.SMTPUser, p.SMTPPassword, p.SMTPHost)
		if err := conn.Auth(auth); err != nil {
			return false, err
		}
	}
	return true, nil
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

	messageID := fmt.Sprintf("<skaftin-%d@%s>", time.Now().UnixNano(), p.SMTPHost)
	raw, err := buildEmailMessage(p.FromEmail, to, cc, subject, text, html, attachments, messageID)
	if err != nil {
		return nil, err
	}

	auth := smtp.PlainAuth("", p.SMTPUser, p.SMTPPassword, p.SMTPHost)
	recipients := append([]string{}, to...)
	recipients = append(recipients, cc...)
	recipients = append(recipients, bcc...)
	err = smtp.SendMail(fmt.Sprintf("%s:%d", p.SMTPHost, p.SMTPPort), auth, p.FromEmail, recipients, raw)
	if err != nil {
		return nil, err
	}
	return map[string]any{"messageId": messageID, "accepted": recipients, "rejected": []string{}}, nil
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
