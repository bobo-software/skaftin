package supertokens

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
)

// ForwardRecipeRequest forwards a request to SuperTokens core and returns the
// raw HTTP response so handlers can preserve status, headers, and body.
func (c *Client) ForwardRecipeRequest(
	ctx context.Context,
	method string,
	path string,
	recipeID string,
	incoming http.Header,
	body []byte,
) (*SessionRefreshResult, error) {
	var reqBody io.Reader
	if len(body) > 0 {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create forward request: %w", err)
	}

	req.Header.Set("cdi-version", "2.14")
	if recipeID != "" {
		req.Header.Set("rid", recipeID)
	}
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}

	if contentType := incoming.Get("Content-Type"); contentType != "" {
		req.Header.Set("Content-Type", contentType)
	} else if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}

	// Forward headers relevant to auth/session context.
	for _, h := range []string{
		"Cookie",
		"anti-csrf",
		"fdi-version",
		"st-auth-mode",
		"Authorization",
		"x-client-type",
		"x-request-id",
	} {
		if values := incoming.Values(h); len(values) > 0 {
			req.Header.Del(h)
			for _, v := range values {
				req.Header.Add(h, v)
			}
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supertokens forward request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read forward response: %w", err)
	}

	return &SessionRefreshResult{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header.Clone(),
		Body:       respBody,
	}, nil
}
