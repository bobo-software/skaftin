package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAPIUnknownRouteReturnsContractError(t *testing.T) {
	handler := appAPINotFoundHandler("/api/")
	req := httptest.NewRequest(http.MethodGet, "/api/legacy-endpoint", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "/api/legacy-endpoint") {
		t.Fatalf("expected response body to include requested route, got %s", body)
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
	handler := appAPINotFoundHandler("/app-api2/")
	req := httptest.NewRequest(http.MethodGet, "/app-api2/unknown/route", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "\"success\":false") {
		t.Fatalf("expected standardized error envelope, got %s", body)
	}
	if !strings.Contains(body, "/app-api2/unknown/route") {
		t.Fatalf("expected response body to include requested route, got %s", body)
	}
}

func TestAppAPI2DatabaseRouteWinsOverAppAPI2Prefix(t *testing.T) {
	mux := http.NewServeMux()

	var databaseHit, prefixHit bool

	mux.Handle("/app-api2/database/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		databaseHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api2/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api2/database/tables/companies/select", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !databaseHit {
		t.Fatalf("expected /app-api2/database/ route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api2/ prefix route to not handle database request")
	}
}
