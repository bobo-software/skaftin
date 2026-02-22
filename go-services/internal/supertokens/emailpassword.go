package supertokens

import (
	"context"
	"fmt"
)

type SignUpResponse struct {
	Status string      `json:"status"`
	User   *CoreUser   `json:"user,omitempty"`
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
	err := c.do(ctx, "PUT", "/recipe/user", "emailpassword", req, &resp)
	return &resp, err
}
