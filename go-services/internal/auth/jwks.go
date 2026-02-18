package auth

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

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
	return &JWKSProvider{
		jwksURL:    strings.TrimRight(supertokensCoreURL, "/") + "/.well-known/jwks.json",
		keys:       make(map[string]interface{}),
		refreshTTL: 5 * time.Minute,
	}
}

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

func (p *JWKSProvider) fetchKeys() error {
	p.mu.Lock()
	defer p.mu.Unlock()

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
