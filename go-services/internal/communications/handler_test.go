package communications

import "testing"

func TestValidateEmailProviderConfig_RejectsLegacyType(t *testing.T) {
	err := validateEmailProviderConfig(EmailProvider{
		Name:         "Legacy",
		ProviderType: "nodemailer",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUser:     "user",
		SMTPPassword: "pass",
		FromEmail:    "noreply@example.com",
	})
	if err == nil {
		t.Fatalf("expected legacy provider type to be rejected")
	}
}

func TestValidateEmailProviderConfig_SMTPValid(t *testing.T) {
	err := validateEmailProviderConfig(EmailProvider{
		Name:         "SMTP Provider",
		ProviderType: EmailProviderTypeSMTP,
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUser:     "user",
		SMTPPassword: "pass",
		FromEmail:    "noreply@example.com",
	})
	if err != nil {
		t.Fatalf("expected smtp provider to be valid, got: %v", err)
	}
}

func TestValidateEmailProviderConfig_AWSSESValid(t *testing.T) {
	err := validateEmailProviderConfig(EmailProvider{
		Name:         "SES Provider",
		ProviderType: EmailProviderTypeAWSSES,
		SMTPHost:     "eu-west-2",
		SMTPUser:     "AKIAEXAMPLE",
		SMTPPassword: "secret",
		FromEmail:    "noreply@example.com",
	})
	if err != nil {
		t.Fatalf("expected aws_ses provider to be valid, got: %v", err)
	}
}
