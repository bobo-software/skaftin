package authmanagement

import (
	"net/http"
	"strings"

	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

func (h *Handler) LegacyRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Email == "" || body.Password == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email and password are required")
		return
	}
	if len(body.Password) < 6 {
		httputil.WriteError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	signUpResponse, err := h.service.st.SignUp(r.Context(), "public", body.Email, body.Password)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}
	if signUpResponse.Status == "EMAIL_ALREADY_EXISTS_ERROR" {
		httputil.WriteError(w, http.StatusConflict, "Email already registered")
		return
	}
	if signUpResponse.Status != "OK" || signUpResponse.User == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}

	name := body.FullName
	if name == "" {
		name = deriveName(body.Email)
	}
	sessionResp, err := h.service.st.CreateSession(r.Context(), "public", supertokens.CreateSessionRequest{
		UserID: signUpResponse.User.ID,
		UserDataInAccessToken: map[string]any{
			"email": body.Email,
			"name":  name,
		},
	})
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}

	accessToken := sessionResp.AccessToken.Token
	refreshToken := sessionResp.RefreshToken.Token
	httputil.WriteSuccess(w, http.StatusCreated, "User registered successfully", map[string]any{
		"user": map[string]any{
			"id":    signUpResponse.User.ID,
			"email": body.Email,
			"name":  name,
		},
		"token":        accessToken,
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

func (h *Handler) LegacyLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Email == "" || body.Password == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	signInResponse, err := h.service.st.SignIn(r.Context(), "public", body.Email, body.Password)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to login")
		return
	}
	if signInResponse.Status == "WRONG_CREDENTIALS_ERROR" {
		httputil.WriteError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	if signInResponse.Status != "OK" || signInResponse.User == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to login")
		return
	}

	name := deriveName(body.Email)
	sessionResp, err := h.service.st.CreateSession(r.Context(), "public", supertokens.CreateSessionRequest{
		UserID: signInResponse.User.ID,
		UserDataInAccessToken: map[string]any{
			"email": body.Email,
			"name":  name,
		},
	})
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to login")
		return
	}

	accessToken := sessionResp.AccessToken.Token
	refreshToken := sessionResp.RefreshToken.Token
	httputil.WriteSuccess(w, http.StatusOK, "Login successful", map[string]any{
		"user": map[string]any{
			"id":    signInResponse.User.ID,
			"email": body.Email,
			"name":  name,
		},
		"token":        accessToken,
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

func (h *Handler) LegacyVerify(w http.ResponseWriter, r *http.Request) {
	token := extractLegacyToken(r)
	if token == "" {
		httputil.WriteError(w, http.StatusUnauthorized, "Session not found")
		return
	}
	sessionResp, err := h.service.st.GetSession(r.Context(), token)
	if err != nil || sessionResp == nil || sessionResp.Session.UserID == "" {
		httputil.WriteError(w, http.StatusForbidden, "Invalid or expired token")
		return
	}

	payload, _ := sessionResp.Session.UserDataInAccessToken.(map[string]any)
	email, _ := payload["email"].(string)
	name, _ := payload["name"].(string)

	httputil.WriteSuccess(w, http.StatusOK, "Token is valid", map[string]any{
		"user": map[string]any{
			"id":         sessionResp.Session.UserID,
			"email":      email,
			"name":       defaultName(name),
			"projectIds": []any{},
			"role":       "user",
		},
	})
}

func (h *Handler) LegacyRefresh(w http.ResponseWriter, r *http.Request) {
	httputil.WriteSuccess(w, http.StatusOK, "Session refresh is handled automatically by SuperTokens", map[string]any{
		"message": "No action needed - sessions are automatically refreshed",
	})
}

func (h *Handler) LegacyLogout(w http.ResponseWriter, r *http.Request) {
	token := extractLegacyToken(r)
	if token == "" {
		httputil.WriteError(w, http.StatusUnauthorized, "No active session")
		return
	}
	if err := h.service.Logout(r.Context(), token); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to logout")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Logged out successfully", map[string]any{})
}

func extractLegacyToken(r *http.Request) string {
	if token := extractBearerToken(r); token != "" {
		return token
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		return ""
	}
	if token, ok := body["accessToken"].(string); ok && token != "" {
		return token
	}
	if token, ok := body["token"].(string); ok && token != "" {
		return token
	}
	return ""
}

func deriveName(email string) string {
	local := strings.SplitN(email, "@", 2)[0]
	if local == "" {
		return "User"
	}
	return local
}

func defaultName(name string) string {
	if name == "" {
		return "User"
	}
	return name
}
