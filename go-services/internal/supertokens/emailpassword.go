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

func updateEmailOrPasswordBody(userIDField, userID, password, email string) map[string]any {
	body := map[string]any{
		userIDField: userID,
	}
	if password != "" {
		body["password"] = password
	}
	if email != "" {
		body["email"] = email
	}
	return body
}

func isUnknownUserIDFieldError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "Field name 'recipeUserId' is invalid") ||
		strings.Contains(msg, "Field name 'userId' is invalid")
}

// UpdateEmailOrPassword updates the email or password for an EmailPassword user.
//
// The Go client advertises CDI 2.14, which expects "userId". Newer SuperTokens
// cores (CDI 5.x) expect "recipeUserId" instead. Try the CDI 2.14 field first,
// then fall back when the core rejects the field name.
func (c *Client) UpdateEmailOrPassword(ctx context.Context, req UpdatePasswordRequest) (*UpdatePasswordResponse, error) {
	var resp UpdatePasswordResponse

	err := c.do(ctx, "PUT", "/recipe/user", "emailpassword",
		updateEmailOrPasswordBody("userId", req.RecipeUserID, req.Password, req.Email), &resp)
	if err == nil {
		return &resp, nil
	}
	if !isUnknownUserIDFieldError(err) {
		return &resp, err
	}

	err = c.do(ctx, "PUT", "/recipe/user", "emailpassword",
		updateEmailOrPasswordBody("recipeUserId", req.RecipeUserID, req.Password, req.Email), &resp)
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
