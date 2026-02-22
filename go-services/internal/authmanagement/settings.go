package authmanagement

import (
	"net/http"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func (h *Handler) GetAuthSettingsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	settings, err := h.service.GetAuthSettings(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Auth settings fetched successfully", settings)
}

func (h *Handler) UpdateAuthSettingsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	settings, err := h.service.UpdateAuthSettings(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Auth settings updated successfully", settings)
}

func (h *Handler) GetEmailProvidersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providers, err := h.service.GetEmailProviders(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Email providers fetched successfully", providers)
}

func (h *Handler) GetSmsProvidersHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providers, err := h.service.GetSmsProviders(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "SMS providers fetched successfully", providers)
}

func (h *Handler) GetAllSessionDurationsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	durations, err := h.service.GetAllSessionDurations(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Session durations fetched successfully", durations)
}

func (h *Handler) GetSessionConfigHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	roleID, ok := parsePathInt(r, "roleId")
	if !ok {
		httputil.WriteError(w, 400, "Role ID is required")
		return
	}
	role, err := h.service.GetSessionConfig(r.Context(), projectID, roleID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if role == nil {
		httputil.WriteError(w, 404, "Role not found")
		return
	}
	httputil.WriteSuccess(w, 200, "Session config fetched successfully", map[string]any{
		"role_id": role.ID, "session_duration_minutes": role.SessionDurationMinutes,
	})
}

func (h *Handler) SendVerificationHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	schema, err := h.service.resolveSchema(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 404, "Project not found")
		return
	}
	userIDOrEmail, _ := body["user_id_or_email"].(string)
	if err := h.service.SendVerificationEmail(r.Context(), projectID, schema, userIDOrEmail); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Verification email sent", nil)
}

func (h *Handler) SendPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	schema, err := h.service.resolveSchema(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 404, "Project not found")
		return
	}
	userIDOrEmail, _ := body["user_id_or_email"].(string)
	if err := h.service.SendPasswordResetEmail(r.Context(), projectID, schema, userIDOrEmail); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Password reset email sent", nil)
}

func (h *Handler) VerifyOTPSettingsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	userIDRaw, _ := body["user_id"].(float64)
	code, _ := body["otp"].(string)
	if code == "" {
		code, _ = body["otp_code"].(string)
	}
	if err := h.service.VerifyOTPForSettings(r.Context(), projectID, int(userIDRaw), code); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "OTP verified", nil)
}

func (h *Handler) TestEmailProviderHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	providerIDRaw, _ := body["provider_id"].(float64)
	testEmail, _ := body["email"].(string)
	if testEmail == "" {
		testEmail, _ = body["test_email"].(string)
	}
	if err := h.service.TestEmailProvider(r.Context(), projectID, int(providerIDRaw), testEmail); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Test email sent successfully", nil)
}

func (h *Handler) TestSmsProviderHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	providerIDRaw, _ := body["provider_id"].(float64)
	phone, _ := body["phone"].(string)
	message, _ := body["message"].(string)
	if message == "" {
		message = "Test SMS from Skaftin"
	}
	if err := h.service.TestSmsProvider(r.Context(), projectID, int(providerIDRaw), phone, message); err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Test SMS sent successfully", nil)
}
