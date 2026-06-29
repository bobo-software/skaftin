package authmanagement

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const appleJWKSURL = "https://appleid.apple.com/auth/keys"

// AppleClaims holds verified fields from an Apple identity token.
type AppleClaims struct {
	Sub            string
	Email          string
	EmailVerified  bool
	IsPrivateEmail bool
}

type appleJWKSProvider struct {
	keys       map[string]interface{}
	mu         sync.RWMutex
	lastFetch  time.Time
	refreshTTL time.Duration
}

var defaultAppleJWKS = &appleJWKSProvider{
	keys:       make(map[string]interface{}),
	refreshTTL: 24 * time.Hour,
}

type appleJWKSResponse struct {
	Keys []json.RawMessage `json:"keys"`
}

type appleJWKKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
	Alg string `json:"alg"`
	Use string `json:"use"`
}

func (p *appleJWKSProvider) fetchKeys(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if time.Since(p.lastFetch) < p.refreshTTL && len(p.keys) > 0 {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, appleJWKSURL, nil)
	if err != nil {
		return fmt.Errorf("create JWKS request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Apple JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks appleJWKSResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("decode Apple JWKS: %w", err)
	}

	newKeys := make(map[string]interface{})
	for _, rawKey := range jwks.Keys {
		var key appleJWKKey
		if err := json.Unmarshal(rawKey, &key); err != nil {
			continue
		}
		if key.Kty != "RSA" {
			continue
		}
		pubKey, err := parseAppleRSAPublicKey(key.N, key.E)
		if err != nil {
			continue
		}
		newKeys[key.Kid] = pubKey
	}

	if len(newKeys) == 0 {
		return fmt.Errorf("no valid keys found in Apple JWKS response")
	}

	p.keys = newKeys
	p.lastFetch = time.Now()
	return nil
}

func (p *appleJWKSProvider) getKey(ctx context.Context, token *jwt.Token) (interface{}, error) {
	if err := p.fetchKeys(ctx); err != nil {
		return nil, err
	}

	kid, ok := token.Header["kid"].(string)
	if !ok {
		return nil, fmt.Errorf("token missing kid header")
	}

	p.mu.RLock()
	key, exists := p.keys[kid]
	p.mu.RUnlock()

	if !exists {
		p.mu.Lock()
		p.lastFetch = time.Time{}
		p.mu.Unlock()

		if err := p.fetchKeys(ctx); err != nil {
			return nil, fmt.Errorf("failed to refresh Apple JWKS: %w", err)
		}

		p.mu.RLock()
		key, exists = p.keys[kid]
		p.mu.RUnlock()
		if !exists {
			return nil, fmt.Errorf("key %s not found in Apple JWKS", kid)
		}
	}

	return key, nil
}

func parseAppleRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, fmt.Errorf("decode n: %w", err)
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, fmt.Errorf("decode e: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}

// parseAppleBoolClaim normalizes Apple JWT boolean claims that may be bool or string.
func parseAppleBoolClaim(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return strings.EqualFold(strings.TrimSpace(t), "true")
	default:
		return false
	}
}

// verifyAppleIdentityToken validates an Apple identity token against the given
// list of allowed client IDs (bundle IDs — the JWT 'aud' claim).
func verifyAppleIdentityToken(ctx context.Context, rawToken string, allowedClientIDs []string) (*AppleClaims, error) {
	if len(allowedClientIDs) == 0 {
		return nil, fmt.Errorf("no Apple client IDs configured for this project")
	}

	allowedAud := make(map[string]struct{}, len(allowedClientIDs))
	for _, aud := range allowedClientIDs {
		aud = strings.TrimSpace(aud)
		if aud != "" {
			allowedAud[aud] = struct{}{}
		}
	}
	if len(allowedAud) == 0 {
		return nil, fmt.Errorf("no Apple client IDs configured for this project")
	}

	var claims jwt.MapClaims
	token, err := jwt.ParseWithClaims(rawToken, &claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return defaultAppleJWKS.getKey(ctx, token)
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid or expired Apple token: %w", err)
	}

	iss, _ := claims["iss"].(string)
	if iss != "https://appleid.apple.com" {
		return nil, fmt.Errorf("invalid Apple token issuer: %s", iss)
	}

	audOK := false
	switch aud := claims["aud"].(type) {
	case string:
		_, audOK = allowedAud[aud]
	case []any:
		for _, item := range aud {
			if s, ok := item.(string); ok {
				if _, ok := allowedAud[s]; ok {
					audOK = true
					break
				}
			}
		}
	}
	if !audOK {
		return nil, fmt.Errorf("Apple token audience not allowed")
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("Apple token missing sub claim")
	}

	email, _ := claims["email"].(string)
	email = strings.ToLower(strings.TrimSpace(email))

	return &AppleClaims{
		Sub:            sub,
		Email:          email,
		EmailVerified:  parseAppleBoolClaim(claims["email_verified"]),
		IsPrivateEmail: parseAppleBoolClaim(claims["is_private_email"]),
	}, nil
}
