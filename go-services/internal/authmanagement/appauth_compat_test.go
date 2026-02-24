package authmanagement

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/supertokens"
)

func TestLoginFromAppAPI_Success(t *testing.T) {
	var gotProjectID int
	var gotBody map[string]any

	h := &Handler{
		loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
			gotProjectID = projectID
			gotBody = body
			return map[string]any{"accessToken": "token-123"}, nil
		},
	}

	reqBody := map[string]any{
		"username": "alice@example.com",
		"password": "secret",
		"method":   "email",
	}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader(b))
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 42}))
	rec := httptest.NewRecorder()

	h.LoginFromAppAPI(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if gotProjectID != 42 {
		t.Fatalf("projectID = %d, want 42", gotProjectID)
	}
	if gotBody["credential"] != "alice@example.com" {
		t.Fatalf("credential = %v, want alice@example.com", gotBody["credential"])
	}
}

func TestLoginFromAppAPI_MissingAuthContext(t *testing.T) {
	h := &Handler{
		loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
			t.Fatal("loginFunc should not be called without auth context")
			return nil, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()

	h.LoginFromAppAPI(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestLoginFromAppAPI_LoginErrors(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "invalid credentials", err: errors.New("invalid credentials"), wantStatus: http.StatusUnauthorized},
		{name: "invalid credentials sentinel", err: ErrInvalidCredentials, wantStatus: http.StatusUnauthorized},
		{name: "auth disabled", err: errors.New("authentication is disabled"), wantStatus: http.StatusForbidden},
		{name: "auth disabled sentinel", err: ErrAuthenticationClosed, wantStatus: http.StatusForbidden},
		{name: "other", err: errors.New("credentials are required"), wantStatus: http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := &Handler{
				loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
					return nil, tc.err
				},
			}

			req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader([]byte(`{"username":"u","password":"p"}`)))
			req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 9}))
			rec := httptest.NewRecorder()

			h.LoginFromAppAPI(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d. body=%s", rec.Code, tc.wantStatus, rec.Body.String())
			}
		})
	}
}

func TestLogoutFromAppAPI_MissingAuthContext(t *testing.T) {
	h := &Handler{}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/logout", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()

	h.LogoutFromAppAPI(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestLogoutFromAppAPI_SuccessWithoutToken(t *testing.T) {
	h := &Handler{}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/logout", bytes.NewReader([]byte(`{}`)))
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 42}))
	rec := httptest.NewRecorder()

	h.LogoutFromAppAPI(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %#v", resp["data"])
	}
	if len(data) != 0 {
		t.Fatalf("expected empty data object, got %#v", data)
	}
}

func TestRefreshFromAppAPI_MissingAuthContext(t *testing.T) {
	h := &Handler{}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/session/refresh", nil)
	rec := httptest.NewRecorder()

	h.RefreshFromAppAPI(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRefreshFromAppAPI_ForwardsSuperTokensResponse(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/recipe/session/refresh" {
			t.Fatalf("path = %s, want /recipe/session/refresh", r.URL.Path)
		}
		if got := r.Header.Get("rid"); got != "session" {
			t.Fatalf("rid = %q, want session", got)
		}
		if got := r.Header.Get("Cookie"); got == "" {
			t.Fatalf("expected Cookie header to be forwarded")
		}
		if got := r.Header.Get("anti-csrf"); got != "csrf-token" {
			t.Fatalf("anti-csrf = %q, want csrf-token", got)
		}

		w.Header().Add("Set-Cookie", "sAccessToken=abc; Path=/; HttpOnly")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	defer stCore.Close()

	h := &Handler{
		service: &Service{
			st: supertokens.NewClient(stCore.URL, ""),
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/session/refresh", nil)
	req.Header.Set("Cookie", "sRefreshToken=xyz")
	req.Header.Set("anti-csrf", "csrf-token")
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 2}))
	rec := httptest.NewRecorder()

	h.RefreshFromAppAPI(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if got := rec.Header().Get("Set-Cookie"); got == "" {
		t.Fatalf("expected Set-Cookie to be forwarded")
	}
	if rec.Body.String() != `{"status":"OK"}` {
		t.Fatalf("body = %s, want %s", rec.Body.String(), `{"status":"OK"}`)
	}
}

func TestRefreshFromAppAPI_InvalidRefreshTokenPayloadFallsBackToCompatibilitySuccess(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"Field name 'refreshToken' is invalid in JSON input"}`))
	}))
	defer stCore.Close()

	h := &Handler{
		service: &Service{
			st: supertokens.NewClient(stCore.URL, ""),
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/session/refresh", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 2}))
	rec := httptest.NewRecorder()

	h.RefreshFromAppAPI(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}
	if success, _ := resp["success"].(bool); !success {
		t.Fatalf("expected success=true, got %#v", resp["success"])
	}
}
