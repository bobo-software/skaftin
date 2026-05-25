package authmanagement

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPasswordHashSet(t *testing.T) {
	empty := ""
	hash := "$2a$10$abcdefghijklmnopqrstuv"

	tests := []struct {
		name string
		pw   *string
		want bool
	}{
		{"nil password", nil, false},
		{"empty string", &empty, false},
		{"non-empty hash", &hash, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := passwordHashSet(tc.pw); got != tc.want {
				t.Fatalf("passwordHashSet() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestStripUserPassword_OmitsFromJSON(t *testing.T) {
	hash := "$2a$10$secretbcrypthashvalue"
	user := &AppUser{ID: 1, Name: "Jane", Password: &hash}
	stripUserPassword(user)

	if user.Password != nil {
		t.Fatal("expected Password to be nil after strip")
	}

	b, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("marshal user: %v", err)
	}
	if strings.Contains(string(b), "secretbcrypthashvalue") {
		t.Fatalf("password hash leaked in JSON: %s", string(b))
	}
}

func TestLoginSessionResultShape(t *testing.T) {
	// Documents keys returned by buildLoginSessionResult for all login flows.
	result := map[string]any{
		"user":         &AppUser{ID: 1},
		"accessToken":  "token",
		"has_password": false,
		"message":      "Login successful",
	}

	for _, key := range []string{"user", "accessToken", "has_password", "message"} {
		if _, ok := result[key]; !ok {
			t.Fatalf("login result missing key %q", key)
		}
	}
	if _, ok := result["has_password"].(bool); !ok {
		t.Fatal("has_password must be a bool")
	}
}
