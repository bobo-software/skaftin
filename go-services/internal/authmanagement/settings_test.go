package authmanagement

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractUserIDOrEmail(t *testing.T) {
	tests := []struct {
		name string
		body map[string]any
		want string
	}{
		{
			name: "prefers user_id_or_email",
			body: map[string]any{"user_id_or_email": "person@example.com", "user_id": float64(25), "email": "other@example.com"},
			want: "person@example.com",
		},
		{
			name: "uses numeric user_id",
			body: map[string]any{"user_id": float64(25)},
			want: "25",
		},
		{
			name: "uses string user_id",
			body: map[string]any{"user_id": "42"},
			want: "42",
		},
		{
			name: "falls back to email",
			body: map[string]any{"email": "user@example.com"},
			want: "user@example.com",
		},
		{
			name: "returns empty when absent",
			body: map[string]any{},
			want: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := extractUserIDOrEmail(tc.body)
			if got != tc.want {
				t.Fatalf("extractUserIDOrEmail() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestWriteSettingsTriggerError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "recipient required", err: ErrSettingsRecipientRequired, wantStatus: http.StatusBadRequest},
		{name: "provider missing", err: ErrSettingsProviderNotConfigured, wantStatus: http.StatusBadRequest},
		{name: "verification disabled", err: ErrSettingsVerificationEmailDisabled, wantStatus: http.StatusForbidden},
		{name: "password reset disabled", err: ErrSettingsPasswordResetEmailDisabled, wantStatus: http.StatusForbidden},
		{name: "user not found", err: ErrSettingsUserNotFound, wantStatus: http.StatusNotFound},
		{name: "generic error", err: ErrSettingsDeliveryFailed, wantStatus: http.StatusInternalServerError},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeSettingsTriggerError(rec, tc.err)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}

			var payload map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if success, _ := payload["success"].(bool); success {
				t.Fatalf("expected success=false, got true")
			}
		})
	}
}
