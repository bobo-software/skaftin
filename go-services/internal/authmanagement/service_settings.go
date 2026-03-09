package authmanagement

import (
	"context"
	"fmt"
	"time"

	"github.com/skaftin/go-services/internal/communications"
)

func (s *Service) GetAuthSettings(ctx context.Context, projectID int) (*AuthSettings, error) {
	as, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if as == nil {
		return s.store.UpsertAuthSettings(ctx, projectID)
	}
	return as, nil
}

func (s *Service) UpdateAuthSettings(ctx context.Context, projectID int, fields map[string]any) (*AuthSettings, error) {
	allowed := map[string]bool{
		"auth_enabled": true, "registration_enabled": true, "email_provider_id": true,
		"sms_provider_id": true, "send_registration_email": true, "send_registration_sms": true,
		"send_verification_email": true, "send_verification_sms": true,
		"send_password_reset_email": true, "send_password_reset_sms": true,
		"send_welcome_email": true, "send_welcome_sms": true,
		"require_email": true, "require_email_verification": true, "require_phone_verification": true, "otp_length": true,
		"default_role_id": true, "enable_password_reset": true, "require_otp_for_password_change": true,
		"require_otp_for_account_deletion": true, "allow_duplicate_emails": true,
		"enable_mfa": true,
	}
	filtered := make(map[string]any)
	for k, v := range fields {
		if allowed[k] {
			filtered[k] = v
		}
	}
	return s.store.UpdateAuthSettings(ctx, projectID, filtered)
}

func (s *Service) GetEmailProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	return s.store.GetEmailProviders(ctx, projectID)
}

func (s *Service) GetSmsProviders(ctx context.Context, projectID int) ([]map[string]any, error) {
	return s.store.GetSmsProviders(ctx, projectID)
}

func (s *Service) GetAllSessionDurations(ctx context.Context, projectID int) ([]map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetAllSessionDurations(ctx, schema)
}

func (s *Service) GetSessionConfig(ctx context.Context, projectID, roleID int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRole(ctx, schema, roleID)
}

func (s *Service) TestEmailProvider(ctx context.Context, projectID, providerID int, testEmail string) error {
	if s.comms == nil {
		return fmt.Errorf("communications service not available")
	}
	_, err := s.comms.SendEmail(ctx, projectID, providerID, []string{testEmail}, nil, nil,
		"Test Email", "This is a test email from Skaftin", "<p>This is a test email from Skaftin</p>", nil)
	return err
}

func (s *Service) SendVerificationEmail(ctx context.Context, projectID int, schema string, userIDOrEmail string) error {
	return fmt.Errorf("not yet implemented via Go; use Node proxy")
}

func (s *Service) SendPasswordResetEmail(ctx context.Context, projectID int, schema string, userIDOrEmail string) error {
	return fmt.Errorf("not yet implemented via Go; use Node proxy")
}

func (s *Service) VerifyOTPForSettings(ctx context.Context, projectID int, userID int, code string) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	otp, err := s.store.GetPendingOTP(ctx, schema, userID, "")
	if err != nil {
		return err
	}
	if otp == nil {
		return fmt.Errorf("no pending OTP found")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP has expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP code")
	}
	if err := s.store.MarkOTPVerified(ctx, schema, otp.ID); err != nil {
		return err
	}
	return s.store.ActivateUser(ctx, schema, userID, true, true)
}

func (s *Service) TestSmsProvider(ctx context.Context, projectID int, providerID int, phone, message string) error {
	if s.comms == nil {
		return fmt.Errorf("communications service not available")
	}
	_, err := s.comms.SendSMS(ctx, projectID, []communications.SmsMessage{{Content: message, Destination: phone}})
	return err
}
