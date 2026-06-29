package authmanagement

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
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
		"google_sign_in_enabled": true, "google_web_client_ids": true, "google_auto_register": true,
		"apple_sign_in_enabled": true, "apple_client_ids": true, "apple_auto_register": true,
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
	settings, err := s.GetAuthSettings(ctx, projectID)
	if err != nil {
		return err
	}
	if settings == nil || !settings.SendVerificationEmail {
		return ErrSettingsVerificationEmailDisabled
	}
	if settings.EmailProviderID == nil {
		return ErrSettingsProviderNotConfigured
	}
	if s.comms == nil {
		return fmt.Errorf("%w: communications service unavailable", ErrSettingsDeliveryFailed)
	}

	user, destination, err := s.resolveSettingsRecipient(ctx, schema, userIDOrEmail)
	if err != nil {
		return err
	}

	otpLen := 6
	if settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	code, err := GenerateOTP(otpLen)
	if err != nil {
		return fmt.Errorf("failed to generate verification OTP: %w", err)
	}

	metadataRaw, err := json.Marshal(map[string]any{
		"trigger": "settings_send_verification",
	})
	if err != nil {
		return fmt.Errorf("failed to build verification metadata: %w", err)
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	if err := s.store.CreateOTP(ctx, schema, user.ID, code, "email", destination, expiresAt, "", metadataRaw); err != nil {
		return fmt.Errorf("failed to create verification OTP: %w", err)
	}

	subject := "Verify your email"
	textBody := fmt.Sprintf("Your verification OTP is %s. It expires in 10 minutes.", code)
	htmlBody := fmt.Sprintf("<p>Your verification OTP is <strong>%s</strong>.</p><p>It expires in 10 minutes.</p>", code)
	if _, err := s.comms.SendEmail(ctx, projectID, *settings.EmailProviderID, []string{destination}, nil, nil, subject, textBody, htmlBody, nil); err != nil {
		slog.Warn("settings verification email delivery failed",
			"projectId", projectID,
			"userId", user.ID,
			"email", destination,
			"providerId", *settings.EmailProviderID,
			"error", err,
		)
		return fmt.Errorf("%w: %v", ErrSettingsDeliveryFailed, err)
	}

	return nil
}

func (s *Service) SendPasswordResetEmail(ctx context.Context, projectID int, schema string, userIDOrEmail string) error {
	settings, err := s.GetAuthSettings(ctx, projectID)
	if err != nil {
		return err
	}
	if settings == nil || !settings.SendPasswordResetEmail {
		return ErrSettingsPasswordResetEmailDisabled
	}
	if settings.EmailProviderID == nil {
		return ErrSettingsProviderNotConfigured
	}
	if s.comms == nil {
		return fmt.Errorf("%w: communications service unavailable", ErrSettingsDeliveryFailed)
	}

	user, destination, err := s.resolveSettingsRecipient(ctx, schema, userIDOrEmail)
	if err != nil {
		return err
	}

	otpLen := 6
	if settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	code, err := GenerateOTP(otpLen)
	if err != nil {
		return fmt.Errorf("failed to generate password-reset OTP: %w", err)
	}

	if err := s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_reset"); err != nil {
		return fmt.Errorf("failed to expire prior password-reset OTPs: %w", err)
	}
	metadataRaw, err := json.Marshal(map[string]any{
		"trigger": "settings_send_reset",
	})
	if err != nil {
		return fmt.Errorf("failed to build password-reset metadata: %w", err)
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	if err := s.store.CreateOTP(ctx, schema, user.ID, code, "email", destination, expiresAt, "password_reset", metadataRaw); err != nil {
		return fmt.Errorf("failed to create password-reset OTP: %w", err)
	}

	subject := "Your password reset OTP"
	textBody := fmt.Sprintf("Your password reset OTP is %s. It expires in 10 minutes.", code)
	htmlBody := fmt.Sprintf("<p>Your password reset OTP is <strong>%s</strong>.</p><p>It expires in 10 minutes.</p>", code)
	if _, err := s.comms.SendEmail(ctx, projectID, *settings.EmailProviderID, []string{destination}, nil, nil, subject, textBody, htmlBody, nil); err != nil {
		slog.Warn("settings password-reset email delivery failed",
			"projectId", projectID,
			"userId", user.ID,
			"email", destination,
			"providerId", *settings.EmailProviderID,
			"error", err,
		)
		return fmt.Errorf("%w: %v", ErrSettingsDeliveryFailed, err)
	}

	return nil
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

func (s *Service) resolveSettingsRecipient(ctx context.Context, schema, userIDOrEmail string) (*AppUser, string, error) {
	identifier := strings.TrimSpace(userIDOrEmail)
	if identifier == "" {
		return nil, "", ErrSettingsRecipientRequired
	}

	var (
		user *AppUser
		err  error
	)
	if parsedID, parseErr := strconv.Atoi(identifier); parseErr == nil {
		if parsedID <= 0 {
			return nil, "", ErrSettingsRecipientInvalid
		}
		user, err = s.store.GetUser(ctx, schema, parsedID)
	} else {
		user, err = s.store.GetUserByEmail(ctx, schema, identifier)
	}
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", ErrSettingsUserNotFound
	}
	if user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return nil, "", ErrSettingsRecipientHasNoEmail
	}
	return user, strings.TrimSpace(*user.Email), nil
}
