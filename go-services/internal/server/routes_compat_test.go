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

func TestAppAPILogoutSpecificRouteWinsOverPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var specificHit, prefixHit bool

	mux.HandleFunc("POST /app-api/auth/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		specificHit = true
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/logout", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !specificHit {
		t.Fatalf("expected specific app-api logout route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected prefix /app-api/ route to not handle specific logout request")
	}
}

func TestAppAPIRefreshSpecificRouteWinsOverPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var specificHit, prefixHit bool

	mux.HandleFunc("POST /app-api/auth/session/refresh", func(w http.ResponseWriter, r *http.Request) {
		specificHit = true
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/session/refresh", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !specificHit {
		t.Fatalf("expected specific app-api refresh route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected prefix /app-api/ route to not handle specific refresh request")
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

func TestAppAPIMCPRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var mcpHit, prefixHit bool

	mux.Handle("/app-api/mcp/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mcpHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/mcp/protocol", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !mcpHit {
		t.Fatalf("expected /app-api/mcp/ route to handle MCP request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle MCP request")
	}
}

func TestAPIMCPRouteWinsOverAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var mcpHit, prefixHit bool

	mux.Handle("/api/mcp/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mcpHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/mcp/tools", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !mcpHit {
		t.Fatalf("expected /api/mcp/ route to handle MCP request")
	}
	if prefixHit {
		t.Fatalf("expected /api/ prefix route to not handle MCP request")
	}
}

func TestAPIAuthImportRouteWinsOverAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var authImportHit, prefixHit bool

	mux.HandleFunc("POST /api/auth/{projectId}/users/import", func(w http.ResponseWriter, r *http.Request) {
		authImportHit = true
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/auth/3/users/import", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !authImportHit {
		t.Fatalf("expected /api/auth/{projectId}/users/import route to handle import request")
	}
	if prefixHit {
		t.Fatalf("expected /api/ prefix route to not handle auth import request")
	}
}
