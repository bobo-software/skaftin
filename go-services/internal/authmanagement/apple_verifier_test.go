package authmanagement

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseAppleBoolClaim(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want bool
	}{
		{name: "bool true", in: true, want: true},
		{name: "bool false", in: false, want: false},
		{name: "string true", in: "true", want: true},
		{name: "string TRUE", in: "TRUE", want: true},
		{name: "string false", in: "false", want: false},
		{name: "nil", in: nil, want: false},
		{name: "number", in: 1, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseAppleBoolClaim(tc.in); got != tc.want {
				t.Fatalf("parseAppleBoolClaim(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestParseAppleFullName(t *testing.T) {
	given, family := parseAppleFullName(map[string]any{
		"fullName": map[string]any{
			"givenName":  " Jane ",
			"familyName": " Doe ",
		},
	})
	if given != "Jane" || family != "Doe" {
		t.Fatalf("got given=%q family=%q, want Jane/Doe", given, family)
	}

	given, family = parseAppleFullName(map[string]any{})
	if given != "" || family != "" {
		t.Fatalf("expected empty names for missing fullName, got %q %q", given, family)
	}
}

func TestAppleDisplayName(t *testing.T) {
	name, last := appleDisplayName("Jane", "Doe", "jane@example.com")
	if name != "Jane" || last != "Doe" {
		t.Fatalf("got %q %q, want Jane Doe", name, last)
	}

	name, last = appleDisplayName("", "", "jane@example.com")
	if name != "jane" || last != "" {
		t.Fatalf("got %q %q, want jane/empty", name, last)
	}

	name, last = appleDisplayName("", "", "")
	if name != "Apple User" || last != "" {
		t.Fatalf("got %q %q, want Apple User/empty", name, last)
	}
}

func TestVerifyAppleIdentityToken_NoClientIDs(t *testing.T) {
	_, err := verifyAppleIdentityToken(context.Background(), "token", nil)
	if err == nil {
		t.Fatal("expected error for missing client IDs")
	}
	_, err = verifyAppleIdentityToken(context.Background(), "token", []string{"", "  "})
	if err == nil {
		t.Fatal("expected error for empty client IDs")
	}
}

func TestWriteAppleSignInError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "invalid token", err: ErrInvalidAppleToken, wantStatus: http.StatusUnauthorized},
		{name: "disabled", err: ErrAppleSignInDisabled, wantStatus: http.StatusForbidden},
		{name: "auto register disabled", err: ErrAppleAutoRegisterDisabled, wantStatus: http.StatusForbidden},
		{name: "auth closed", err: ErrAuthenticationClosed, wantStatus: http.StatusForbidden},
		{name: "inactive user", err: ErrInvalidCredentials, wantStatus: http.StatusUnauthorized},
		{name: "missing token field", err: errIdentityTokenRequired(), wantStatus: http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeAppleSignInError(rec, tc.err)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}

			var payload map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if success, _ := payload["success"].(bool); success {
				t.Fatalf("expected success=false")
			}
		})
	}
}

func errIdentityTokenRequired() error {
	return errString("identityToken is required")
}

type errString string

func (e errString) Error() string { return string(e) }
