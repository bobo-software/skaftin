package authmanagement

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func extractAppUserID(body map[string]any) int {
	for _, key := range []string{"app_user_id", "user_id"} {
		value, ok := body[key]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case float64:
			if int(v) > 0 {
				return int(v)
			}
		case int:
			if v > 0 {
				return v
			}
		case int64:
			if v > 0 {
				return int(v)
			}
		case string:
			id, err := strconv.Atoi(strings.TrimSpace(v))
			if err == nil && id > 0 {
				return id
			}
		}
	}
	return 0
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	result, err := h.service.Register(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 201, "Registration successful", result)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	result, err := h.loginFunc(r.Context(), projectID, body)
	if err != nil {
		writeLoginError(w, err)
		return
	}
	httputil.WriteSuccess(w, 200, "Login successful", result)
}

// LoginFromAppAPI handles legacy client login URL while serving from Go.
// Expected path: POST /app-api/auth/auth/login (behind API key middleware).
func (h *Handler) LoginFromAppAPI(w http.ResponseWriter, r *http.Request) {
	authCtx := auth.GetAuthContext(r)
	if authCtx == nil || authCtx.ProjectID <= 0 {
		httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}

	// Node handler expects username; Go login service accepts credential/email/phone.
	compatibilityNormalizeLoginBody(body)

	result, err := h.loginFunc(r.Context(), authCtx.ProjectID, body)
	if err != nil {
		writeLoginError(w, err)
		return
	}
	httputil.WriteSuccess(w, 200, "Login successful", result)
}

// LogoutFromAppAPI handles legacy client logout URL while serving from Go.
// Expected path: POST /app-api/auth/auth/logout (behind API key middleware).
func (h *Handler) LogoutFromAppAPI(w http.ResponseWriter, r *http.Request) {
	authCtx := auth.GetAuthContext(r)
	if authCtx == nil || authCtx.ProjectID <= 0 {
		httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
		return
	}
	// Reuse existing logout token extraction + revoke behavior.
	h.LogoutSession(w, r)
}

// RefreshFromAppAPI handles the legacy app-api refresh path by bridging directly
// to SuperTokens Core and forwarding status/body/cookies transparently.
// Expected path: POST /app-api/auth/session/refresh (behind API key middleware).
func (h *Handler) RefreshFromAppAPI(w http.ResponseWriter, r *http.Request) {
	authCtx := auth.GetAuthContext(r)
	if authCtx == nil || authCtx.ProjectID <= 0 {
		httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	result, err := h.service.RefreshSession(r.Context(), r.Header)
	if err != nil {
		httputil.WriteError(w, http.StatusBadGateway, "Session refresh unavailable")
		return
	}
	if shouldReturnRefreshCompatibilitySuccess(result.StatusCode, result.Body) {
		httputil.WriteSuccess(w, http.StatusOK, "Session refresh is handled automatically by SuperTokens", map[string]any{
			"message": "No action needed - sessions are automatically refreshed",
		})
		return
	}

	copyRefreshResponseHeaders(w.Header(), result.Headers)
	w.WriteHeader(result.StatusCode)
	if len(result.Body) > 0 {
		_, _ = w.Write(result.Body)
	}
}

func copyRefreshResponseHeaders(dst, src http.Header) {
	for _, h := range []string{
		"Set-Cookie",
		"Content-Type",
		"front-token",
		"anti-csrf",
		"id-refresh-token",
		"st-access-token",
		"st-refresh-token",
	} {
		if values := src.Values(h); len(values) > 0 {
			dst.Del(h)
			for _, v := range values {
				dst.Add(h, v)
			}
		}
	}
}

func shouldReturnRefreshCompatibilitySuccess(statusCode int, body []byte) bool {
	if statusCode != http.StatusBadRequest {
		return false
	}
	msg := strings.ToLower(string(body))
	return strings.Contains(msg, "field name 'refreshtoken' is invalid") ||
		strings.Contains(msg, "invalid json input")
}

func compatibilityNormalizeLoginBody(body map[string]any) {
	if body == nil {
		return
	}
	if _, hasCredential := body["credential"]; hasCredential {
		return
	}
	if _, hasEmail := body["email"]; hasEmail {
		return
	}
	if _, hasPhone := body["phone"]; hasPhone {
		return
	}
	if username, ok := body["username"].(string); ok && username != "" {
		body["credential"] = username
	}
}

func writeLoginError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidCredentials), err.Error() == ErrInvalidCredentials.Error():
		httputil.WriteError(w, http.StatusUnauthorized, err.Error())
	case errors.Is(err, ErrAuthenticationClosed), err.Error() == ErrAuthenticationClosed.Error():
		httputil.WriteError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrMissingLoginIdentity), err.Error() == ErrMissingLoginIdentity.Error():
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
	default:
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
	}
}

func (h *Handler) SingleCredentialLogin(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	result, err := h.service.SingleCredentialLogin(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Login successful", result)
}

func (h *Handler) RequestOTPLogin(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if err := h.service.RequestOTPLogin(r.Context(), projectID, body); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP sent if account exists", nil)
}

func (h *Handler) VerifyOTPLogin(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	result, err := h.service.VerifyOTPLogin(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP login verified", result)
}

func (h *Handler) VerifySession(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	token := extractBearerToken(r)
	if token == "" {
		var body map[string]any
		if httputil.ReadJSON(r, &body) == nil {
			token, _ = body["accessToken"].(string)
		}
	}
	if token == "" {
		httputil.WriteError(w, 401, "Access token required")
		return
	}
	result, err := h.service.Verify(r.Context(), projectID, token)
	if err != nil {
		httputil.WriteError(w, 401, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Session verified", result)
}

func (h *Handler) LogoutSession(w http.ResponseWriter, r *http.Request) {
	token := extractBearerToken(r)
	if token == "" {
		var body map[string]any
		if httputil.ReadJSON(r, &body) == nil {
			token, _ = body["accessToken"].(string)
		}
	}
	if token != "" {
		_ = h.service.Logout(r.Context(), token)
	}
	httputil.WriteSuccess(w, 200, "Logged out", map[string]any{})
}

func (h *Handler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if err := h.service.VerifyOTP(r.Context(), projectID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP verified", nil)
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if err := h.service.SendForgotPasswordOTP(r.Context(), projectID, body); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "If the account exists, a password reset OTP has been sent", nil)
}

func (h *Handler) VerifyForgotPasswordOTP(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	result, err := h.service.VerifyForgotPasswordOTP(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Forgot password OTP verified", result)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if err := h.service.ResetPassword(r.Context(), projectID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password reset successfully", nil)
}

func (h *Handler) ChangePasswordRequest(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	appUserID := extractAppUserID(body)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id or user_id is required")
		return
	}
	result, err := h.service.ChangePasswordRequest(r.Context(), projectID, appUserID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password change OTP sent", result)
}

func (h *Handler) VerifyPasswordChangeOTP(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	appUserID := extractAppUserID(body)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id or user_id is required")
		return
	}
	if err := h.service.VerifyPasswordChangeOTP(r.Context(), projectID, appUserID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password changed successfully", nil)
}

func (h *Handler) RequestAccountDeletion(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	appUserID := extractAppUserID(body)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id or user_id is required")
		return
	}
	result, err := h.service.RequestAccountDeletion(r.Context(), projectID, appUserID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Account deletion requested", result)
}

func (h *Handler) VerifyAccountDeletionOTP(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	appUserID := extractAppUserID(body)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id or user_id is required")
		return
	}
	if err := h.service.VerifyAccountDeletionOTP(r.Context(), projectID, appUserID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Account deletion confirmed", nil)
}

func (h *Handler) CancelAccountDeletion(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	appUserID := extractAppUserID(body)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id or user_id is required")
		return
	}
	if err := h.service.CancelAccountDeletion(r.Context(), projectID, appUserID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Account deletion cancelled", nil)
}
