package models

import "errors"

var (
	ErrCredentialInactive = errors.New("credential is inactive")
	ErrCredentialExpired  = errors.New("credential has expired")
	ErrCredentialNotFound = errors.New("invalid credential")
	ErrNoToken            = errors.New("no authentication token provided")
	ErrPermissionDenied   = errors.New("insufficient permissions")
)
