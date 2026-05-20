package authmanagement

import "errors"

var (
	ErrInvalidCredentials        = errors.New("invalid credentials")
	ErrAuthenticationClosed      = errors.New("authentication is disabled")
	ErrMissingLoginIdentity      = errors.New("user has no email or phone identity configured for login")
	ErrGoogleSignInDisabled      = errors.New("Google sign-in is disabled for this project")
	ErrInvalidGoogleToken        = errors.New("invalid or expired Google token")
	ErrGoogleAutoRegisterDisabled = errors.New("registration is disabled for this project")

	ErrSettingsRecipientRequired          = errors.New("user_id_or_email, user_id, or email is required")
	ErrSettingsRecipientInvalid           = errors.New("invalid user identifier")
	ErrSettingsUserNotFound               = errors.New("user not found")
	ErrSettingsRecipientHasNoEmail        = errors.New("user does not have an email address")
	ErrSettingsVerificationEmailDisabled  = errors.New("email verification is not enabled for this project")
	ErrSettingsPasswordResetEmailDisabled = errors.New("password reset emails are not enabled for this project")
	ErrSettingsProviderNotConfigured      = errors.New("email provider not configured. please configure an email provider first")
	ErrSettingsDeliveryFailed             = errors.New("failed to send email")
)
