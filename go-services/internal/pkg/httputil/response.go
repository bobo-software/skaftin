package httputil

import (
	"encoding/json"
	"net/http"
	"time"
)

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
	resp := map[string]any{
		"success":   true,
		"message":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	if data != nil {
		resp["data"] = data
	}
	WriteJSON(w, status, resp)
}
