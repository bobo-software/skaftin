package supertokens

import (
	"context"
	"fmt"
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
// This uses the legacy-compatible session payload contract expected by
// SuperTokens cores that validate CDI 2.14 request shapes.
func (c *Client) CreateSession(ctx context.Context, tenantID string, req CreateSessionRequest) (*CreateSessionResponse, error) {
	path := fmt.Sprintf("/%s/recipe/session", tenantID)

	payload := req.AccessTokenPayload
	if payload == nil {
		payload = req.UserDataInAccessToken
	}

	requestBody := map[string]any{
		"userId":               req.UserID,
		"enableAntiCsrf":       req.EnableAntiCsrf,
		"useDynamicSigningKey": req.UseDynamicSigningKey,
	}
	if payload != nil {
		requestBody["userDataInJWT"] = payload
	}
	// This core expects userDataInDatabase to be present for session creation,
	// even when there is no DB session data to store.
	if req.SessionDataInDatabase != nil {
		requestBody["userDataInDatabase"] = req.SessionDataInDatabase
	} else {
		requestBody["userDataInDatabase"] = map[string]any{}
	}

	var resp CreateSessionResponse
	err := c.do(ctx, "POST", path, "session", requestBody, &resp)
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
