package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractTokenForWebSocket_FromAPIKeyQuery(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws?api_key=test-key", nil)

	token := extractTokenForWebSocket(req)
	if token != "test-key" {
		t.Fatalf("token = %q, want test-key", token)
	}
}

func TestExtractTokenForWebSocket_HeaderPrecedence(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws?api_key=query-key", nil)
	req.Header.Set("X-API-Key", "header-key")

	token := extractTokenForWebSocket(req)
	if token != "header-key" {
		t.Fatalf("token = %q, want header-key", token)
	}
}

func TestExtractTokenForWebSocket_FromBearerQuery(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws?token=bearer-like", nil)

	token := extractTokenForWebSocket(req)
	if token != "bearer-like" {
		t.Fatalf("token = %q, want bearer-like", token)
	}
}
