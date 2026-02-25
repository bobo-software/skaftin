package httputil

import (
	"encoding/json"
	"io"
	"net/http"
	"time"
)

// ReadJSON decodes the request body into the given destination.
func ReadJSON(r *http.Request, dst any) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	return json.Unmarshal(body, dst)
}

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// WriteError writes a standardized JSON error response.
// Format: {success: false, message: "...", error: "..."}
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]any{
		"success": false,
		"message": message,
		"error":   message,
	})
}

// WriteSuccess writes a standardized JSON success response.
// Format: {success: true, message: "...", data: ..., timestamp: "..."}
func WriteSuccess(w http.ResponseWriter, status int, message string, data any) {
	if data == nil {
		data = map[string]any{}
	}
	WriteJSON(w, status, map[string]any{
		"success":   true,
		"message":   message,
		"data":      data,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
}
