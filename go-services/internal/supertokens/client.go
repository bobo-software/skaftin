package supertokens

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client communicates with the SuperTokens Core HTTP API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a SuperTokens Core client.
// coreURL is the base URL (e.g. "http://localhost:3567").
// apiKey is optional; pass "" if the core has no API key configured.
func NewClient(coreURL, apiKey string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(coreURL, "/"),
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) do(ctx context.Context, method, path string, recipeID string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	if recipeID != "" {
		req.Header.Set("rid", recipeID)
	}
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}
	// Use CDI 2.14 for compatibility with the deployed SuperTokens core.
	req.Header.Set("cdi-version", "2.14")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supertokens request %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supertokens %s %s returned %d: %s", method, path, resp.StatusCode, string(respBody))
	}

	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

// CreateProjectScopedEmail builds the email SuperTokens stores for an app user.
// Format: project_{projectId}_{email}
func CreateProjectScopedEmail(email string, projectID int) string {
	return fmt.Sprintf("project_%d_%s", projectID, email)
}

// ExtractOriginalEmail reverses CreateProjectScopedEmail.
func ExtractOriginalEmail(scopedEmail string, projectID int) string {
	prefix := fmt.Sprintf("project_%d_", projectID)
	if strings.HasPrefix(scopedEmail, prefix) {
		return strings.TrimPrefix(scopedEmail, prefix)
	}
	return scopedEmail
}

// CreatePhoneScopedEmail builds a fake email for phone-only app users.
func CreatePhoneScopedEmail(phone string, projectID int) string {
	sanitized := strings.NewReplacer("+", "", " ", "", "-", "", "(", "", ")", "").Replace(phone)
	return fmt.Sprintf("project_%d_phone_%s@skaftin.local", projectID, sanitized)
}
