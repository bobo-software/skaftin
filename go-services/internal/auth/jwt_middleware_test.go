package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
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
