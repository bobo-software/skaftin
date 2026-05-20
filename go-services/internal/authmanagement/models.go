package authmanagement

import (
	"encoding/json"
	"time"
)

type AppUser struct {
	ID                   int              `json:"id"`
	SupertokensUserID    *string          `json:"supertokens_user_id"`
	Name                 string           `json:"name"`
	LastName             *string          `json:"last_name"`
	Email                *string          `json:"email"`
	Password             *string          `json:"password"`
	Phone                *string          `json:"phone"`
	Metadata             json.RawMessage  `json:"metadata"`
	OrganisationID       *string          `json:"organisation_id"`
	IsActive             bool             `json:"is_active"`
	EmailVerified        bool             `json:"email_verified"`
	PhoneVerified        bool             `json:"phone_verified"`
	DeletionRequestedAt  *time.Time       `json:"deletion_requested_at"`
	DeletionScheduledAt  *time.Time       `json:"deletion_scheduled_at"`
	DeletionReason       *string          `json:"deletion_reason"`
	DeletedAt            *time.Time       `json:"deleted_at"`
	CreatedAt            *time.Time       `json:"created_at"`
	UpdatedAt            *time.Time       `json:"updated_at"`
	CustomField1         *string          `json:"custom_field_1"`
	CustomField2         *string          `json:"custom_field_2"`
	Roles                json.RawMessage  `json:"roles"`
}

type Role struct {
	ID                       int              `json:"id"`
	RoleName                 string           `json:"role_name"`
	RoleKey                  string           `json:"role_key"`
	Description              *string          `json:"description,omitempty"`
	Permissions              json.RawMessage  `json:"permissions"`
	SessionDurationMinutes   int              `json:"session_duration_minutes"`
	IsSystemRole             bool             `json:"is_system_role"`
	OrganisationFieldName    *string          `json:"organisation_field_name,omitempty"`
	OrganisationLookupTable  *string          `json:"organisation_lookup_table,omitempty"`
	OrganisationLookupField  *string          `json:"organisation_lookup_field,omitempty"`
	CreatedAt                *time.Time       `json:"created_at,omitempty"`
	UpdatedAt                *time.Time       `json:"updated_at,omitempty"`
	UserCount                *int             `json:"user_count,omitempty"`
}

type CustomField struct {
	ID              int              `json:"id"`
	FieldName       string           `json:"field_name"`
	FieldLabel      string           `json:"field_label"`
	FieldType       string           `json:"field_type"`
	IsRequired      bool             `json:"is_required"`
	DefaultValue    *string          `json:"default_value,omitempty"`
	Options         json.RawMessage  `json:"options,omitempty"`
	ReferenceTable  *string          `json:"reference_table,omitempty"`
	ReferenceColumn *string          `json:"reference_column,omitempty"`
	ValidationRules json.RawMessage  `json:"validation_rules,omitempty"`
	DisplayOrder    int              `json:"display_order"`
	IsActive        bool             `json:"is_active"`
	CreatedAt       *time.Time       `json:"created_at,omitempty"`
	UpdatedAt       *time.Time       `json:"updated_at,omitempty"`
}

type AuthSettings struct {
	ID                          int              `json:"id"`
	ProjectID                   int              `json:"project_id"`
	AllowDuplicateEmails        bool             `json:"allow_duplicate_emails"`
	RequireEmailVerification    bool             `json:"require_email_verification"`
	RequirePhoneVerification    bool             `json:"require_phone_verification"`
	EnablePasswordReset         bool             `json:"enable_password_reset"`
	EnableMFA                   bool             `json:"enable_mfa"`
	RegistrationEnabled         bool             `json:"registration_enabled"`
	AuthEnabled                 bool             `json:"auth_enabled"`
	DefaultRoleID               *int             `json:"default_role_id"`
	EmailProviderID             *int             `json:"email_provider_id"`
	SmsProviderID               *int             `json:"sms_provider_id"`
	SendRegistrationEmail       bool             `json:"send_registration_email"`
	SendVerificationEmail       bool             `json:"send_verification_email"`
	SendPasswordResetEmail      bool             `json:"send_password_reset_email"`
	SendWelcomeEmail            bool             `json:"send_welcome_email"`
	SettingsJSON                json.RawMessage   `json:"settings_json"`
	CreatedAt                   *time.Time       `json:"created_at"`
	UpdatedAt                   *time.Time       `json:"updated_at"`
	OtpLength                   int              `json:"otp_length"`
	SendRegistrationSMS         bool             `json:"send_registration_sms"`
	SendVerificationSMS         bool             `json:"send_verification_sms"`
	SendPasswordResetSMS        bool             `json:"send_password_reset_sms"`
	SendWelcomeSMS              bool             `json:"send_welcome_sms"`
	RequireEmail                bool             `json:"require_email"`
	RequireOtpForPasswordChange  bool            `json:"require_otp_for_password_change"`
	RequireOtpForAccountDeletion bool            `json:"require_otp_for_account_deletion"`
	GoogleSignInEnabled          bool            `json:"google_sign_in_enabled"`
	GoogleWebClientIDs           []string        `json:"google_web_client_ids"`
	GoogleAutoRegister           bool            `json:"google_auto_register"`
}

type OTPVerification struct {
	ID         int              `json:"id"`
	UserID     int              `json:"user_id"`
	OtpCode    string           `json:"otp_code"`
	OtpMethod  string           `json:"otp_method"`
	Destination string          `json:"destination"`
	Status     string           `json:"status"`
	ExpiresAt  time.Time        `json:"expires_at"`
	VerifiedAt *time.Time       `json:"verified_at,omitempty"`
	Attempts   int              `json:"attempts"`
	Purpose    *string          `json:"purpose,omitempty"`
	Metadata   json.RawMessage  `json:"metadata,omitempty"`
	CreatedAt  *time.Time       `json:"created_at,omitempty"`
	UpdatedAt  *time.Time       `json:"updated_at,omitempty"`
}

type OrgContext struct {
	OrganisationName *string `json:"organisation_name,omitempty"`
	OrganisationID   *string `json:"organisation_id,omitempty"`
	IsAdmin          bool    `json:"is_admin"`
}

type SessionPayload struct {
	ProjectID        int              `json:"projectId"`
	AppUserID        int              `json:"appUserId"`
	Email            *string          `json:"email,omitempty"`
	Roles            json.RawMessage  `json:"roles,omitempty"`
	OrganisationName *string          `json:"organisation_name,omitempty"`
	OrganisationID   *string          `json:"organisation_id,omitempty"`
	IsAdmin          bool             `json:"is_admin"`
}
