package communications

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// SendSMTPMessage sends one email using SMTP credentials on p (smtp or mailtrap).
// p must have SMTPHost, SMTPPort, SMTPUser, SMTPPassword, SMTPSecure, FromEmail set and IsActive true.
// ctx is reserved for future cancellation/timeouts; SMTP send honors internal stage timeouts.
func SendSMTPMessage(ctx context.Context, p *EmailProvider, to []string, cc []string, bcc []string, subject string, textBody string, htmlBody string) error {
	_ = ctx
	if p == nil {
		return errors.New("nil email provider")
	}
	if p.ProviderType != EmailProviderTypeSMTP && p.ProviderType != EmailProviderTypeMailtrap {
		return fmt.Errorf("unsupported provider_type for SendSMTPMessage: %s", p.ProviderType)
	}
	if p.SMTPHost == "" || p.SMTPPort <= 0 || p.FromEmail == "" {
		return errors.New("incomplete SMTP provider (host, port, from_email required)")
	}
	if len(to) == 0 {
		return errors.New("no recipients")
	}

	messageID := fmt.Sprintf("<skaftin-platform-%d@%s>", time.Now().UnixNano(), p.SMTPHost)
	raw, err := buildEmailMessage(p.FromEmail, to, cc, subject, textBody, htmlBody, nil, messageID)
	if err != nil {
		return err
	}

	recipients := append([]string{}, to...)
	recipients = append(recipients, cc...)
	recipients = append(recipients, bcc...)

	return sendEmailWithSMTPTimeout(p, recipients, raw, defaultSMTPSendTimeouts())
}
