package authmanagement

import "errors"

var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrAuthenticationClosed = errors.New("authentication is disabled")
)
