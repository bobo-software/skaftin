package pushnotifications

import "testing"

func TestNormalizePlatform(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"ios", "ios", false},
		{"Android", "android", false},
		{" IOS ", "ios", false},
		{"web", "", true},
		{"", "", true},
	}
	for _, tc := range cases {
		got, err := normalizePlatform(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Fatalf("normalizePlatform(%q) expected error", tc.in)
			}
			continue
		}
		if err != nil {
			t.Fatalf("normalizePlatform(%q): %v", tc.in, err)
		}
		if got != tc.want {
			t.Fatalf("normalizePlatform(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestIsValidExpoToken(t *testing.T) {
	t.Parallel()
	if !isValidExpoToken("ExponentPushToken[abc123]") {
		t.Fatal("expected ExponentPushToken to be valid")
	}
	if !isValidExpoToken("ExpoPushToken[abc123]") {
		t.Fatal("expected ExpoPushToken to be valid")
	}
	if isValidExpoToken("not-a-token") {
		t.Fatal("expected invalid token")
	}
}

func TestSchemaAdvisoryLockKeyStable(t *testing.T) {
	t.Parallel()
	a := schemaAdvisoryLockKey("project_demo_1")
	b := schemaAdvisoryLockKey("project_demo_1")
	c := schemaAdvisoryLockKey("project_demo_2")
	if a != b {
		t.Fatalf("lock key not stable: %d vs %d", a, b)
	}
	if a == c {
		t.Fatalf("expected different keys for different schemas")
	}
	if a < 0 {
		t.Fatalf("expected non-negative lock key, got %d", a)
	}
}

func TestTruncateToken(t *testing.T) {
	t.Parallel()
	short := "short"
	if truncateToken(short) != short {
		t.Fatalf("short token changed: %q", truncateToken(short))
	}
	long := "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
	out := truncateToken(long)
	if out == long {
		t.Fatal("expected truncated long token")
	}
	if !containsEllipsis(out) {
		t.Fatalf("expected ellipsis in %q", out)
	}
}

func containsEllipsis(s string) bool {
	for _, r := range s {
		if r == '…' {
			return true
		}
	}
	return false
}

func TestTicketDeviceNotRegistered(t *testing.T) {
	t.Parallel()
	ok := ExpoTicket{Status: "ok"}
	if ticketDeviceNotRegistered(ok) {
		t.Fatal("ok ticket should not prune")
	}
	bad := ExpoTicket{
		Status: "error",
		Details: &struct {
			Error string `json:"error,omitempty"`
		}{Error: "DeviceNotRegistered"},
	}
	if !ticketDeviceNotRegistered(bad) {
		t.Fatal("expected DeviceNotRegistered")
	}
}
