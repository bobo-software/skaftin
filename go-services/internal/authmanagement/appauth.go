package authmanagement

import (
	"net/http"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

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
	result, err := h.service.Login(r.Context(), projectID, body)
	if err != nil {
		if err.Error() == "invalid credentials" || err.Error() == "authentication is disabled" {
			httputil.WriteError(w, 401, err.Error())
			return
		}
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Login successful", result)
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
	httputil.WriteSuccess(w, 200, "Logged out", nil)
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
	appUserIDRaw, _ := body["app_user_id"].(float64)
	appUserID := int(appUserIDRaw)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id is required")
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
	appUserIDRaw, _ := body["app_user_id"].(float64)
	appUserID := int(appUserIDRaw)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id is required")
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
	appUserIDRaw, _ := body["app_user_id"].(float64)
	appUserID := int(appUserIDRaw)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id is required")
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
	appUserIDRaw, _ := body["app_user_id"].(float64)
	appUserID := int(appUserIDRaw)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id is required")
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
	appUserIDRaw, _ := body["app_user_id"].(float64)
	appUserID := int(appUserIDRaw)
	if appUserID == 0 {
		httputil.WriteError(w, 400, "app_user_id is required")
		return
	}
	if err := h.service.CancelAccountDeletion(r.Context(), projectID, appUserID, body); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Account deletion cancelled", nil)
}
