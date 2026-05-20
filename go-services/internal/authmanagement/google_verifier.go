package authmanagement

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/api/idtoken"
)

// GoogleClaims holds the verified fields we care about from a Google ID token.
type GoogleClaims struct {
	Sub           string // stable Google user identifier
	Email         string
	EmailVerified bool
	Name          string
	GivenName     string
	FamilyName    string
	Picture       string
}

// verifyGoogleIDToken validates a Google ID token against the given list of
// allowed Web client IDs (the 'aud' claim). It uses Google's public JWKS endpoint
// with built-in caching via the idtoken package.
func verifyGoogleIDToken(ctx context.Context, rawToken string, allowedClientIDs []string) (*GoogleClaims, error) {
	if len(allowedClientIDs) == 0 {
		return nil, fmt.Errorf("no Google Web client IDs configured for this project")
	}

	// idtoken.Validate checks signature, exp/iat, iss, and the single audience we provide.
	// Try each allowed client ID until one validates.
	var payload *idtoken.Payload
	var lastErr error
	for _, aud := range allowedClientIDs {
		p, err := idtoken.Validate(ctx, rawToken, aud)
		if err == nil {
			payload = p
			break
		}
		lastErr = err
	}
	if payload == nil {
		return nil, fmt.Errorf("invalid or expired Google token: %w", lastErr)
	}

	// Verify issuer (idtoken.Validate already does this, but be explicit).
	iss, _ := payload.Claims["iss"].(string)
	if iss != "accounts.google.com" && iss != "https://accounts.google.com" {
		return nil, fmt.Errorf("invalid Google token issuer: %s", iss)
	}

	email, _ := payload.Claims["email"].(string)
	if email == "" {
		return nil, fmt.Errorf("Google token missing email claim")
	}

	emailVerified, _ := payload.Claims["email_verified"].(bool)
	name, _ := payload.Claims["name"].(string)
	givenName, _ := payload.Claims["given_name"].(string)
	familyName, _ := payload.Claims["family_name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	return &GoogleClaims{
		Sub:           payload.Subject,
		Email:         strings.ToLower(strings.TrimSpace(email)),
		EmailVerified: emailVerified,
		Name:          name,
		GivenName:     givenName,
		FamilyName:    familyName,
		Picture:       picture,
	}, nil
}
