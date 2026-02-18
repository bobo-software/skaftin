package model

// APIResponse is the standard envelope for all JSON API responses.
type APIResponse struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}
