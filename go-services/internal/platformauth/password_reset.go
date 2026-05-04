package platformauth

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

const platformTenantID = "public"

// PasswordResetToken handles POST /auth/user/password/reset/token (SuperTokens web-js contract).
func (h *Handler) PasswordResetToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FormFields []struct {
			ID    string `json:"id"`
			Value string `json:"value"`
		} `json:"formFields"`
	}
	if err := httputil.ReadJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	email := strings.TrimSpace(getFormField(req.FormFields, "email"))
	if email == "" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "FIELD_ERROR",
			"formFields": []map[string]any{
				{"id": "email", "error": "Field is not optional"},
			},
		})
		return
	}

	if h.platformSMTPSettings == nil {
		slog.Warn("password reset requested but platform SMTP is not configured")
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status":         "GENERAL_ERROR",
			"message":        "Password reset email is not configured on this server",
			"isGeneralError": true,
		})
		return
	}

	users, err := h.st.ListUsersByAccountInfo(r.Context(), platformTenantID, email)
	if err != nil {
		slog.Error("password reset list users failed", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Something went wrong", "isGeneralError": true})
		return
	}
	if len(users) == 0 {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "FIELD_ERROR",
			"formFields": []map[string]any{
				{"id": "email", "error": "No account found with this email address. Check the spelling or sign up."},
			},
		})
		return
	}

	user := users[0]
	if user.ID == "" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "FIELD_ERROR",
			"formFields": []map[string]any{
				{"id": "email", "error": "No account found with this email address. Check the spelling or sign up."},
			},
		})
		return
	}

	tokResp, err := h.st.CreatePasswordResetToken(r.Context(), platformTenantID, user.ID, email)
	if err != nil {
		slog.Error("password reset create token failed", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Something went wrong", "isGeneralError": true})
		return
	}

	switch tokResp.Status {
	case "OK":
		if tokResp.Token == "" {
			slog.Error("password reset token missing from core response")
			httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Something went wrong", "isGeneralError": true})
			return
		}
	case "PASSWORD_RESET_NOT_ALLOWED":
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "PASSWORD_RESET_NOT_ALLOWED", "reason": "Cannot reset password for this account"})
		return
	default:
		slog.Warn("password reset token unexpected status", "status", tokResp.Status)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "PASSWORD_RESET_NOT_ALLOWED", "reason": "Cannot reset password for this account"})
		return
	}

	resetURL := resetPasswordLink(h.frontendURL, tokResp.Token)
	subject := "Reset your Skaftin password"
	textBody := fmt.Sprintf("Click the link below to reset your password:\n\n%s\n\nIf you did not request this, you can ignore this email.", resetURL)
	htmlBody := fmt.Sprintf(`<p>Click the link below to reset your password:</p><p><a href="%s">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`, htmlAttrEscape(resetURL))

	provider := platformEmailProvider(h.platformSMTPSettings)
	if err := communications.SendSMTPMessage(r.Context(), provider, []string{email}, nil, nil, subject, textBody, htmlBody); err != nil {
		slog.Error("password reset email send failed", "email", email, "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Failed to send reset email", "isGeneralError": true})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "OK"})
}

func resetPasswordLink(frontendBase, token string) string {
	base := strings.TrimRight(strings.TrimSpace(frontendBase), "/")
	return base + "/auth/reset-password?token=" + url.QueryEscape(token)
}

func platformEmailProvider(s *config.PlatformSMTPSettings) *communications.EmailProvider {
	if s == nil {
		return nil
	}
	var fn *string
	if strings.TrimSpace(s.FromName) != "" {
		v := strings.TrimSpace(s.FromName)
		fn = &v
	}
	return &communications.EmailProvider{
		ProviderType: communications.EmailProviderTypeSMTP,
		SMTPHost:     s.SMTPHost,
		SMTPPort:     s.SMTPPort,
		SMTPSecure:   s.SMTPSecure,
		SMTPUser:     s.SMTPUser,
		SMTPPassword: s.SMTPPassword,
		FromEmail:    s.FromEmail,
		FromName:     fn,
		IsActive:     true,
	}
}

func htmlAttrEscape(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(s, `&`, `&amp;`), `"`, `&quot;`), `<`, `&lt;`)
}

// PasswordReset handles POST /auth/user/password/reset (SuperTokens web-js: formFields + token + method).
func (h *Handler) PasswordReset(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FormFields []struct {
			ID    string `json:"id"`
			Value string `json:"value"`
		} `json:"formFields"`
		Token  string `json:"token"`
		Method string `json:"method"`
	}
	if err := httputil.ReadJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(req.Method) != "" && req.Method != "token" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "RESET_PASSWORD_INVALID_TOKEN_ERROR"})
		return
	}
	token := strings.TrimSpace(req.Token)
	password := getFormField(req.FormFields, "password")
	if token == "" || password == "" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "RESET_PASSWORD_INVALID_TOKEN_ERROR"})
		return
	}

	resp, err := h.st.ResetPasswordWithToken(r.Context(), platformTenantID, token, password)
	if err != nil {
		slog.Error("password reset submit failed", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Something went wrong", "isGeneralError": true})
		return
	}

	switch resp.Status {
	case "OK":
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "OK"})
	case "RESET_PASSWORD_INVALID_TOKEN_ERROR":
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "RESET_PASSWORD_INVALID_TOKEN_ERROR"})
	case "FIELD_ERROR":
		out := map[string]any{"status": "FIELD_ERROR"}
		if len(resp.FormFields) > 0 {
			ff := make([]map[string]any, 0, len(resp.FormFields))
			for _, f := range resp.FormFields {
				ff = append(ff, map[string]any{"id": f.ID, "error": f.Error})
			}
			out["formFields"] = ff
		} else {
			out["formFields"] = []map[string]any{{"id": "password", "error": "Invalid password"}}
		}
		httputil.WriteJSON(w, http.StatusOK, out)
	default:
		slog.Warn("password reset unexpected status", "status", resp.Status)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR", "message": "Something went wrong", "isGeneralError": true})
	}
}
