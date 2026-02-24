package supertokens

import (
	"context"
	"fmt"
	"strings"
)

type CreateSessionRequest struct {
	UserID                  string `json:"userId"`
	UserDataInAccessToken   any    `json:"userDataInAccessToken,omitempty"`
	AccessTokenPayload      any    `json:"accessTokenPayload,omitempty"`
	SessionDataInDatabase   any    `json:"sessionDataInDatabase,omitempty"`
	UserDataInJWTPayload    any    `json:"userDataInJWTPayload,omitempty"`
	EnableAntiCsrf          bool   `json:"enableAntiCsrf"`
	UseDynamicSigningKey    bool   `json:"useDynamicSigningKey"`
}

type CreateSessionResponse struct {
	Status       string       `json:"status"`
	Session      SessionInfo  `json:"session"`
	AccessToken  TokenInfo    `json:"accessToken"`
	RefreshToken TokenInfo    `json:"refreshToken"`
}

type SessionInfo struct {
	Handle                string `json:"handle"`
	UserID                string `json:"userId"`
	UserDataInAccessToken any    `json:"userDataInAccessToken"`
}

type TokenInfo struct {
	Token     string `json:"token"`
	Expiry    int64  `json:"expiry"`
	CreatedAt int64  `json:"createdTime"`
}

// CreateSession creates a new session for the given user.
func (c *Client) CreateSession(ctx context.Context, tenantID string, req CreateSessionRequest) (*CreateSessionResponse, error) {
	path := fmt.Sprintf("/%s/recipe/session", tenantID)
	// Prefer modern payload key used by recent SuperTokens core/CDI.
	payload := req.AccessTokenPayload
	if payload == nil {
		payload = req.UserDataInAccessToken
	}

	requestBody := map[string]any{
		"userId": req.UserID,
	}
	if payload != nil {
		requestBody["accessTokenPayload"] = payload
	}
	if req.SessionDataInDatabase != nil {
		requestBody["sessionDataInDatabase"] = req.SessionDataInDatabase
	}
	if req.EnableAntiCsrf {
		requestBody["enableAntiCsrf"] = true
	}
	if req.UseDynamicSigningKey {
		requestBody["useDynamicSigningKey"] = true
	}

	var resp CreateSessionResponse
	err := c.do(ctx, "POST", path, "session", requestBody, &resp)
	if err != nil && strings.Contains(err.Error(), "Field name 'accessTokenPayload' is invalid") {
		// Backward compatibility for older cores.
		legacyBody := map[string]any{
			"userId": req.UserID,
		}
		if payload != nil {
			legacyBody["userDataInAccessToken"] = payload
		}
		if req.SessionDataInDatabase != nil {
			legacyBody["userDataInDatabase"] = req.SessionDataInDatabase
		}
		if req.EnableAntiCsrf {
			legacyBody["enableAntiCsrf"] = true
		}
		if req.UseDynamicSigningKey {
			legacyBody["useDynamicSigningKey"] = true
		}
		err = c.do(ctx, "POST", path, "session", legacyBody, &resp)
	}
	return &resp, err
}

type RevokeSessionsResponse struct {
	Status              string   `json:"status"`
	SessionHandlesRevoked []string `json:"sessionHandlesRevoked"`
}

// RevokeAllSessionsForUser revokes all sessions for a user.
func (c *Client) RevokeAllSessionsForUser(ctx context.Context, userID string) (*RevokeSessionsResponse, error) {
	var resp RevokeSessionsResponse
	err := c.do(ctx, "POST", "/recipe/session/remove", "session", map[string]any{
		"userId": userID,
	}, &resp)
	return &resp, err
}

// GetSession verifies a session token and returns session info.
func (c *Client) GetSession(ctx context.Context, accessToken string) (*CreateSessionResponse, error) {
	var resp CreateSessionResponse
	err := c.do(ctx, "POST", "/recipe/session/verify", "session", map[string]any{
		"accessToken":    accessToken,
		"enableAntiCsrf": false,
		"doAntiCsrfCheck": false,
		"checkDatabase":  false,
	}, &resp)
	return &resp, err
}

// RevokeSession revokes a specific session by handle.
func (c *Client) RevokeSession(ctx context.Context, sessionHandle string) error {
	var resp RevokeSessionsResponse
	return c.do(ctx, "POST", "/recipe/session/remove", "session", map[string]any{
		"sessionHandles": []string{sessionHandle},
	}, &resp)
}
