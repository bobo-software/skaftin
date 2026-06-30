package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/model"
)

func TestValidateAppAPI2CredentialPair_Success(t *testing.T) {
	apiKey := &model.Credential{CredentialType: "api_key", ProjectID: 5}
	access := &model.Credential{CredentialType: "access_token", ProjectID: 5, Permissions: []string{"database:read"}}

	if err := validateAppAPI2CredentialPair(apiKey, access); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAppAPI2CredentialPair_WrongTypes(t *testing.T) {
	tests := []struct {
		name   string
		apiKey *model.Credential
		access *model.Credential
	}{
		{
			name:   "access token in api key header",
			apiKey: &model.Credential{CredentialType: "access_token", ProjectID: 1},
			access: &model.Credential{CredentialType: "access_token", ProjectID: 1},
		},
		{
			name:   "api key in bearer header",
			apiKey: &model.Credential{CredentialType: "api_key", ProjectID: 1},
			access: &model.Credential{CredentialType: "api_key", ProjectID: 1},
		},
		{
			name:   "mcp key as api key",
			apiKey: &model.Credential{CredentialType: "mcp_key", ProjectID: 1},
			access: &model.Credential{CredentialType: "access_token", ProjectID: 1},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateAppAPI2CredentialPair(tc.apiKey, tc.access); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestValidateAppAPI2CredentialPair_ProjectMismatch(t *testing.T) {
	apiKey := &model.Credential{CredentialType: "api_key", ProjectID: 1}
	access := &model.Credential{CredentialType: "access_token", ProjectID: 2}

	err := validateAppAPI2CredentialPair(apiKey, access)
	if err == nil {
		t.Fatal("expected project mismatch error")
	}
	if !errors.Is(err, err) && err.Error() == "" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestExtractAPIKeyHeaderAndBearer(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api2/database/tables/products/select", nil)
	req.Header.Set("X-API-Key", "sk_test")
	req.Header.Set("Authorization", "Bearer sat_test")

	if got := extractAPIKeyHeader(req); got != "sk_test" {
		t.Fatalf("api key = %q", got)
	}
	if got := extractBearerToken(req); got != "sat_test" {
		t.Fatalf("bearer = %q", got)
	}
}

func TestExtractAPIKeyHeader_DoesNotFallBackToBearer(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api2/storage/files/download", nil)
	req.Header.Set("Authorization", "Bearer sat_only")

	if got := extractAPIKeyHeader(req); got != "" {
		t.Fatalf("expected empty api key header, got %q", got)
	}
}

func TestRequirePermission_UsesAccessTokenPermissions(t *testing.T) {
	handler := RequirePermission("database:read")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api2/database/tables/products/select", nil)
	req = req.WithContext(context.WithValue(req.Context(), AuthContextKey, &model.AuthContext{
		ProjectID:  9,
		Credential: &model.Credential{Permissions: []string{"storage:read"}},
	}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}

	req2 := httptest.NewRequest(http.MethodPost, "/app-api2/database/tables/products/select", nil)
	req2 = req2.WithContext(context.WithValue(req2.Context(), AuthContextKey, &model.AuthContext{
		ProjectID:  9,
		Credential: &model.Credential{Permissions: []string{"database:read"}},
	}))
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec2.Code)
	}
}
