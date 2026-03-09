package platformauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

type Handler struct {
	pool *pgxpool.Pool
	st   *supertokens.Client
}

func NewHandler(pool *pgxpool.Pool, st *supertokens.Client) *Handler {
	return &Handler{
		pool: pool,
		st:   st,
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/auth/signup":
		h.SignUp(w, r)
		return
	case r.Method == http.MethodPost && r.URL.Path == "/auth/signin":
		h.SignIn(w, r)
		return
	case r.Method == http.MethodPost && r.URL.Path == "/auth/signout":
		h.SignOut(w, r)
		return
	case r.Method == http.MethodPost && r.URL.Path == "/auth/session/refresh":
		h.RefreshSession(w, r)
		return
	case (r.Method == http.MethodGet || r.Method == http.MethodPost) && r.URL.Path == "/auth/user/email/verify":
		h.EmailVerify(w, r)
		return
	case r.Method == http.MethodPost && r.URL.Path == "/auth/user/email/verify/token":
		h.EmailVerifyToken(w, r)
		return
	case r.Method == http.MethodGet && r.URL.Path == "/auth/user":
		h.GetUser(w, r)
		return
	default:
		httputil.WriteError(w, http.StatusNotFound, "Route not available in Go auth handler")
	}
}

func (h *Handler) SignUp(w http.ResponseWriter, r *http.Request) {
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

	email := getFormField(req.FormFields, "email")
	password := getFormField(req.FormFields, "password")
	if email == "" || password == "" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "FIELD_ERROR",
			"formFields": []map[string]any{
				{
					"id":          "email",
					"error":       "Email and password are required",
					"value":       "",
					"optional":    false,
					"isSensitive": false,
				},
			},
		})
		return
	}

	signUpResp, err := h.st.SignUp(r.Context(), "public", email, password)
	if err != nil {
		slog.Error("platform auth signup failed", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}
	if signUpResp.Status == "EMAIL_ALREADY_EXISTS_ERROR" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "FIELD_ERROR",
			"formFields": []map[string]any{
				{"id": "email", "error": "Email already exists"},
			},
		})
		return
	}
	if signUpResp.Status != "OK" || signUpResp.User == nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}

	if err := h.migrateStaleUserRecords(r.Context(), signUpResp.User.ID); err != nil {
		slog.Warn("stale user migration failed after signup", "userId", signUpResp.User.ID, "error", err)
	}

	payload, err := h.buildAccessTokenPayload(r.Context(), signUpResp.User.ID)
	if err != nil {
		slog.Warn("failed to build platform auth claims", "userId", signUpResp.User.ID, "error", err)
		payload = map[string]any{"role": "user", "projectIds": []int{}}
	}

	sessionResp, err := h.st.CreateSession(r.Context(), "public", supertokens.CreateSessionRequest{
		UserID:               signUpResp.User.ID,
		AccessTokenPayload:   payload,
		EnableAntiCsrf:       false,
		UseDynamicSigningKey: true,
	})
	if err != nil {
		slog.Error("platform auth create session failed after signup", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}

	setSessionCookiesAndHeaders(w, sessionResp, payload)
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status": "OK",
		"user": map[string]any{
			"id":         signUpResp.User.ID,
			"email":      firstOrEmpty(signUpResp.User.Emails),
			"timeJoined": signUpResp.User.TimeJoined,
		},
	})
}

func (h *Handler) SignIn(w http.ResponseWriter, r *http.Request) {
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

	email := getFormField(req.FormFields, "email")
	password := getFormField(req.FormFields, "password")
	if email == "" || password == "" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "WRONG_CREDENTIALS_ERROR",
		})
		return
	}

	signInResp, err := h.st.SignIn(r.Context(), "public", email, password)
	if err != nil {
		slog.Error("platform auth signin failed", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}
	if signInResp.Status == "WRONG_CREDENTIALS_ERROR" {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "WRONG_CREDENTIALS_ERROR",
		})
		return
	}
	if signInResp.Status != "OK" || signInResp.User == nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}

	if err := h.migrateStaleUserRecords(r.Context(), signInResp.User.ID); err != nil {
		slog.Warn("stale user migration failed after signin", "userId", signInResp.User.ID, "error", err)
	}

	payload, err := h.buildAccessTokenPayload(r.Context(), signInResp.User.ID)
	if err != nil {
		slog.Warn("failed to build platform auth claims", "userId", signInResp.User.ID, "error", err)
		payload = map[string]any{"role": "user", "projectIds": []int{}}
	}

	sessionResp, err := h.st.CreateSession(r.Context(), "public", supertokens.CreateSessionRequest{
		UserID:               signInResp.User.ID,
		AccessTokenPayload:   payload,
		EnableAntiCsrf:       false,
		UseDynamicSigningKey: true,
	})
	if err != nil {
		slog.Error("platform auth create session failed after signin", "error", err)
		httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "GENERAL_ERROR"})
		return
	}

	setSessionCookiesAndHeaders(w, sessionResp, payload)
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status": "OK",
		"user": map[string]any{
			"id":         signInResp.User.ID,
			"email":      firstOrEmpty(signInResp.User.Emails),
			"timeJoined": signInResp.User.TimeJoined,
		},
	})
}

func (h *Handler) SignOut(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	if token != "" {
		if sessionResp, err := h.st.GetSession(r.Context(), token); err == nil && sessionResp != nil && sessionResp.Session.UserID != "" {
			_, _ = h.st.RevokeAllSessionsForUser(r.Context(), sessionResp.Session.UserID)
		}
	}
	clearSessionCookies(w)
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"status": "OK"})
}

func (h *Handler) RefreshSession(w http.ResponseWriter, r *http.Request) {
	resp, err := h.st.RefreshSession(r.Context(), r.Header)
	if err != nil {
		slog.Error("platform auth refresh failed", "error", err)
		httputil.WriteError(w, http.StatusBadGateway, "Session refresh unavailable")
		return
	}
	if shouldReturnRefreshCompatibilitySuccess(resp.StatusCode, resp.Body) {
		// No valid refresh token was sent - the session is gone.
		// Return 401 so the SuperTokens frontend SDK recognises the session as expired
		// and stops retrying (returning 200 here causes an infinite refresh loop).
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"unauthorised"}`))
		return
	}

	copyRefreshHeaders(w.Header(), resp.Headers)
	h.ensureFrontToken(w, r)
	w.WriteHeader(resp.StatusCode)
	if len(resp.Body) > 0 {
		_, _ = w.Write(resp.Body)
	}
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"unauthorised"}`))
		return
	}

	sessionResp, err := h.st.GetSession(r.Context(), token)
	if err != nil || sessionResp == nil || sessionResp.Session.UserID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"unauthorised"}`))
		return
	}

	claims, _ := sessionResp.Session.UserDataInAccessToken.(map[string]any)
	if claims == nil {
		claims = map[string]any{}
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status": "OK",
		"id":     sessionResp.Session.UserID,
		"user": map[string]any{
			"id": sessionResp.Session.UserID,
		},
		"accessTokenPayload": claims,
	})
}

func (h *Handler) EmailVerify(w http.ResponseWriter, r *http.Request) {
	corePath := "/recipe/user/email/verify"
	query := r.URL.Query()
	needsUserID := query.Get("userId") == ""
	needsEmail := query.Get("email") == ""

	if needsUserID || needsEmail {
		if token := extractAccessToken(r); token != "" {
			if sessionResp, err := h.st.GetSession(r.Context(), token); err == nil && sessionResp != nil && sessionResp.Session.UserID != "" {
				userID := sessionResp.Session.UserID
				if needsUserID {
					query.Set("userId", userID)
				}
				if needsEmail {
					if user, userErr := h.st.GetUserByID(r.Context(), userID); userErr == nil && user != nil && len(user.Emails) > 0 && user.Emails[0] != "" {
						query.Set("email", user.Emails[0])
					}
				}
			}
		}
	}
	if encoded := query.Encode(); encoded != "" {
		corePath += "?" + encoded
	}
	h.proxyToSuperTokens(w, r, corePath, "emailverification")
}

func (h *Handler) EmailVerifyToken(w http.ResponseWriter, r *http.Request) {
	h.proxyToSuperTokens(w, r, "/recipe/user/email/verify/token", "emailverification")
}

func getFormField(fields []struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}, id string) string {
	for _, f := range fields {
		if f.ID == id {
			return strings.TrimSpace(f.Value)
		}
	}
	return ""
}

func extractAccessToken(r *http.Request) string {
	if c, err := r.Cookie("sAccessToken"); err == nil && c.Value != "" {
		return c.Value
	}
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func copyRefreshHeaders(dst, src http.Header) {
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

func copyPassthroughHeaders(dst, src http.Header) {
	for k, values := range src {
		switch strings.ToLower(k) {
		case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "content-length":
			continue
		}
		dst.Del(k)
		for _, v := range values {
			dst.Add(k, v)
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

func (h *Handler) proxyToSuperTokens(w http.ResponseWriter, r *http.Request, corePath, recipeID string) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	resp, err := h.st.ForwardRecipeRequest(r.Context(), r.Method, corePath, recipeID, r.Header, body)
	if err != nil {
		slog.Error("platform auth proxy failed", "path", corePath, "method", r.Method, "error", err)
		httputil.WriteError(w, http.StatusBadGateway, "Auth service unavailable")
		return
	}

	copyPassthroughHeaders(w.Header(), resp.Headers)
	w.WriteHeader(resp.StatusCode)
	if len(resp.Body) > 0 {
		_, _ = w.Write(resp.Body)
	}
}

func (h *Handler) ensureFrontToken(w http.ResponseWriter, r *http.Request) {
	headers := w.Header()
	if headers.Get("front-token") != "" {
		return
	}
	if c, err := r.Cookie("sFrontToken"); err == nil && c.Value != "" {
		headers.Set("front-token", c.Value)
		return
	}
	token := extractAccessToken(r)
	if token == "" {
		return
	}
	sessionResp, err := h.st.GetSession(r.Context(), token)
	if err != nil || sessionResp == nil || sessionResp.Session.UserID == "" {
		return
	}

	now := time.Now()
	accessExpiry := time.UnixMilli(sessionResp.AccessToken.Expiry)
	if sessionResp.AccessToken.Expiry == 0 {
		accessExpiry = now.Add(1 * time.Hour)
	}
	payload, _ := sessionResp.Session.UserDataInAccessToken.(map[string]any)
	if payload == nil {
		payload = map[string]any{}
	}
	frontTokenPayload := map[string]any{
		"uid": sessionResp.Session.UserID,
		"up":  payload,
		"ate": accessExpiry.UnixMilli(),
	}
	b, _ := json.Marshal(frontTokenPayload)
	frontToken := base64.RawStdEncoding.EncodeToString(b)
	headers.Set("front-token", frontToken)

	http.SetCookie(w, &http.Cookie{
		Name:     "sFrontToken",
		Value:    frontToken,
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		Expires:  accessExpiry,
	})
}

func setSessionCookiesAndHeaders(w http.ResponseWriter, session *supertokens.CreateSessionResponse, payload map[string]any) {
	now := time.Now()
	accessExpiry := time.UnixMilli(session.AccessToken.Expiry)
	if session.AccessToken.Expiry == 0 {
		accessExpiry = now.Add(1 * time.Hour)
	}
	refreshExpiry := time.UnixMilli(session.RefreshToken.Expiry)
	if session.RefreshToken.Expiry == 0 {
		refreshExpiry = now.Add(30 * 24 * time.Hour)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "sAccessToken",
		Value:    session.AccessToken.Token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  accessExpiry,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "sRefreshToken",
		Value:    session.RefreshToken.Token,
		Path:     "/auth/session/refresh",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  refreshExpiry,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "sIdRefreshToken",
		Value:    session.Session.Handle,
		Path:     "/auth/session/refresh",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  refreshExpiry,
	})

	frontTokenPayload := map[string]any{
		"uid": session.Session.UserID,
		"up":  payload,
		"ate": accessExpiry.UnixMilli(),
	}
	b, _ := json.Marshal(frontTokenPayload)
	w.Header().Set("front-token", base64.RawStdEncoding.EncodeToString(b))
	w.Header().Set("st-access-token", "set")
	w.Header().Set("st-refresh-token", "set")
	w.Header().Set("id-refresh-token", session.Session.Handle)
}

func clearSessionCookies(w http.ResponseWriter) {
	expired := time.Unix(0, 0)
	for _, c := range []*http.Cookie{
		{Name: "sAccessToken", Path: "/"},
		{Name: "sRefreshToken", Path: "/auth/session/refresh"},
		{Name: "sIdRefreshToken", Path: "/auth/session/refresh"},
	} {
		c.Value = ""
		c.HttpOnly = true
		c.Expires = expired
		c.MaxAge = -1
		c.SameSite = http.SameSiteLaxMode
		http.SetCookie(w, c)
	}
}

func firstOrEmpty(items []string) string {
	if len(items) == 0 {
		return ""
	}
	return items[0]
}

func (h *Handler) buildAccessTokenPayload(ctx context.Context, userID string) (map[string]any, error) {
	projectIDs, role, err := h.getUserClaims(ctx, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"projectIds": projectIDs,
		"role":       role,
	}, nil
}

func (h *Handler) getUserClaims(ctx context.Context, userID string) ([]int, string, error) {
	role := "user"
	projectIDs := make([]int, 0)

	projectRows, err := h.pool.Query(ctx, `
		SELECT id
		FROM skaftin_system_projects
		WHERE user_id = $1
		  AND deletion_scheduled_at IS NULL
		  AND deleted_at IS NULL
	`, userID)
	if err != nil {
		return nil, "", fmt.Errorf("query owned projects: %w", err)
	}
	defer projectRows.Close()
	for projectRows.Next() {
		var id int
		if err := projectRows.Scan(&id); err == nil {
			projectIDs = append(projectIDs, id)
		}
	}

	memberRows, err := h.pool.Query(ctx, `
		SELECT DISTINCT pm.project_id
		FROM skaftin_system_project_members pm
		INNER JOIN skaftin_system_projects p ON p.id = pm.project_id
		WHERE pm.user_id = $1
		  AND p.deletion_scheduled_at IS NULL
		  AND p.deleted_at IS NULL
	`, userID)
	if err != nil {
		return nil, "", fmt.Errorf("query member projects: %w", err)
	}
	defer memberRows.Close()
	for memberRows.Next() {
		var id int
		if err := memberRows.Scan(&id); err == nil {
			projectIDs = append(projectIDs, id)
		}
	}

	orgRows, err := h.pool.Query(ctx, `
		SELECT organization_id, role
		FROM skaftin_system_organization_members
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, "", fmt.Errorf("query org memberships: %w", err)
	}
	defer orgRows.Close()

	orgIDs := make([]int, 0)
	for orgRows.Next() {
		var orgID int
		var orgRole string
		if err := orgRows.Scan(&orgID, &orgRole); err == nil {
			orgIDs = append(orgIDs, orgID)
			if orgRole == "owner" || orgRole == "admin" {
				role = "admin"
			}
		}
	}

	for _, orgID := range orgIDs {
		rows, err := h.pool.Query(ctx, `
			SELECT id
			FROM skaftin_system_projects
			WHERE organization_id = $1
			  AND deletion_scheduled_at IS NULL
			  AND deleted_at IS NULL
		`, orgID)
		if err != nil {
			return nil, "", fmt.Errorf("query org projects: %w", err)
		}
		for rows.Next() {
			var id int
			if err := rows.Scan(&id); err == nil {
				projectIDs = append(projectIDs, id)
			}
		}
		rows.Close()
	}

	seen := make(map[int]struct{}, len(projectIDs))
	unique := make([]int, 0, len(projectIDs))
	for _, id := range projectIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	return unique, role, nil
}

func (h *Handler) migrateStaleUserRecords(ctx context.Context, currentUserID string) error {
	user, err := h.st.GetUserByID(ctx, currentUserID)
	if err != nil || user == nil || len(user.Emails) == 0 {
		return nil
	}
	email := user.Emails[0]

	usersWithEmail, err := h.st.ListUsersByAccountInfo(ctx, "public", email)
	if err != nil {
		return fmt.Errorf("list users by account info: %w", err)
	}

	for _, staleUser := range usersWithEmail {
		oldUserID := staleUser.ID
		if oldUserID == "" || oldUserID == currentUserID {
			continue
		}
		if _, err := h.pool.Exec(ctx, `
			UPDATE skaftin_system_organization_members
			SET user_id = $1
			WHERE user_id = $2
			  AND organization_id NOT IN (
			    SELECT organization_id FROM skaftin_system_organization_members WHERE user_id = $1
			  )
		`, currentUserID, oldUserID); err != nil {
			return fmt.Errorf("migrate organization_members: %w", err)
		}
		if _, err := h.pool.Exec(ctx, `
			DELETE FROM skaftin_system_organization_members
			WHERE user_id = $1
		`, oldUserID); err != nil {
			return fmt.Errorf("cleanup old organization_members: %w", err)
		}
		if _, err := h.pool.Exec(ctx, `
			UPDATE skaftin_system_organizations
			SET owner_id = $1
			WHERE owner_id = $2
		`, currentUserID, oldUserID); err != nil {
			return fmt.Errorf("migrate organizations owner_id: %w", err)
		}
		if _, err := h.pool.Exec(ctx, `
			UPDATE skaftin_system_projects
			SET user_id = $1
			WHERE user_id = $2
		`, currentUserID, oldUserID); err != nil {
			return fmt.Errorf("migrate projects owner user_id: %w", err)
		}
		if _, err := h.pool.Exec(ctx, `
			UPDATE skaftin_system_project_members
			SET user_id = $1
			WHERE user_id = $2
			  AND project_id NOT IN (
			    SELECT project_id FROM skaftin_system_project_members WHERE user_id = $1
			  )
		`, currentUserID, oldUserID); err != nil {
			return fmt.Errorf("migrate project_members: %w", err)
		}
		if _, err := h.pool.Exec(ctx, `
			DELETE FROM skaftin_system_project_members
			WHERE user_id = $1
		`, oldUserID); err != nil {
			return fmt.Errorf("cleanup old project_members: %w", err)
		}
	}
	return nil
}
