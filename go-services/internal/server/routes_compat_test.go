package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppAPILoginSpecificRouteWinsOverPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var specificHit, prefixHit bool

	mux.HandleFunc("POST /app-api/auth/auth/login", func(w http.ResponseWriter, r *http.Request) {
		specificHit = true
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !specificHit {
		t.Fatalf("expected specific app-api login route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected prefix /app-api/ route to not handle specific login request")
	}
}

func TestOtherAppAPIRoutesStillUsePrefixHandler(t *testing.T) {
	mux := http.NewServeMux()

	var specificHit, prefixHit bool

	mux.HandleFunc("POST /app-api/auth/auth/login", func(w http.ResponseWriter, r *http.Request) {
		specificHit = true
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/app-api/storage/files", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if specificHit {
		t.Fatalf("did not expect specific login route to handle non-login path")
	}
	if !prefixHit {
		t.Fatalf("expected /app-api/ prefix handler to handle non-login path")
	}
}

func TestAppAPIDatabaseRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var dbHit, prefixHit bool

	mux.Handle("/app-api/database/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		dbHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/app-api/database/tables", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !dbHit {
		t.Fatalf("expected /app-api/database/ route to handle database request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle database request")
	}
}

func TestAppAPINonDatabaseRoutesStillUsePrefixHandler(t *testing.T) {
	mux := http.NewServeMux()

	var dbHit, prefixHit bool

	mux.Handle("/app-api/database/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		dbHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/app-api/storage/files", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if dbHit {
		t.Fatalf("did not expect /app-api/database/ route to handle non-database request")
	}
	if !prefixHit {
		t.Fatalf("expected /app-api/ prefix route to handle non-database request")
	}
}

func TestAppAPIStorageRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var storageHit, prefixHit bool

	mux.Handle("/app-api/storage/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		storageHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/app-api/storage/buckets", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !storageHit {
		t.Fatalf("expected /app-api/storage/ route to handle storage request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle storage request")
	}
}
