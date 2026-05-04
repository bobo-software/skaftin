package platformauth

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/skaftin/go-services/internal/supertokens"
)

func TestRefreshSessionForwardsHeadersAndCookies(t *testing.T) {
	var gotCookie string
	var gotAntiCSRF string

	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/recipe/session/refresh" {
			t.Fatalf("path = %s, want /recipe/session/refresh", r.URL.Path)
		}
		gotCookie = r.Header.Get("Cookie")
		gotAntiCSRF = r.Header.Get("anti-csrf")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Add("Set-Cookie", "sAccessToken=next-token; Path=/; HttpOnly")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/session/refresh", strings.NewReader(`{}`))
	req.Header.Set("Cookie", "sRefreshToken=refresh-value")
	req.Header.Set("anti-csrf", "csrf-token")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if gotCookie != "sRefreshToken=refresh-value" {
		t.Fatalf("cookie header not forwarded: got %q", gotCookie)
	}
	if gotAntiCSRF != "csrf-token" {
		t.Fatalf("anti-csrf header not forwarded: got %q", gotAntiCSRF)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if setCookie := rec.Header().Get("Set-Cookie"); setCookie == "" {
		t.Fatalf("expected Set-Cookie to be forwarded")
	}
}

func TestRefreshSessionCompatibilityErrorReturnsUnauthorized(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"Field name 'refreshToken' is invalid in JSON input"}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/session/refresh", strings.NewReader(`{}`))
	req.AddCookie(&http.Cookie{Name: "sFrontToken", Value: "front-token-cookie"})
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (SDK must not spin on missing refresh token)", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"message":"unauthorised"`) {
		t.Fatalf("expected unauthorised body, got: %s", rec.Body.String())
	}
}

func TestRefreshSessionBuildsFrontTokenWhenMissing(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/recipe/session/refresh":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"OK"}`))
		case "/recipe/session/verify":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"OK","session":{"handle":"h1","userId":"u1","userDataInAccessToken":{"role":"user","projectIds":[1]}},"accessToken":{"token":"tok","expiry":253402300799000}}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/session/refresh", strings.NewReader(`{}`))
	req.AddCookie(&http.Cookie{Name: "sAccessToken", Value: "opaque-token"})
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("front-token"); got == "" {
		t.Fatalf("expected front-token header to be set")
	} else {
		var payload map[string]any
		raw, err := base64.RawStdEncoding.DecodeString(got)
		if err != nil {
			t.Fatalf("decode front-token: %v", err)
		}
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Fatalf("unmarshal front-token payload: %v", err)
		}
		ate, ok := payload["ate"].(float64)
		if !ok {
			t.Fatalf("front-token ate missing or invalid: %#v", payload["ate"])
		}
		if ate < 1_000_000_000_000 {
			t.Fatalf("front-token ate appears to be seconds, want milliseconds: %v", ate)
		}
	}
}

func TestEmailVerifyRouteProxiesToSuperTokens(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/recipe/user/email/verify" {
			t.Fatalf("path = %s, want /recipe/user/email/verify", r.URL.Path)
		}
		if token := r.URL.Query().Get("token"); token != "verify-token" {
			t.Fatalf("token = %q, want verify-token", token)
		}
		if rid := r.Header.Get("rid"); rid != "emailverification" {
			t.Fatalf("rid = %q, want emailverification", rid)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodGet, "/auth/user/email/verify?token=verify-token", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"status":"OK"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestEmailVerifyRouteInjectsUserIDFromSessionWhenMissing(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/recipe/session/verify":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"OK","session":{"handle":"h1","userId":"u-from-session","userDataInAccessToken":{"role":"user"}},"accessToken":{"token":"tok","expiry":253402300799000}}`))
		case "/user/id":
			if got := r.URL.Query().Get("userId"); got != "u-from-session" {
				t.Fatalf("userId query = %q, want u-from-session", got)
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"OK","user":{"id":"u-from-session","emails":["test@example.com"]}}`))
		case "/recipe/user/email/verify":
			if got := r.URL.Query().Get("userId"); got != "u-from-session" {
				t.Fatalf("userId = %q, want u-from-session", got)
			}
			if got := r.URL.Query().Get("email"); got != "test@example.com" {
				t.Fatalf("email = %q, want test@example.com", got)
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"OK","isVerified":true}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodGet, "/auth/user/email/verify", nil)
	req.AddCookie(&http.Cookie{Name: "sAccessToken", Value: "opaque-token"})
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"isVerified":true`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestEmailVerifyTokenRouteProxiesToSuperTokens(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/recipe/user/email/verify/token" {
			t.Fatalf("path = %s, want /recipe/user/email/verify/token", r.URL.Path)
		}
		if rid := r.Header.Get("rid"); rid != "emailverification" {
			t.Fatalf("rid = %q, want emailverification", rid)
		}
		body, _ := io.ReadAll(r.Body)
		if strings.TrimSpace(string(body)) != `{"foo":"bar"}` {
			t.Fatalf("body = %s, want forwarded JSON body", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://app.test", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/user/email/verify/token", strings.NewReader(`{"foo":"bar"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"status":"OK"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestSetSessionCookiesAndHeaders_UsesMillisecondExpiryInFrontToken(t *testing.T) {
	rec := httptest.NewRecorder()
	expiry := time.Now().Add(10 * time.Minute).UnixMilli()
	setSessionCookiesAndHeaders(rec, &supertokens.CreateSessionResponse{
		Session: supertokens.SessionInfo{
			Handle: "h1",
			UserID: "u1",
		},
		AccessToken: supertokens.TokenInfo{
			Token:  "access-token",
			Expiry: expiry,
		},
		RefreshToken: supertokens.TokenInfo{
			Token:  "refresh-token",
			Expiry: expiry + int64(24*time.Hour/time.Millisecond),
		},
	}, map[string]any{"role": "user"})

	frontToken := rec.Header().Get("front-token")
	if frontToken == "" {
		t.Fatalf("expected front-token header")
	}
	raw, err := base64.RawStdEncoding.DecodeString(frontToken)
	if err != nil {
		t.Fatalf("decode front-token: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal front-token payload: %v", err)
	}
	ate, ok := payload["ate"].(float64)
	if !ok {
		t.Fatalf("front-token ate missing or invalid: %#v", payload["ate"])
	}
	if int64(ate) != expiry {
		t.Fatalf("front-token ate = %d, want %d", int64(ate), expiry)
	}
}

func TestUnknownAuthPathReturnsNotFound(t *testing.T) {
	h := NewHandler(nil, nil, "http://app.test", nil)

	req := httptest.NewRequest(http.MethodGet, "/auth/authorisationurl", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestSignOutClearsSessionCookies(t *testing.T) {
	h := NewHandler(nil, nil, "http://app.test", nil)

	req := httptest.NewRequest(http.MethodPost, "/auth/signout", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if !strings.Contains(string(body), `"status":"OK"`) {
		t.Fatalf("unexpected body: %s", string(body))
	}
	if len(rec.Result().Cookies()) == 0 {
		t.Fatalf("expected cookie clearing headers")
	}
}
