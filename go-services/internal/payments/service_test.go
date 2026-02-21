package payments

import "testing"

func TestSignPayFastHeadersDeterministic(t *testing.T) {
	headers := map[string]string{
		"merchant-id": "10000100",
		"version":     "v1",
		"timestamp":   "2026-02-21T12:00:00",
	}
	sig1 := signPayFastHeaders(headers, "secret-passphrase")
	sig2 := signPayFastHeaders(headers, "secret-passphrase")

	if sig1 == "" {
		t.Fatalf("signature should not be empty")
	}
	if sig1 != sig2 {
		t.Fatalf("signature should be deterministic, got %q != %q", sig1, sig2)
	}
}
