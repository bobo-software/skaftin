package models

// UserContext holds the authenticated platform user's information
// extracted from a SuperTokens JWT access token.
type UserContext struct {
	UserID     string
	ProjectIDs []float64
	Role       string
}
