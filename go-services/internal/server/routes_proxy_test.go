package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAppAPIFallbackProxyHandlerForwardsToNode(t *testing.T) {
	var proxied bool
	node := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxied = true
		w.WriteHeader(http.StatusTeapot)
	})

	handler := appAPIFallbackProxyHandler(node, "/app-api/")
	req := httptest.NewRequest(http.MethodGet, "/app-api/legacy-endpoint", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !proxied {
		t.Fatalf("expected request to be proxied to node fallback handler")
	}
	if rec.Code != http.StatusTeapot {
		t.Fatalf("expected proxied status %d, got %d", http.StatusTeapot, rec.Code)
	}
}

func TestAppAPINotFoundHandlerReturnsContractError(t *testing.T) {
	handler := appAPINotFoundHandler("/app-api/")
	req := httptest.NewRequest(http.MethodPost, "/app-api/unknown/route", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("expected JSON content type, got %q", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "\"success\":false") {
		t.Fatalf("expected standardized error envelope, got %s", body)
	}
	if !strings.Contains(body, "/app-api/unknown/route") {
		t.Fatalf("expected response body to include requested route, got %s", body)
	}
}

func TestAppAPI2NotFoundHandlerReturnsContractError(t *testing.T) {
	handler := appAPINotFoundHandler("/app-api-2/")
	req := httptest.NewRequest(http.MethodGet, "/app-api-2/unknown/route", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "\"success\":false") {
		t.Fatalf("expected standardized error envelope, got %s", body)
	}
	if !strings.Contains(body, "/app-api-2/unknown/route") {
		t.Fatalf("expected response body to include requested route, got %s", body)
	}
}

func TestAppAPI2NotFoundHandlerIncludesMethodAndPrefix(t *testing.T) {
	handler := appAPINotFoundHandler("/app-api-2/")
	req := httptest.NewRequest(http.MethodPost, "/app-api-2/legacy/path", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "POST /app-api-2/legacy/path") {
		t.Fatalf("expected response body to include method+path, got %s", body)
	}
	if !strings.Contains(body, "prefix /app-api-2/") {
		t.Fatalf("expected response body to include app-api-2 prefix, got %s", body)
	}
}
