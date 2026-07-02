package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestAppAPIRequestLogsRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var requestLogsHit, prefixHit bool

	mux.Handle("/app-api/request-logs/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestLogsHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/request-logs/42", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !requestLogsHit {
		t.Fatalf("expected /app-api/request-logs/ route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle request logs request")
	}
}

func TestAppAPICommunicationsRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var communicationsHit, prefixHit bool

	mux.Handle("/app-api/communications/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		communicationsHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/communications/sms/send", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !communicationsHit {
		t.Fatalf("expected /app-api/communications/ route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle communications request")
	}
}

func TestAppAPIPaymentsRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var paymentsHit, prefixHit bool

	mux.Handle("/app-api/payments/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paymentsHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/payments/initiate", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !paymentsHit {
		t.Fatalf("expected /app-api/payments/ route to handle request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle payments request")
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

func TestAppAPIAuthRouteWinsOverAppAPIPrefix(t *testing.T) {
	mux := http.NewServeMux()

	var authHit, prefixHit bool

	mux.Handle("/app-api/auth/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHit = true
		w.WriteHeader(http.StatusOK)
	}))
	mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefixHit = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/users", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if !authHit {
		t.Fatalf("expected /app-api/auth/ route to handle auth request")
	}
	if prefixHit {
		t.Fatalf("expected /app-api/ prefix route to not handle app-api auth request")
	}
}

func TestKnownAppAPIEndpointsPreferExplicitGoRoutes(t *testing.T) {
	testCases := []struct {
		name           string
		method         string
		path           string
		explicitPrefix string
	}{
		{
			name:           "auth login",
			method:         http.MethodPost,
			path:           "/app-api/auth/auth/login",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth register",
			method:         http.MethodPost,
			path:           "/app-api/auth/auth/register",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth verify otp",
			method:         http.MethodPost,
			path:           "/app-api/auth/auth/verify-otp",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "storage upload form",
			method:         http.MethodPost,
			path:           "/app-api/storage/files",
			explicitPrefix: "/app-api/storage/",
		},
		{
			name:           "storage download query",
			method:         http.MethodGet,
			path:           "/app-api/storage/files/download",
			explicitPrefix: "/app-api/storage/",
		},
		{
			name:           "storage bulk delete",
			method:         http.MethodDelete,
			path:           "/app-api/storage/files/bulk",
			explicitPrefix: "/app-api/storage/",
		},
		{
			name:           "storage bulk upload",
			method:         http.MethodPost,
			path:           "/app-api/storage/uploads/upload-bulk",
			explicitPrefix: "/app-api/storage/",
		},
		{
			name:           "database tables",
			method:         http.MethodGet,
			path:           "/app-api/database/tables",
			explicitPrefix: "/app-api/database/",
		},
		{
			name:           "database bulk delete",
			method:         http.MethodPost,
			path:           "/app-api/database/tables/customers/bulk-delete",
			explicitPrefix: "/app-api/database/",
		},
		{
			name:           "database bulk update",
			method:         http.MethodPut,
			path:           "/app-api/database/tables/customers/bulk-update",
			explicitPrefix: "/app-api/database/",
		},
		{
			name:           "database bulk upsert",
			method:         http.MethodPost,
			path:           "/app-api/database/tables/customers/bulk-upsert",
			explicitPrefix: "/app-api/database/",
		},
		{
			name:           "request logs create",
			method:         http.MethodPost,
			path:           "/app-api/request-logs/42",
			explicitPrefix: "/app-api/request-logs/",
		},
		{
			name:           "communications send sms",
			method:         http.MethodPost,
			path:           "/app-api/communications/sms/send",
			explicitPrefix: "/app-api/communications/",
		},
		{
			name:           "communications send bulk email",
			method:         http.MethodPost,
			path:           "/app-api/communications/email/send-bulk",
			explicitPrefix: "/app-api/communications/",
		},
		{
			name:           "auth users bulk create",
			method:         http.MethodPost,
			path:           "/app-api/auth/users/bulk",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth users import",
			method:         http.MethodPost,
			path:           "/app-api/auth/users/import",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth users bulk roles",
			method:         http.MethodPost,
			path:           "/app-api/auth/users/bulk-roles",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth users bulk resend otp",
			method:         http.MethodPost,
			path:           "/app-api/auth/users/bulk-resend-otp",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "auth users bulk verify",
			method:         http.MethodPost,
			path:           "/app-api/auth/users/bulk-verify",
			explicitPrefix: "/app-api/auth/",
		},
		{
			name:           "payments initiate",
			method:         http.MethodPost,
			path:           "/app-api/payments/initiate",
			explicitPrefix: "/app-api/payments/",
		},
		{
			name:           "client mcp tools",
			method:         http.MethodGet,
			path:           "/app-api/mcp/tools",
			explicitPrefix: "/app-api/mcp/",
		},
		{
			name:           "app-api2 database select",
			method:         http.MethodPost,
			path:           "/app-api2/database/tables/companies/select",
			explicitPrefix: "/app-api2/database/",
		},
		{
			name:           "app-api2 storage download",
			method:         http.MethodGet,
			path:           "/app-api2/storage/files/download",
			explicitPrefix: "/app-api2/storage/",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			var explicitHit, prefixHit bool

			mux.Handle(tc.explicitPrefix, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				explicitHit = true
				w.WriteHeader(http.StatusOK)
			}))

			if strings.HasPrefix(tc.explicitPrefix, "/app-api2/") {
				mux.Handle("/app-api2/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					prefixHit = true
					w.WriteHeader(http.StatusOK)
				}))
			} else {
				mux.Handle("/app-api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					prefixHit = true
					w.WriteHeader(http.StatusOK)
				}))
			}

			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if !explicitHit {
				t.Fatalf("expected explicit route %s to handle %s %s", tc.explicitPrefix, tc.method, tc.path)
			}
			if prefixHit {
				t.Fatalf("expected catch-all prefix to not handle %s %s", tc.method, tc.path)
			}
		})
	}
}
