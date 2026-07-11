package authmanagement

import (
	"context"
	"testing"
)

func TestOptionalUserRole(t *testing.T) {
	tests := []struct {
		name string
		body map[string]any
		want string
	}{
		{name: "nil body", body: nil, want: ""},
		{name: "missing key", body: map[string]any{"credential": "a@b.c"}, want: ""},
		{name: "empty string", body: map[string]any{"user_role": ""}, want: ""},
		{name: "whitespace", body: map[string]any{"user_role": "  "}, want: ""},
		{name: "admin", body: map[string]any{"user_role": "admin"}, want: "admin"},
		{name: "trimmed", body: map[string]any{"user_role": "  user  "}, want: "user"},
		{name: "non-string ignored", body: map[string]any{"user_role": 1}, want: ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := optionalUserRole(tc.body); got != tc.want {
				t.Fatalf("optionalUserRole() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestOauthAutoRegisterRoleAllowed(t *testing.T) {
	svc := &Service{}

	t.Run("empty role always allowed", func(t *testing.T) {
		if !svc.oauthAutoRegisterRoleAllowed(context.Background(), "schema", nil, "") {
			t.Fatal("expected empty user_role to allow auto-register")
		}
	})

	t.Run("role required but no settings", func(t *testing.T) {
		if svc.oauthAutoRegisterRoleAllowed(context.Background(), "schema", nil, "admin") {
			t.Fatal("expected mismatch when settings are nil")
		}
	})

	t.Run("role required but no default role id", func(t *testing.T) {
		settings := &AuthSettings{}
		if svc.oauthAutoRegisterRoleAllowed(context.Background(), "schema", settings, "user") {
			t.Fatal("expected mismatch when DefaultRoleID is nil")
		}
	})
}

func TestDefaultRoleMatchesUserRole(t *testing.T) {
	tests := []struct {
		name             string
		defaultRoleKey   string
		requestedRoleKey string
		want             bool
	}{
		{name: "no filter", defaultRoleKey: "user", requestedRoleKey: "", want: true},
		{name: "match", defaultRoleKey: "user", requestedRoleKey: "user", want: true},
		{name: "mismatch", defaultRoleKey: "user", requestedRoleKey: "admin", want: false},
		{name: "empty default with filter", defaultRoleKey: "", requestedRoleKey: "admin", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := defaultRoleMatchesUserRole(tc.defaultRoleKey, tc.requestedRoleKey); got != tc.want {
				t.Fatalf("defaultRoleMatchesUserRole(%q, %q) = %v, want %v",
					tc.defaultRoleKey, tc.requestedRoleKey, got, tc.want)
			}
		})
	}
}
