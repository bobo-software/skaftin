package authmanagement

import "testing"

func TestResolveForgotPasswordCode(t *testing.T) {
	tests := []struct {
		name        string
		body        map[string]any
		otpLen      int
		wantCode    string
		expectError bool
	}{
		{
			name:     "accepts explicit valid code",
			body:     map[string]any{"code": "15463"},
			otpLen:   5,
			wantCode: "15463",
		},
		{
			name:        "rejects wrong length",
			body:        map[string]any{"code": "1234"},
			otpLen:      5,
			expectError: true,
		},
		{
			name:        "rejects non-digit code",
			body:        map[string]any{"code": "12a45"},
			otpLen:      5,
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveForgotPasswordCode(tc.body, tc.otpLen)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantCode != "" && got != tc.wantCode {
				t.Fatalf("code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}

func TestResolveForgotPasswordDelivery(t *testing.T) {
	email := "sibiya.bobo@gmail.com"
	phone := "0712442080"
	user := &AppUser{Email: &email, Phone: &phone}

	tests := []struct {
		name        string
		body        map[string]any
		reqEmail    string
		reqPhone    string
		wantMethod  string
		wantDest    string
		expectError bool
	}{
		{
			name:       "uses sms when requested",
			body:       map[string]any{"method": "sms"},
			reqPhone:   "0712442080",
			wantMethod: "sms",
			wantDest:   "0712442080",
		},
		{
			name:       "uses email when requested",
			body:       map[string]any{"method": "email"},
			reqEmail:   "sibiya.bobo@gmail.com",
			wantMethod: "email",
			wantDest:   "sibiya.bobo@gmail.com",
		},
		{
			name:       "defaults to email when email identifier used",
			body:       map[string]any{},
			reqEmail:   "sibiya.bobo@gmail.com",
			wantMethod: "email",
			wantDest:   "sibiya.bobo@gmail.com",
		},
		{
			name:       "defaults to sms when only phone identifier used",
			body:       map[string]any{},
			reqPhone:   "0712442080",
			wantMethod: "sms",
			wantDest:   "0712442080",
		},
		{
			name:        "rejects invalid method",
			body:        map[string]any{"method": "push"},
			reqPhone:    "0712442080",
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			method, dest, err := resolveForgotPasswordDelivery(tc.body, user, tc.reqEmail, tc.reqPhone)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if method != tc.wantMethod {
				t.Fatalf("method = %q, want %q", method, tc.wantMethod)
			}
			if dest != tc.wantDest {
				t.Fatalf("destination = %q, want %q", dest, tc.wantDest)
			}
		})
	}
}
