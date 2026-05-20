package authmanagement

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/supertokens"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	store *Store
	pool  *pgxpool.Pool
	st    *supertokens.Client
	comms CommunicationsClient
}

type CommunicationsClient interface {
	SendEmail(ctx context.Context, projectID int, providerID int, to []string, cc []string, bcc []string, subject string, text, html string, attachments []communications.EmailAttachment) (map[string]any, error)
	SendSMS(ctx context.Context, projectID int, messages []communications.SmsMessage) (any, error)
}

func NewService(pool *pgxpool.Pool, st *supertokens.Client, comms CommunicationsClient) *Service {
	return &Service{store: NewStore(pool), pool: pool, st: st, comms: comms}
}

func (s *Service) resolveSchema(ctx context.Context, projectID int) (string, error) {
	schema, err := s.store.GetProjectSchema(ctx, projectID)
	if err != nil {
		return "", fmt.Errorf("failed to resolve schema: %w", err)
	}
	if schema == "" {
		return "", fmt.Errorf("project not found")
	}
	if err := s.store.EnsureAuthSchemaCompatibility(ctx, schema); err != nil {
		return "", fmt.Errorf("failed to ensure auth schema compatibility: %w", err)
	}
	return schema, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ─── App Auth ────────────────────────────────────────────────────────

func (s *Service) Register(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if settings != nil && !settings.RegistrationEnabled {
		return nil, fmt.Errorf("registration is disabled")
	}
	if settings != nil && !settings.AuthEnabled {
		return nil, fmt.Errorf("authentication is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	name, _ := body["name"].(string)
	lastName, _ := body["last_name"].(string)
	password, _ := body["password"].(string)

	if email == "" && phone == "" {
		return nil, fmt.Errorf("email or phone is required")
	}
	if password == "" {
		return nil, fmt.Errorf("password is required")
	}

	if email != "" {
		existing, _ := s.store.GetUserByEmail(ctx, schema, email)
		if existing != nil {
			return nil, fmt.Errorf("email already registered")
		}
	}

	var stEmail string
	if email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(email, projectID)
	} else {
		stEmail = supertokens.CreatePhoneScopedEmail(phone, projectID)
	}

	signUpResp, err := s.st.SignUp(ctx, "public", stEmail, password)
	if err != nil {
		return nil, fmt.Errorf("SuperTokens signup failed: %w", err)
	}
	if signUpResp.Status == "EMAIL_ALREADY_EXISTS_ERROR" {
		return nil, fmt.Errorf("email already registered in authentication system")
	}
	if signUpResp.Status != "OK" || signUpResp.User == nil {
		return nil, fmt.Errorf("signup failed: %s", signUpResp.Status)
	}

	userData := map[string]any{
		"supertokens_user_id": signUpResp.User.ID,
		"name":                name,
		"last_name":           nilIfEmpty(lastName),
		"email":               nilIfEmpty(email),
		"phone":               nilIfEmpty(phone),
		"is_active":           true,
	}
	if v, ok := body["metadata"]; ok {
		b, _ := json.Marshal(v)
		userData["metadata"] = string(b)
	}
	if v, ok := body["custom_field_1"]; ok {
		userData["custom_field_1"] = v
	}
	if v, ok := body["custom_field_2"]; ok {
		userData["custom_field_2"] = v
	}

	user, err := s.store.CreateUser(ctx, schema, userData)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign default role
	if settings != nil && settings.DefaultRoleID != nil {
		_ = s.store.AssignRole(ctx, schema, user.ID, *settings.DefaultRoleID, "system")
	}
	if roleID, ok := body["role_id"]; ok {
		if rid, ok := roleID.(float64); ok {
			_ = s.store.AssignRole(ctx, schema, user.ID, int(rid), "system")
		}
	}

	// OTP if requested/configured
	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	otpMethodInput, _ := body["otp_method"].(string)
	method, dest, shouldSendOTP, routeErr := resolveRegistrationOTPRoute(settings, otpMethodInput, email, phone)
	if routeErr != nil {
		return nil, routeErr
	}
	if shouldSendOTP {
		code, err := GenerateOTP(otpLen)
		if err != nil {
			return nil, fmt.Errorf("failed to generate registration OTP: %w", err)
		}

		deliveryMetadata := map[string]any{
			"delivery_status": "pending_attempt",
		}
		deliveryMetadataRaw, err := json.Marshal(deliveryMetadata)
		if err != nil {
			return nil, fmt.Errorf("failed to prepare registration OTP metadata: %w", err)
		}
		expiresAt := time.Now().Add(10 * time.Minute)
		if err := s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "", deliveryMetadataRaw); err != nil {
			return nil, fmt.Errorf("failed to create registration OTP: %w", err)
		}
		if err := s.store.UpdateUser(ctx, schema, user.ID, map[string]any{"is_active": false}); err != nil {
			return nil, fmt.Errorf("failed to set user inactive pending OTP verification: %w", err)
		}

		otpRecord, err := s.store.GetPendingOTP(ctx, schema, user.ID, "")
		if err != nil {
			return nil, fmt.Errorf("failed to load registration OTP for delivery status: %w", err)
		}
		if otpRecord == nil {
			return nil, fmt.Errorf("registration OTP record not found after creation")
		}

		attemptedAt := time.Now().UTC().Format(time.RFC3339)
		deliveryMetadata["attempted_at"] = attemptedAt
		deliveryMetadata["otp_method"] = method
		deliveryMetadata["destination"] = dest

		switch method {
		case "email":
			if settings.EmailProviderID == nil {
				deliveryMetadata["delivery_status"] = "failed"
				deliveryMetadata["delivery_error"] = "email provider is not configured"
			} else if s.comms == nil {
				deliveryMetadata["delivery_status"] = "failed"
				deliveryMetadata["delivery_error"] = "communications service unavailable"
			} else {
				subject := "Verify your account"
				textBody := fmt.Sprintf("Your verification OTP is %s. It expires in 10 minutes.", code)
				htmlBody := fmt.Sprintf("<p>Your verification OTP is <strong>%s</strong>.</p><p>It expires in 10 minutes.</p>", code)
				if _, sendErr := s.comms.SendEmail(ctx, projectID, *settings.EmailProviderID, []string{dest}, nil, nil, subject, textBody, htmlBody, nil); sendErr != nil {
					deliveryMetadata["delivery_status"] = "failed"
					deliveryMetadata["delivery_error"] = sendErr.Error()
					slog.Warn("registration OTP email delivery failed",
						"projectId", projectID,
						"userId", user.ID,
						"email", dest,
						"providerId", *settings.EmailProviderID,
						"error", sendErr,
					)
				} else {
					deliveryMetadata["delivery_status"] = "sent"
				}
			}
		case "sms":
			if s.comms == nil {
				deliveryMetadata["delivery_status"] = "failed"
				deliveryMetadata["delivery_error"] = "communications service unavailable"
			} else {
				smsBody := fmt.Sprintf("Your verification OTP is %s. It expires in 10 minutes.", code)
				if _, sendErr := s.comms.SendSMS(ctx, projectID, []communications.SmsMessage{{Content: smsBody, Destination: dest}}); sendErr != nil {
					deliveryMetadata["delivery_status"] = "failed"
					deliveryMetadata["delivery_error"] = sendErr.Error()
					slog.Warn("registration OTP SMS delivery failed",
						"projectId", projectID,
						"userId", user.ID,
						"phone", dest,
						"error", sendErr,
					)
				} else {
					deliveryMetadata["delivery_status"] = "sent"
				}
			}
		}

		updatedMetadataRaw, err := json.Marshal(deliveryMetadata)
		if err != nil {
			slog.Warn("failed to marshal registration OTP delivery metadata",
				"projectId", projectID,
				"userId", user.ID,
				"otpId", otpRecord.ID,
				"error", err,
			)
		} else if err := s.store.UpdateOTPMetadata(ctx, schema, otpRecord.ID, updatedMetadataRaw); err != nil {
			slog.Warn("failed to persist registration OTP delivery metadata",
				"projectId", projectID,
				"userId", user.ID,
				"otpId", otpRecord.ID,
				"error", err,
			)
		}
	}

	// Create session
	roles, _ := s.store.GetUserRoles(ctx, schema, user.ID)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, roles)
	rolesJSON, _ := json.Marshal(roles)

	payload := SessionPayload{
		ProjectID:        projectID,
		AppUserID:        user.ID,
		Email:            user.Email,
		Roles:            rolesJSON,
		OrganisationName: orgCtx.OrganisationName,
		OrganisationID:   orgCtx.OrganisationID,
		IsAdmin:          orgCtx.IsAdmin,
	}

	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID:                signUpResp.User.ID,
		UserDataInAccessToken: payload,
	})
	if err != nil {
		slog.Warn("failed to create session", "error", err)
	}

	result := map[string]any{
		"user":    user,
		"message": "User registered successfully",
	}
	if sessionResp != nil {
		result["accessToken"] = sessionResp.AccessToken.Token
	}
	return result, nil
}

func (s *Service) Login(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if settings != nil && !settings.AuthEnabled {
		return nil, ErrAuthenticationClosed
	}

	method, _ := body["method"].(string)
	if method == "" {
		method = "email"
	}
	credential, _ := body["email"].(string)
	if credential == "" {
		credential, _ = body["phone"].(string)
	}
	if credential == "" {
		credential, _ = body["credential"].(string)
	}
	password, _ := body["password"].(string)

	if credential == "" || password == "" {
		return nil, fmt.Errorf("credentials are required")
	}

	user, err := s.store.GetUserByCredential(ctx, schema, method, credential)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}
	if stEmail == "" {
		slog.Warn("login denied due to missing email/phone identity",
			"projectId", projectID,
			"userId", user.ID,
			"method", method,
		)
		return nil, ErrMissingLoginIdentity
	}

	signInResp, err := s.st.SignIn(ctx, "public", stEmail, password)
	if err != nil || signInResp.Status == "WRONG_CREDENTIALS_ERROR" {
		// Try legacy bcrypt fallback
		if user.Password != nil && *user.Password != "" {
			if bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(password)) == nil {
				resp, _ := s.st.SignUp(ctx, "public", stEmail, password)
				if resp != nil && resp.Status == "OK" && resp.User != nil {
					_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
					_ = s.store.ClearUserPassword(ctx, schema, user.ID)
					signInResp, _ = s.st.SignIn(ctx, "public", stEmail, password)
				}
			}
		}
		if signInResp == nil || signInResp.Status != "OK" {
			return nil, ErrInvalidCredentials
		}
	}

	if signInResp.User != nil {
		stID := signInResp.User.ID
		if user.SupertokensUserID == nil || *user.SupertokensUserID != stID {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stID)
		}
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)

	payload := SessionPayload{
		ProjectID:        projectID,
		AppUserID:        user.ID,
		Email:            user.Email,
		Roles:            user.Roles,
		OrganisationName: orgCtx.OrganisationName,
		OrganisationID:   orgCtx.OrganisationID,
		IsAdmin:          orgCtx.IsAdmin,
	}

	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID:                signInResp.User.ID,
		UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	result := map[string]any{
		"user":        user,
		"accessToken": sessionResp.AccessToken.Token,
		"message":     "Login successful",
	}
	return result, nil
}

func (s *Service) SingleCredentialLogin(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	method, _ := body["method"].(string)
	if method == "" {
		method = "email"
	}
	credential, _ := body["credential"].(string)
	if credential == "" {
		credential, _ = body["email"].(string)
	}
	if credential == "" {
		return nil, fmt.Errorf("credential is required")
	}

	user, err := s.store.GetUserByCredential(ctx, schema, method, credential)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	var stUserID string
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		stUserID = *user.SupertokensUserID
	} else {
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			stUserID = users[0].ID
		} else {
			pw := randomHex(32)
			resp, _ := s.st.SignUp(ctx, "public", stEmail, pw)
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				stUserID = resp.User.ID
			}
		}
		if stUserID != "" {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stUserID)
		}
	}

	if stUserID == "" {
		return nil, fmt.Errorf("failed to resolve authentication identity")
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)
	payload := SessionPayload{
		ProjectID: projectID, AppUserID: user.ID, Email: user.Email,
		Roles: user.Roles, OrganisationName: orgCtx.OrganisationName,
		OrganisationID: orgCtx.OrganisationID, IsAdmin: orgCtx.IsAdmin,
	}
	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID: stUserID, UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	return map[string]any{"user": user, "accessToken": sessionResp.AccessToken.Token, "message": "Login successful"}, nil
}

func (s *Service) RequestOTPLogin(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return err
	}
	if settings != nil && !settings.AuthEnabled {
		return fmt.Errorf("authentication is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil // Don't reveal if user exists
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "otp_login")
	code, _ := GenerateOTP(otpLen)
	var method, dest string
	if email != "" {
		method = "email"
		dest = email
	} else {
		method = "sms"
		dest = phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	return s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "otp_login", nil)
}

func (s *Service) VerifyOTPLogin(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByCredential(ctx, schema, "email", email)
	} else if phone != "" {
		user, _ = s.store.GetUserByCredential(ctx, schema, "phone", phone)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	otp, err := s.store.GetPendingOTP(ctx, schema, user.ID, "otp_login")
	if err != nil || otp == nil {
		return nil, fmt.Errorf("no pending OTP found")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("OTP has expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return nil, fmt.Errorf("invalid OTP code")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	var stUserID string
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		stUserID = *user.SupertokensUserID
	} else {
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			stUserID = users[0].ID
		} else {
			resp, _ := s.st.SignUp(ctx, "public", stEmail, randomHex(32))
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				stUserID = resp.User.ID
			}
		}
		if stUserID != "" {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stUserID)
		}
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)
	payload := SessionPayload{
		ProjectID: projectID, AppUserID: user.ID, Email: user.Email,
		Roles: user.Roles, OrganisationName: orgCtx.OrganisationName,
		OrganisationID: orgCtx.OrganisationID, IsAdmin: orgCtx.IsAdmin,
	}
	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID: stUserID, UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	return map[string]any{"user": user, "accessToken": sessionResp.AccessToken.Token, "message": "OTP verified successfully"}, nil
}

func (s *Service) Verify(ctx context.Context, projectID int, accessToken string) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	sessionResp, err := s.st.GetSession(ctx, accessToken)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired session")
	}
	stUserID := sessionResp.Session.UserID
	user, err := s.store.GetUserBySuperTokensID(ctx, schema, stUserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}
	return map[string]any{"user": user, "message": "Token is valid"}, nil
}

func (s *Service) Logout(ctx context.Context, accessToken string) error {
	sessionResp, err := s.st.GetSession(ctx, accessToken)
	if err != nil {
		return nil
	}
	return s.st.RevokeSession(ctx, sessionResp.Session.Handle)
}

func (s *Service) RefreshSession(ctx context.Context, requestHeaders http.Header) (*supertokens.SessionRefreshResult, error) {
	return s.st.RefreshSession(ctx, requestHeaders)
}

func (s *Service) VerifyOTP(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	userIDRaw, _ := body["user_id"].(float64)
	userID := int(userIDRaw)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}
	if userID == 0 || code == "" {
		return fmt.Errorf("user_id and otp are required")
	}

	otp, err := s.store.GetPendingOTP(ctx, schema, userID, "")
	if err != nil || otp == nil {
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
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)
	return s.store.ActivateUser(ctx, schema, userID, true, true)
}

func (s *Service) SendForgotPasswordOTP(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)
	if settings != nil && !settings.EnablePasswordReset {
		return fmt.Errorf("password reset is disabled")
	}

	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil // Don't reveal
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_reset")
	code, err := resolveForgotPasswordCode(body, otpLen)
	if err != nil {
		return err
	}
	method, dest, err := resolveForgotPasswordDelivery(body, user, email, phone)
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	if err := s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "password_reset", nil); err != nil {
		return err
	}

	// Keep anti-enumeration behavior: delivery failures are logged, but we still
	// return success so callers cannot infer account existence.
	if s.comms == nil {
		slog.Warn("forgot-password OTP delivery skipped: communications service unavailable",
			"projectId", projectID,
			"userId", user.ID,
			"method", method,
		)
		return nil
	}

	expiresIn := "10 minutes"
	switch method {
	case "email":
		if settings == nil || !settings.SendPasswordResetEmail || settings.EmailProviderID == nil {
			return nil
		}
		subject := "Your password reset OTP"
		textBody := fmt.Sprintf("Your password reset OTP is %s. It expires in %s.", code, expiresIn)
		htmlBody := fmt.Sprintf("<p>Your password reset OTP is <strong>%s</strong>.</p><p>It expires in %s.</p>", code, expiresIn)
		if _, err := s.comms.SendEmail(ctx, projectID, *settings.EmailProviderID, []string{dest}, nil, nil, subject, textBody, htmlBody, nil); err != nil {
			slog.Warn("forgot-password OTP email delivery failed",
				"projectId", projectID,
				"userId", user.ID,
				"email", dest,
				"providerId", *settings.EmailProviderID,
				"error", err,
			)
		}
	case "sms":
		if settings == nil || !settings.SendPasswordResetSMS {
			return nil
		}
		smsBody := fmt.Sprintf("Your password reset OTP is %s. It expires in %s.", code, expiresIn)
		if _, err := s.comms.SendSMS(ctx, projectID, []communications.SmsMessage{{Content: smsBody, Destination: dest}}); err != nil {
			slog.Warn("forgot-password OTP SMS delivery failed",
				"projectId", projectID,
				"userId", user.ID,
				"phone", dest,
				"error", err,
			)
		}
	}

	return nil
}

func (s *Service) VerifyForgotPasswordOTP(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, user.ID, "password_reset")
	if otp == nil {
		return nil, fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("OTP expired")
	}
	if otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return nil, fmt.Errorf("too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return nil, fmt.Errorf("invalid OTP")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	resetToken := randomHex(32)
	expiresAt := time.Now().Add(15 * time.Minute).Format(time.RFC3339)
	_ = s.store.SetUserMetadata(ctx, schema, user.ID, "password_reset_token", resetToken)
	_ = s.store.SetUserMetadata(ctx, schema, user.ID, "password_reset_expires_at", expiresAt)

	return map[string]any{"reset_token": resetToken, "expires_in_minutes": 15}, nil
}

func (s *Service) ResetPassword(ctx context.Context, projectID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	email, _ := body["email"].(string)
	phone, _ := body["phone"].(string)
	resetToken, _ := body["reset_token"].(string)
	newPassword, _ := body["new_password"].(string)

	if resetToken == "" || newPassword == "" {
		return fmt.Errorf("reset_token and new_password are required")
	}

	var user *AppUser
	if email != "" {
		user, _ = s.store.GetUserByEmail(ctx, schema, email)
	} else if phone != "" {
		user, _ = s.store.GetUserByPhone(ctx, schema, phone)
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	var metadata map[string]any
	if user.Metadata != nil {
		_ = json.Unmarshal(user.Metadata, &metadata)
	}
	storedToken, _ := metadata["password_reset_token"].(string)
	storedExpiry, _ := metadata["password_reset_expires_at"].(string)
	if storedToken == "" || storedToken != resetToken {
		return fmt.Errorf("invalid reset token")
	}
	expiryTime, _ := time.Parse(time.RFC3339, storedExpiry)
	if time.Now().After(expiryTime) {
		return fmt.Errorf("reset token expired")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		_ = s.st.DeleteUser(ctx, *user.SupertokensUserID)
	}

	resp, _ := s.st.SignUp(ctx, "public", stEmail, newPassword)
	if resp != nil && resp.Status == "OK" && resp.User != nil {
		_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
	}

	_ = s.store.RemoveUserMetadataKeys(ctx, schema, user.ID, []string{"password_reset_token", "password_reset_expires_at"})
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_reset")
	return nil
}

func (s *Service) ChangePasswordRequest(ctx context.Context, projectID, appUserID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)

	oldPassword, _ := body["old_password"].(string)
	newPassword, _ := body["new_password"].(string)
	if oldPassword == "" || newPassword == "" {
		return nil, fmt.Errorf("old_password and new_password are required")
	}

	var stEmail string
	if user.Email != nil && *user.Email != "" {
		stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
	} else if user.Phone != nil && *user.Phone != "" {
		stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
	}

	signInResp, err := s.st.SignIn(ctx, "public", stEmail, oldPassword)
	if err != nil || signInResp.Status != "OK" {
		return nil, fmt.Errorf("current password is incorrect")
	}

	requireOTP := settings != nil && settings.RequireOtpForPasswordChange
	if !requireOTP {
		_, err := s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: signInResp.User.ID, Password: newPassword,
		})
		if err != nil {
			// Compatibility fallback: some SuperTokens core deployments reject
			// /recipe/user payload variants. Rotate identity by recreating creds.
			if delErr := s.st.DeleteUser(ctx, signInResp.User.ID); delErr != nil {
				return nil, fmt.Errorf("failed to update password: %w", err)
			}
			resp, signUpErr := s.st.SignUp(ctx, "public", stEmail, newPassword)
			if signUpErr != nil {
				return nil, fmt.Errorf("failed to update password: %w", signUpErr)
			}
			if resp == nil || resp.Status != "OK" || resp.User == nil {
				status := ""
				if resp != nil {
					status = resp.Status
				}
				return nil, fmt.Errorf("failed to update password: signup status %s", status)
			}
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
		}
		return map[string]any{"message": "Password changed successfully"}, nil
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, user.ID, "password_change")
	code, _ := GenerateOTP(otpLen)
	metadata, _ := json.Marshal(map[string]string{"new_password": newPassword})
	var method, dest string
	if user.Email != nil && *user.Email != "" {
		method = "email"
		dest = *user.Email
	} else if user.Phone != nil && *user.Phone != "" {
		method = "sms"
		dest = *user.Phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	_ = s.store.CreateOTP(ctx, schema, user.ID, code, method, dest, expiresAt, "password_change", metadata)
	return map[string]any{"message": "OTP sent for password change verification", "requires_otp": true}, nil
}

func (s *Service) VerifyPasswordChangeOTP(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return fmt.Errorf("user not found")
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, appUserID, "password_change")
	if otp == nil {
		return fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) || otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP expired or too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP")
	}

	var meta map[string]string
	_ = json.Unmarshal(otp.Metadata, &meta)
	newPw := meta["new_password"]
	if newPw == "" {
		return fmt.Errorf("new password not found in OTP metadata")
	}

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		_, err := s.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: *user.SupertokensUserID, Password: newPw,
		})
		if err != nil {
			var stEmail string
			if user.Email != nil && *user.Email != "" {
				stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
			} else if user.Phone != nil && *user.Phone != "" {
				stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
			}
			if stEmail == "" {
				return fmt.Errorf("failed to update password: %w", err)
			}

			// Compatibility fallback: rotate auth identity when core rejects
			// /recipe/user payload variants.
			if delErr := s.st.DeleteUser(ctx, *user.SupertokensUserID); delErr != nil {
				return fmt.Errorf("failed to update password: %w", err)
			}
			resp, signUpErr := s.st.SignUp(ctx, "public", stEmail, newPw)
			if signUpErr != nil {
				return fmt.Errorf("failed to update password: %w", signUpErr)
			}
			if resp == nil || resp.Status != "OK" || resp.User == nil {
				status := ""
				if resp != nil {
					status = resp.Status
				}
				return fmt.Errorf("failed to update password: signup status %s", status)
			}
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, resp.User.ID)
		}
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "password_change")
	return nil
}

func (s *Service) RequestAccountDeletion(ctx context.Context, projectID, appUserID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	settings, _ := s.store.GetAuthSettings(ctx, projectID)

	password, _ := body["password"].(string)
	reason, _ := body["reason"].(string)

	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" && password != "" {
		var stEmail string
		if user.Email != nil && *user.Email != "" {
			stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
		} else if user.Phone != nil && *user.Phone != "" {
			stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
		}
		resp, _ := s.st.SignIn(ctx, "public", stEmail, password)
		if resp == nil || resp.Status != "OK" {
			return nil, fmt.Errorf("incorrect password")
		}
	}

	deletionDate := time.Now().AddDate(0, 0, 7)
	requireOTP := settings != nil && settings.RequireOtpForAccountDeletion

	if !requireOTP {
		_ = s.store.SetDeletionSchedule(ctx, schema, appUserID, &reason, deletionDate)
		return map[string]any{"message": "Account deletion scheduled", "deletion_date": deletionDate}, nil
	}

	otpLen := 6
	if settings != nil && settings.OtpLength > 0 {
		otpLen = settings.OtpLength
	}
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "account_deletion")
	code, _ := GenerateOTP(otpLen)
	meta, _ := json.Marshal(map[string]any{"reason": reason, "deletion_date": deletionDate})
	var method, dest string
	if user.Email != nil && *user.Email != "" {
		method = "email"
		dest = *user.Email
	} else if user.Phone != nil && *user.Phone != "" {
		method = "sms"
		dest = *user.Phone
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	_ = s.store.CreateOTP(ctx, schema, appUserID, code, method, dest, expiresAt, "account_deletion", meta)
	return map[string]any{"message": "OTP sent for account deletion verification", "requires_otp": true}, nil
}

func (s *Service) VerifyAccountDeletionOTP(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}

	otp, _ := s.store.GetPendingOTP(ctx, schema, appUserID, "account_deletion")
	if otp == nil {
		return fmt.Errorf("no pending OTP")
	}
	if time.Now().After(otp.ExpiresAt) || otp.Attempts >= 3 {
		_ = s.store.MarkOTPFailed(ctx, schema, otp.ID)
		return fmt.Errorf("OTP expired or too many attempts")
	}
	if otp.OtpCode != code {
		_ = s.store.IncrementOTPAttempts(ctx, schema, otp.ID)
		return fmt.Errorf("invalid OTP")
	}
	_ = s.store.MarkOTPVerified(ctx, schema, otp.ID)

	var meta map[string]any
	_ = json.Unmarshal(otp.Metadata, &meta)
	reason, _ := meta["reason"].(string)
	deletionDate := time.Now().AddDate(0, 0, 7)

	_ = s.store.SetDeletionSchedule(ctx, schema, appUserID, &reason, deletionDate)
	_ = s.store.ExpirePendingOTPs(ctx, schema, appUserID, "account_deletion")
	return nil
}

func (s *Service) CancelAccountDeletion(ctx context.Context, projectID, appUserID int, body map[string]any) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	user, _ := s.store.GetUser(ctx, schema, appUserID)
	if user == nil {
		return fmt.Errorf("user not found")
	}
	if user.DeletionScheduledAt == nil {
		return fmt.Errorf("no deletion scheduled")
	}

	password, _ := body["password"].(string)
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" && password != "" {
		var stEmail string
		if user.Email != nil && *user.Email != "" {
			stEmail = supertokens.CreateProjectScopedEmail(*user.Email, projectID)
		} else if user.Phone != nil && *user.Phone != "" {
			stEmail = supertokens.CreatePhoneScopedEmail(*user.Phone, projectID)
		}
		resp, _ := s.st.SignIn(ctx, "public", stEmail, password)
		if resp == nil || resp.Status != "OK" {
			return fmt.Errorf("incorrect password")
		}
	}

	return s.store.ClearDeletionSchedule(ctx, schema, appUserID)
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func resolveForgotPasswordCode(body map[string]any, otpLen int) (string, error) {
	providedCode, _ := body["code"].(string)
	providedCode = strings.TrimSpace(providedCode)
	if providedCode == "" {
		return GenerateOTP(otpLen)
	}
	if len(providedCode) != otpLen {
		return "", fmt.Errorf("code must be %d digits", otpLen)
	}
	digitsOnly := regexp.MustCompile(`^\d+$`)
	if !digitsOnly.MatchString(providedCode) {
		return "", fmt.Errorf("code must contain only digits")
	}
	return providedCode, nil
}

func resolveForgotPasswordDelivery(body map[string]any, user *AppUser, requestedEmail, requestedPhone string) (method string, destination string, err error) {
	requestedMethod, _ := body["method"].(string)
	requestedMethod = strings.ToLower(strings.TrimSpace(requestedMethod))
	if requestedMethod == "" {
		if strings.TrimSpace(requestedEmail) != "" {
			requestedMethod = "email"
		} else {
			requestedMethod = "sms"
		}
	}

	switch requestedMethod {
	case "email":
		if user.Email == nil || strings.TrimSpace(*user.Email) == "" {
			return "", "", fmt.Errorf("user does not have an email address")
		}
		return "email", strings.TrimSpace(*user.Email), nil
	case "sms":
		if user.Phone == nil || strings.TrimSpace(*user.Phone) == "" {
			return "", "", fmt.Errorf("user does not have a phone number")
		}
		return "sms", strings.TrimSpace(*user.Phone), nil
	default:
		return "", "", fmt.Errorf("method must be one of: email, sms")
	}
}

func resolveRegistrationOTPRoute(settings *AuthSettings, otpMethodInput, email, phone string) (method string, destination string, send bool, err error) {
	otpMethod := strings.ToLower(strings.TrimSpace(otpMethodInput))
	if otpMethod != "" {
		switch otpMethod {
		case "email":
			if strings.TrimSpace(email) == "" {
				return "", "", false, fmt.Errorf("email is required when otp_method is email")
			}
			return "email", strings.TrimSpace(email), true, nil
		case "sms":
			if strings.TrimSpace(phone) == "" {
				return "", "", false, fmt.Errorf("phone is required when otp_method is sms")
			}
			return "sms", strings.TrimSpace(phone), true, nil
		default:
			return "", "", false, fmt.Errorf("otp_method must be one of: email, sms")
		}
	}

	if settings == nil || (!settings.SendRegistrationEmail && !settings.SendRegistrationSMS) {
		return "", "", false, nil
	}
	switch {
	case settings.SendRegistrationEmail && strings.TrimSpace(email) != "":
		return "email", strings.TrimSpace(email), true, nil
	case settings.SendRegistrationSMS && strings.TrimSpace(phone) != "":
		return "sms", strings.TrimSpace(phone), true, nil
	case strings.TrimSpace(email) != "":
		return "email", strings.TrimSpace(email), true, nil
	case strings.TrimSpace(phone) != "":
		return "sms", strings.TrimSpace(phone), true, nil
	default:
		return "", "", false, fmt.Errorf("registration OTP is enabled but no destination is available")
	}
}

// ─── Google Sign-In ───────────────────────────────────────────────────

func (s *Service) GoogleSignIn(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	settings, err := s.store.GetAuthSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if settings != nil && !settings.AuthEnabled {
		return nil, ErrAuthenticationClosed
	}
	if settings == nil || !settings.GoogleSignInEnabled {
		return nil, ErrGoogleSignInDisabled
	}

	rawToken, _ := body["idToken"].(string)
	if rawToken == "" {
		return nil, fmt.Errorf("idToken is required")
	}

	claims, err := verifyGoogleIDToken(ctx, rawToken, settings.GoogleWebClientIDs)
	if err != nil {
		return nil, ErrInvalidGoogleToken
	}

	// 1. Look up by linked Google identity (provider + sub).
	user, err := s.store.GetUserByAuthProvider(ctx, schema, "google", claims.Sub)
	if err != nil {
		return nil, err
	}

	// 2. Fall back to email match (links Google to an existing email/password account).
	if user == nil && claims.Email != "" {
		user, err = s.store.GetUserByCredential(ctx, schema, "email", claims.Email)
		if err != nil {
			return nil, err
		}
	}

	// 3. Auto-register if allowed.
	if user == nil {
		if settings == nil || !settings.GoogleAutoRegister {
			return nil, ErrGoogleAutoRegisterDisabled
		}
		if settings.RegistrationEnabled == false {
			return nil, fmt.Errorf("registration is disabled")
		}

		name := claims.GivenName
		if name == "" {
			name = claims.Name
		}
		lastName := claims.FamilyName

		userData := map[string]any{
			"name":           name,
			"last_name":      nilIfEmpty(lastName),
			"email":          nilIfEmpty(claims.Email),
			"is_active":      true,
			"email_verified": claims.EmailVerified,
		}
		user, err = s.store.CreateUser(ctx, schema, userData)
		if err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
		if settings.DefaultRoleID != nil {
			_ = s.store.AssignRole(ctx, schema, user.ID, *settings.DefaultRoleID, "system")
		}
		// Re-fetch with roles populated.
		user, err = s.store.GetUser(ctx, schema, user.ID)
		if err != nil || user == nil {
			return nil, fmt.Errorf("failed to fetch created user: %w", err)
		}
	}

	if !user.IsActive {
		return nil, ErrInvalidCredentials
	}

	// Resolve / create the SuperTokens identity (passwordless pattern from SingleCredentialLogin).
	stEmail := supertokens.CreateProjectScopedEmail(claims.Email, projectID)
	var stUserID string
	if user.SupertokensUserID != nil && *user.SupertokensUserID != "" {
		stUserID = *user.SupertokensUserID
	} else {
		users, _ := s.st.ListUsersByAccountInfo(ctx, "public", stEmail)
		if len(users) > 0 {
			stUserID = users[0].ID
		} else {
			pw := randomHex(32)
			resp, _ := s.st.SignUp(ctx, "public", stEmail, pw)
			if resp != nil && resp.Status == "OK" && resp.User != nil {
				stUserID = resp.User.ID
			}
		}
		if stUserID != "" {
			_ = s.store.SetUserSuperTokensID(ctx, schema, user.ID, stUserID)
		}
	}
	if stUserID == "" {
		return nil, fmt.Errorf("failed to resolve authentication identity")
	}

	// Persist the Google → user link (idempotent).
	if err := s.store.LinkAuthProvider(ctx, schema, user.ID, "google", claims.Sub, claims.Email); err != nil {
		slog.Warn("failed to link Google auth provider", "error", err, "userID", user.ID)
	}

	var rolesRaw []Role
	_ = json.Unmarshal(user.Roles, &rolesRaw)
	orgCtx := ResolveOrgContext(ctx, s.pool, schema, user, rolesRaw)

	payload := SessionPayload{
		ProjectID:        projectID,
		AppUserID:        user.ID,
		Email:            user.Email,
		Roles:            user.Roles,
		OrganisationName: orgCtx.OrganisationName,
		OrganisationID:   orgCtx.OrganisationID,
		IsAdmin:          orgCtx.IsAdmin,
	}
	sessionResp, err := s.st.CreateSession(ctx, "public", supertokens.CreateSessionRequest{
		UserID:                stUserID,
		UserDataInAccessToken: payload,
	})
	if err != nil {
		return nil, fmt.Errorf("session creation failed: %w", err)
	}

	return map[string]any{
		"user":        user,
		"accessToken": sessionResp.AccessToken.Token,
		"message":     "Login successful",
	}, nil
}
