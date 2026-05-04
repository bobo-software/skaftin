package platformauth

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/supertokens"
)

func dummyPlatformSMTP() *config.PlatformSMTPSettings {
	return &config.PlatformSMTPSettings{
		SMTPHost:     "localhost",
		SMTPPort:     25,
		SMTPUser:     "u",
		SMTPPassword: "p",
		SMTPSecure:   false,
		FromEmail:    "from@example.com",
	}
}

func TestPasswordResetTokenSMTPNotConfigured(t *testing.T) {
	h := NewHandler(nil, supertokens.NewClient("http://unused", ""), "http://localhost:3005", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/user/password/reset/token", strings.NewReader(
		`{"formFields":[{"id":"email","value":"a@b.com"}]}`,
	))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if !strings.Contains(string(body), `"status":"GENERAL_ERROR"`) {
		t.Fatalf("expected GENERAL_ERROR, got %s", string(body))
	}
}

func TestPasswordResetTokenUnknownEmailReturnsFieldError(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/public/users/by-accountinfo" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"users":[]}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://localhost:3005", dummyPlatformSMTP())
	req := httptest.NewRequest(http.MethodPost, "/auth/user/password/reset/token", strings.NewReader(
		`{"formFields":[{"id":"email","value":"nobody@example.com"}]}`,
	))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if !strings.Contains(string(body), `"status":"FIELD_ERROR"`) || !strings.Contains(string(body), "No account found") {
		t.Fatalf("expected FIELD_ERROR with message, got %s", string(body))
	}
}

func TestPasswordResetSubmitForwardsToCore(t *testing.T) {
	var gotPath string
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		if r.Method != http.MethodPost || r.URL.Path != "/public/recipe/user/password/reset" {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), `"method":"token"`) || !strings.Contains(string(b), `"token":"tok1"`) {
			t.Fatalf("unexpected body: %s", string(b))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	defer stCore.Close()

	h := NewHandler(nil, supertokens.NewClient(stCore.URL, ""), "http://localhost:3005", nil)
	req := httptest.NewRequest(http.MethodPost, "/auth/user/password/reset", strings.NewReader(
		`{"method":"token","token":"tok1","formFields":[{"id":"password","value":"newsecret"}]}`,
	))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if gotPath != "/public/recipe/user/password/reset" {
		t.Fatalf("core path = %q", gotPath)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if !strings.Contains(string(body), `"status":"OK"`) {
		t.Fatalf("expected OK, got %s", string(body))
	}
}

func TestResetPasswordLinkFormat(t *testing.T) {
	got := resetPasswordLink("http://localhost:3005/", "abc+def")
	if got != "http://localhost:3005/auth/reset-password?token=abc%2Bdef" {
		t.Fatalf("unexpected link: %q", got)
	}
}
