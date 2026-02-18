package model

import "time"

// Credential represents an API key, access token, or MCP key from the database.
type Credential struct {
	ID             int
	ProjectID      int
	Name           string
	CredentialType string // "api_key", "access_token", "mcp_key"
	Permissions    []string
	IsActive       bool
	ExpiresAt      *time.Time
}

// AuthContext holds the authenticated credential and resolved project info.
// Attached to the request context by the API key middleware.
type AuthContext struct {
	Credential *Credential
	ProjectID  int
	SchemaName string
}

// UserContext holds the authenticated platform user's information
// extracted from a SuperTokens JWT access token.
type UserContext struct {
	UserID     string
	ProjectIDs []float64
	Role       string
}
