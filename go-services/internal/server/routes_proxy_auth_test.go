package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/platformauth"
)

func TestRegisterProxyRoutes_AuthUsesGoHandlerWhenEnabled(t *testing.T) {
	mux := http.NewServeMux()
	cfg := &config.Config{
		AppAPIProxyFallbackEnabled: false,
	}

	nodeHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("node"))
	})
	goAuth := platformauth.NewHandler(nil, nil)

	registerProxyRoutes(mux, cfg, nil, nil, nil, nodeHandler, goAuth)

	req := httptest.NewRequest(http.MethodPost, "/auth/signout", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 from Go auth handler", rec.Code)
	}
}
