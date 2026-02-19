package httputil

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

// ProjectID extracts and validates the "projectId" path parameter.
// Returns 0, false and writes a 400 response on failure.
func ProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		WriteError(w, http.StatusBadRequest, "Project ID is required")
		return 0, false
	}
	return id, true
}

// PathInt extracts a named integer path parameter.
// Returns 0, false if the value is missing or not a valid integer.
func PathInt(r *http.Request, name string) (int, bool) {
	v, err := strconv.Atoi(r.PathValue(name))
	if err != nil {
		return 0, false
	}
	return v, true
}

// DecodeBody reads and decodes a JSON request body into dst.
// Limits the body to 1 MB to prevent abuse.
func DecodeBody(r *http.Request, dst any) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(dst)
}

// IntQuery parses a string as an integer, returning fallback on failure.
func IntQuery(s string, fallback int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return fallback
}
