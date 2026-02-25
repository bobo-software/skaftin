package authmanagement

import "errors"

var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrAuthenticationClosed = errors.New("authentication is disabled")
	ErrMissingLoginIdentity = errors.New("user has no email or phone identity configured for login")
)
