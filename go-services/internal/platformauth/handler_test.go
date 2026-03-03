package platformauth

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""))
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

func TestUnknownAuthPathReturnsNotFound(t *testing.T) {
	h := NewHandler(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/auth/authorisationurl", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestSignOutClearsSessionCookies(t *testing.T) {
	h := NewHandler(nil, nil)

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
