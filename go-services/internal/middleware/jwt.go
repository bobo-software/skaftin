package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/skaftin/go-services/internal/models"
)

const UserContextKey contextKey = "userContext"

// GetUserContext extracts the UserContext from the request context.
func GetUserContext(r *http.Request) *models.UserContext {
	if val, ok := r.Context().Value(UserContextKey).(*models.UserContext); ok {
		return val
	}
	return nil
}

// JWKSProvider fetches and caches JWKS keys from the SuperTokens Core.
type JWKSProvider struct {
	jwksURL    string
	keys       map[string]interface{}
	mu         sync.RWMutex
	lastFetch  time.Time
	refreshTTL time.Duration
}

// NewJWKSProvider creates a provider that fetches public keys from the
// SuperTokens Core JWKS endpoint.
func NewJWKSProvider(supertokensCoreURL string) *JWKSProvider {
	p := &JWKSProvider{
		jwksURL:    strings.TrimRight(supertokensCoreURL, "/") + "/.well-known/jwks.json",
		keys:       make(map[string]interface{}),
		refreshTTL: 5 * time.Minute,
	}
	return p
}

// jwksResponse mirrors the standard JWKS JSON structure.
type jwksResponse struct {
	Keys []json.RawMessage `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
	Alg string `json:"alg"`
	Use string `json:"use"`
}

// fetchKeys retrieves the JWKS from the SuperTokens Core endpoint.
func (p *JWKSProvider) fetchKeys() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Don't re-fetch if within TTL
	if time.Since(p.lastFetch) < p.refreshTTL && len(p.keys) > 0 {
		return nil
	}

	slog.Info("fetching JWKS keys", "url", p.jwksURL)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(p.jwksURL)
	if err != nil {
		return fmt.Errorf("fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("decode JWKS: %w", err)
	}

	newKeys := make(map[string]interface{})
	for _, rawKey := range jwks.Keys {
		var key jwkKey
		if err := json.Unmarshal(rawKey, &key); err != nil {
			slog.Warn("failed to parse JWK key", "error", err)
			continue
		}

		if key.Kty == "RSA" {
			pubKey, err := parseRSAPublicKey(key.N, key.E)
			if err != nil {
				slog.Warn("failed to parse RSA key", "kid", key.Kid, "error", err)
				continue
			}
			newKeys[key.Kid] = pubKey
			slog.Info("loaded JWKS key", "kid", key.Kid, "alg", key.Alg)
		}
	}

	if len(newKeys) == 0 {
		return fmt.Errorf("no valid keys found in JWKS response")
	}

	p.keys = newKeys
	p.lastFetch = time.Now()
	slog.Info("JWKS keys refreshed", "count", len(newKeys))
	return nil
}

// GetKey returns the key function used by jwt.Parse to find the signing key.
func (p *JWKSProvider) GetKey(token *jwt.Token) (interface{}, error) {
	// Ensure keys are fetched
	if err := p.fetchKeys(); err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}

	kid, ok := token.Header["kid"].(string)
	if !ok {
		return nil, fmt.Errorf("token missing kid header")
	}

	p.mu.RLock()
	key, exists := p.keys[kid]
	p.mu.RUnlock()

	if !exists {
		// Force refresh and try again -- the key may have rotated
		p.mu.Lock()
		p.lastFetch = time.Time{}
		p.mu.Unlock()

		if err := p.fetchKeys(); err != nil {
			return nil, fmt.Errorf("failed to refresh JWKS: %w", err)
		}

		p.mu.RLock()
		key, exists = p.keys[kid]
		p.mu.RUnlock()

		if !exists {
			return nil, fmt.Errorf("key %s not found in JWKS", kid)
		}
	}

	return key, nil
}

// JWTAuth returns middleware that validates SuperTokens JWT access tokens.
// It checks the sAccessToken cookie and Authorization: Bearer header.
func JWTAuth(jwks *JWKSProvider) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractJWT(r)
			if tokenStr == "" {
				slog.Warn("no JWT token found",
					"path", r.URL.Path,
					"method", r.Method,
				)
				writeError(w, "Authentication required. Provide a valid session cookie or Authorization Bearer token.", http.StatusUnauthorized)
				return
			}

			// Parse and validate the JWT
			token, err := jwt.Parse(tokenStr, jwks.GetKey, jwt.WithValidMethods([]string{"RS256"}))
			if err != nil {
				slog.Warn("JWT validation failed",
					"error", err,
					"path", r.URL.Path,
				)
				writeError(w, "Invalid or expired session token", http.StatusUnauthorized)
				return
			}

			if !token.Valid {
				writeError(w, "Invalid session token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				writeError(w, "Invalid token claims", http.StatusUnauthorized)
				return
			}

			// Extract user info from SuperTokens JWT payload
			userCtx := &models.UserContext{
				UserID: getStringClaim(claims, "sub"),
				Role:   getStringClaim(claims, "role"),
			}

			// Extract projectIds (stored as array of numbers in the JWT)
			if ids, ok := claims["projectIds"]; ok {
				if idSlice, ok := ids.([]interface{}); ok {
					for _, id := range idSlice {
						if num, ok := id.(float64); ok {
							userCtx.ProjectIDs = append(userCtx.ProjectIDs, num)
						}
					}
				}
			}

			slog.Info("JWT authenticated request",
				"userId", userCtx.UserID,
				"role", userCtx.Role,
				"path", r.URL.Path,
			)

			ctx := context.WithValue(r.Context(), UserContextKey, userCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractJWT gets the JWT from the sAccessToken cookie or Authorization header.
func extractJWT(r *http.Request) string {
	// Check sAccessToken cookie first (platform UI users)
	if cookie, err := r.Cookie("sAccessToken"); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	// Fall back to Authorization: Bearer header
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

func getStringClaim(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
