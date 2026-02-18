package validate

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// DecodeJSON reads and decodes a JSON request body into the given target.
// Returns an error suitable for returning to the client.
func DecodeJSON(r *http.Request, target any) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB limit
	if err != nil {
		return fmt.Errorf("failed to read request body: %w", err)
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	return nil
}

// RequireFields checks that all required string fields are non-empty.
func RequireFields(fields map[string]string) error {
	for name, value := range fields {
		if value == "" {
			return fmt.Errorf("field %q is required", name)
		}
	}
	return nil
}
