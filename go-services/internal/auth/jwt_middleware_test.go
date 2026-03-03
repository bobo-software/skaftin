package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestJWTAuth_ExtractsRoleAndProjectIDs(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	jwksServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/jwks.json" {
			t.Fatalf("unexpected JWKS path: %s", r.URL.Path)
		}
		key := map[string]any{
			"kty": "RSA",
			"kid": "test-kid",
			"alg": "RS256",
			"use": "sig",
			"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{key}})
	}))
	defer jwksServer.Close()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":        "user-123",
		"role":       "admin",
		"projectIds": []int{3, 7},
		"exp":        time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = "test-kid"
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	provider := NewJWKSProvider(jwksServer.URL)
	var gotUserID string
	var gotRole string
	var gotProjects []float64

	protected := JWTAuth(provider)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := GetUserContext(r)
		if ctx == nil {
			t.Fatalf("expected user context in request")
		}
		gotUserID = ctx.UserID
		gotRole = ctx.Role
		gotProjects = append(gotProjects, ctx.ProjectIDs...)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if gotUserID != "user-123" {
		t.Fatalf("user id = %q, want user-123", gotUserID)
	}
	if gotRole != "admin" {
		t.Fatalf("role = %q, want admin", gotRole)
	}
	if len(gotProjects) != 2 || gotProjects[0] != 3 || gotProjects[1] != 7 {
		t.Fatalf("project ids = %v, want [3 7]", gotProjects)
	}
}

func TestJWTAuth_ExtractsNestedUserDataClaims(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	jwksServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := map[string]any{
			"kty": "RSA",
			"kid": "test-kid-nested",
			"alg": "RS256",
			"use": "sig",
			"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{key}})
	}))
	defer jwksServer.Close()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "user-nested",
		"userData": map[string]any{
			"role":       "admin",
			"projectIds": []int{3, 9},
		},
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = "test-kid-nested"
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	provider := NewJWKSProvider(jwksServer.URL)
	var gotRole string
	var gotProjects []float64

	protected := JWTAuth(provider)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := GetUserContext(r)
		if ctx == nil {
			t.Fatalf("expected user context in request")
		}
		gotRole = ctx.Role
		gotProjects = append(gotProjects, ctx.ProjectIDs...)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if gotRole != "admin" {
		t.Fatalf("role = %q, want admin", gotRole)
	}
	if len(gotProjects) != 2 || gotProjects[0] != 3 || gotProjects[1] != 9 {
		t.Fatalf("project ids = %v, want [3 9]", gotProjects)
	}
}

func TestJWTAuth_FallsBackToSuperTokensCoreVerify(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/recipe/session/verify" {
			t.Fatalf("path = %s, want /recipe/session/verify", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "OK",
			"session": map[string]any{
				"handle": "session-handle",
				"userId": "user-42",
				"userDataInAccessToken": map[string]any{
					"role":       "admin",
					"projectIds": []int{2, 5},
				},
			},
		})
	}))
	defer stCore.Close()

	prevCoreURL := os.Getenv("SUPERTOKENS_CORE_URL")
	prevConnURI := os.Getenv("SUPERTOKENS_CONNECTION_URI")
	_ = os.Setenv("SUPERTOKENS_CORE_URL", stCore.URL)
	_ = os.Unsetenv("SUPERTOKENS_CONNECTION_URI")
	t.Cleanup(func() {
		_ = os.Setenv("SUPERTOKENS_CORE_URL", prevCoreURL)
		if prevConnURI == "" {
			_ = os.Unsetenv("SUPERTOKENS_CONNECTION_URI")
		} else {
			_ = os.Setenv("SUPERTOKENS_CONNECTION_URI", prevConnURI)
		}
	})

	jwksProvider := NewJWKSProvider("http://127.0.0.1:1")
	var gotUserID string
	var gotRole string
	protected := JWTAuth(jwksProvider)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := GetUserContext(r)
		if ctx == nil {
			t.Fatalf("expected user context in request")
		}
		gotUserID = ctx.UserID
		gotRole = ctx.Role
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	req.Header.Set("Authorization", "Bearer opaque-or-non-jwt-token")
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if gotUserID != "user-42" {
		t.Fatalf("user id = %q, want user-42", gotUserID)
	}
	if gotRole != "admin" {
		t.Fatalf("role = %q, want admin", gotRole)
	}
}

func TestJWTAuth_FallbackReadsUserDataInJWTClaims(t *testing.T) {
	stCore := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/recipe/session/verify" {
			t.Fatalf("path = %s, want /recipe/session/verify", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "OK",
			"session": map[string]any{
				"handle": "session-handle",
				"userId": "user-88",
				"userDataInJWT": map[string]any{
					"userData": map[string]any{
						"role":       "admin",
						"projectIds": []int{1, 2, 3},
					},
				},
			},
		})
	}))
	defer stCore.Close()

	prevCoreURL := os.Getenv("SUPERTOKENS_CORE_URL")
	prevConnURI := os.Getenv("SUPERTOKENS_CONNECTION_URI")
	_ = os.Setenv("SUPERTOKENS_CORE_URL", stCore.URL)
	_ = os.Unsetenv("SUPERTOKENS_CONNECTION_URI")
	t.Cleanup(func() {
		_ = os.Setenv("SUPERTOKENS_CORE_URL", prevCoreURL)
		if prevConnURI == "" {
			_ = os.Unsetenv("SUPERTOKENS_CONNECTION_URI")
		} else {
			_ = os.Setenv("SUPERTOKENS_CONNECTION_URI", prevConnURI)
		}
	})

	jwksProvider := NewJWKSProvider("http://127.0.0.1:1")
	var gotRole string
	var gotProjects []float64
	protected := JWTAuth(jwksProvider)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := GetUserContext(r)
		if ctx == nil {
			t.Fatalf("expected user context in request")
		}
		gotRole = ctx.Role
		gotProjects = append(gotProjects, ctx.ProjectIDs...)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/database/3/tables", nil)
	req.Header.Set("Authorization", "Bearer opaque-or-non-jwt-token")
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if gotRole != "admin" {
		t.Fatalf("role = %q, want admin", gotRole)
	}
	if len(gotProjects) != 3 || gotProjects[0] != 1 || gotProjects[1] != 2 || gotProjects[2] != 3 {
		t.Fatalf("project ids = %v, want [1 2 3]", gotProjects)
	}
}

func TestExtractJWT_PreservesPlusInCookieValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	req.AddCookie(&http.Cookie{Name: "sAccessToken", Value: "abc+def+ghi"})

	token := extractJWT(req)
	if token != "abc+def+ghi" {
		t.Fatalf("token = %q, want abc+def+ghi", token)
	}
}
