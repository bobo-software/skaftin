package authmanagement

import "testing"

func TestResolveRegistrationOTPRoute(t *testing.T) {
	settingsWithSMS := &AuthSettings{SendRegistrationSMS: true}
	settingsWithEmail := &AuthSettings{SendRegistrationEmail: true}

	tests := []struct {
		name        string
		settings    *AuthSettings
		otpMethod   string
		email       string
		phone       string
		wantMethod  string
		wantDest    string
		wantSend    bool
		expectError bool
	}{
		{
			name:       "explicit sms method is honored",
			settings:   nil,
			otpMethod:  "sms",
			phone:      "0712442080",
			wantMethod: "sms",
			wantDest:   "0712442080",
			wantSend:   true,
		},
		{
			name:        "explicit sms requires phone",
			settings:    nil,
			otpMethod:   "sms",
			expectError: true,
		},
		{
			name:       "explicit email method is honored",
			settings:   nil,
			otpMethod:  "email",
			email:      "user@example.com",
			wantMethod: "email",
			wantDest:   "user@example.com",
			wantSend:   true,
		},
		{
			name:        "invalid otp method errors",
			settings:    nil,
			otpMethod:   "push",
			expectError: true,
		},
		{
			name:       "falls back to settings sms toggle",
			settings:   settingsWithSMS,
			email:      "user@example.com",
			phone:      "0712442080",
			wantMethod: "sms",
			wantDest:   "0712442080",
			wantSend:   true,
		},
		{
			name:       "falls back to settings email toggle",
			settings:   settingsWithEmail,
			email:      "user@example.com",
			phone:      "0712442080",
			wantMethod: "email",
			wantDest:   "user@example.com",
			wantSend:   true,
		},
		{
			name:     "no otp requested or configured",
			settings: nil,
			email:    "user@example.com",
			wantSend: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotMethod, gotDest, gotSend, err := resolveRegistrationOTPRoute(tc.settings, tc.otpMethod, tc.email, tc.phone)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if gotMethod != tc.wantMethod {
				t.Fatalf("method = %q, want %q", gotMethod, tc.wantMethod)
			}
			if gotDest != tc.wantDest {
				t.Fatalf("destination = %q, want %q", gotDest, tc.wantDest)
			}
			if gotSend != tc.wantSend {
				t.Fatalf("send = %t, want %t", gotSend, tc.wantSend)
			}
		})
	}
}
