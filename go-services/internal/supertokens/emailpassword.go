package supertokens

import (
	"context"
	"fmt"
	"strings"
)

type SignUpResponse struct {
	Status string    `json:"status"`
	User   *CoreUser `json:"user,omitempty"`
}

type SignInResponse struct {
	Status string    `json:"status"`
	User   *CoreUser `json:"user,omitempty"`
}

type CoreUser struct {
	ID         string   `json:"id"`
	Emails     []string `json:"emails,omitempty"`
	TimeJoined int64    `json:"timeJoined,omitempty"`
}

// SignUp creates a new EmailPassword user in the given tenant.
func (c *Client) SignUp(ctx context.Context, tenantID, email, password string) (*SignUpResponse, error) {
	path := fmt.Sprintf("/%s/recipe/signup", tenantID)
	var resp SignUpResponse
	err := c.do(ctx, "POST", path, "emailpassword", map[string]string{
		"email":    email,
		"password": password,
	}, &resp)
	return &resp, err
}

// SignIn authenticates an EmailPassword user.
func (c *Client) SignIn(ctx context.Context, tenantID, email, password string) (*SignInResponse, error) {
	path := fmt.Sprintf("/%s/recipe/signin", tenantID)
	var resp SignInResponse
	err := c.do(ctx, "POST", path, "emailpassword", map[string]string{
		"email":    email,
		"password": password,
	}, &resp)
	return &resp, err
}

type UpdatePasswordRequest struct {
	RecipeUserID string `json:"recipeUserId"`
	Password     string `json:"password,omitempty"`
	Email        string `json:"email,omitempty"`
}

type UpdatePasswordResponse struct {
	Status string `json:"status"`
}

// UpdateEmailOrPassword updates the email or password for an EmailPassword user.
func (c *Client) UpdateEmailOrPassword(ctx context.Context, req UpdatePasswordRequest) (*UpdatePasswordResponse, error) {
	var resp UpdatePasswordResponse
	primaryBody := map[string]any{
		"recipeUserId": req.RecipeUserID,
	}
	if req.Password != "" {
		primaryBody["password"] = req.Password
	}
	if req.Email != "" {
		primaryBody["email"] = req.Email
	}

	err := c.do(ctx, "PUT", "/recipe/user", "emailpassword", primaryBody, &resp)
	if err == nil {
		return &resp, nil
	}

	// Compatibility fallback for older/newer cores that expect userId.
	// Retry only when the first request failed due to an unknown recipeUserId field.
	if !strings.Contains(err.Error(), "Field name 'recipeUserId' is invalid") {
		return &resp, err
	}

	fallbackBody := map[string]any{
		"userId": req.RecipeUserID,
	}
	if req.Password != "" {
		fallbackBody["password"] = req.Password
	}
	if req.Email != "" {
		fallbackBody["email"] = req.Email
	}

	err = c.do(ctx, "PUT", "/recipe/user", "emailpassword", fallbackBody, &resp)
	return &resp, err
}

// CreatePasswordResetToken asks SuperTokens Core for a one-time password reset token (CDI).
type CreatePasswordResetTokenResponse struct {
	Status string `json:"status"`
	Token  string `json:"token,omitempty"`
}

// CreatePasswordResetToken calls POST /{tenantID}/recipe/user/password/reset/token.
func (c *Client) CreatePasswordResetToken(ctx context.Context, tenantID, userID, email string) (*CreatePasswordResetTokenResponse, error) {
	path := fmt.Sprintf("/%s/recipe/user/password/reset/token", tenantID)
	body := map[string]string{
		"userId": userID,
		"email":  email,
	}
	var resp CreatePasswordResetTokenResponse
	if err := c.do(ctx, "POST", path, "emailpassword", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResetPasswordWithTokenResponse is the subset of CDI fields used by the platform reset flow.
type ResetPasswordWithTokenResponse struct {
	Status     string `json:"status"`
	FormFields []struct {
		ID    string `json:"id"`
		Error string `json:"error"`
	} `json:"formFields,omitempty"`
}

// ResetPasswordWithToken calls POST /{tenantID}/recipe/user/password/reset with method "token".
func (c *Client) ResetPasswordWithToken(ctx context.Context, tenantID, token, newPassword string) (*ResetPasswordWithTokenResponse, error) {
	path := fmt.Sprintf("/%s/recipe/user/password/reset", tenantID)
	var resp ResetPasswordWithTokenResponse
	err := c.do(ctx, "POST", path, "emailpassword", map[string]string{
		"method":   "token",
		"token":    token,
		"password": newPassword,
	}, &resp)
	return &resp, err
}
