package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/skaftin/go-services/internal/platformauth"
)

func TestRegisterProxyRoutes_AuthUsesGoHandlerWhenEnabled(t *testing.T) {
	mux := http.NewServeMux()
	goAuth := platformauth.NewHandler(nil, nil)

	registerProxyRoutes(mux, nil, nil, goAuth)

	req := httptest.NewRequest(http.MethodPost, "/auth/signout", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 from Go auth handler", rec.Code)
	}
}

func TestRegisterProxyRoutes_UnknownAPIRouteReturnsNotFound(t *testing.T) {
	mux := http.NewServeMux()
	goAuth := platformauth.NewHandler(nil, nil)

	registerProxyRoutes(mux, nil, nil, goAuth)

	req := httptest.NewRequest(http.MethodGet, "/api/not-migrated", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestAppAPINotFoundHandler_ReturnsGo404(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/app-api/not-migrated", nil)
	rec := httptest.NewRecorder()
	appAPINotFoundHandler("/app-api/").ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "/app-api/not-migrated") {
		t.Fatalf("expected response to include request path, got: %s", rec.Body.String())
	}
}
