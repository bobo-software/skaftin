package supertokens

import (
	"context"
	"fmt"
	"net/url"
)

type DeleteUserResponse struct {
	Status string `json:"status"`
}

// DeleteUser removes a user from SuperTokens.
func (c *Client) DeleteUser(ctx context.Context, userID string) error {
	var resp DeleteUserResponse
	return c.do(ctx, "POST", "/user/remove", "", map[string]string{
		"userId": userID,
	}, &resp)
}

type GetUserByIDResponse struct {
	Status string    `json:"status"`
	User   *CoreUser `json:"user,omitempty"`
}

// GetUserByID fetches a user from SuperTokens Core by their user ID.
func (c *Client) GetUserByID(ctx context.Context, userID string) (*CoreUser, error) {
	path := fmt.Sprintf("/user/id?userId=%s", url.QueryEscape(userID))
	var resp GetUserByIDResponse
	if err := c.do(ctx, "GET", path, "", nil, &resp); err != nil {
		return nil, err
	}
	if resp.User == nil {
		return nil, fmt.Errorf("user not found: %s", userID)
	}
	return resp.User, nil
}

type UsersByAccountInfoResponse struct {
	Users []CoreUser `json:"users"`
}

// ListUsersByAccountInfo finds users by email in a tenant.
func (c *Client) ListUsersByAccountInfo(ctx context.Context, tenantID, email string) ([]CoreUser, error) {
	// Some SuperTokens core versions require doUnionOfAccountInfo explicitly.
	path := fmt.Sprintf(
		"/%s/users/by-accountinfo?email=%s&doUnionOfAccountInfo=true",
		tenantID,
		url.QueryEscape(email),
	)
	var resp UsersByAccountInfoResponse
	if err := c.do(ctx, "GET", path, "", nil, &resp); err != nil {
		return nil, err
	}
	return resp.Users, nil
}
