package httputil

import (
	"encoding/json"
	"net/http"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// WriteError writes a standardized JSON error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]any{
		"success": false,
		"error":   message,
	})
}

// WriteSuccess writes a standardized JSON success response.
func WriteSuccess(w http.ResponseWriter, status int, data any) {
	WriteJSON(w, status, map[string]any{
		"success": true,
		"data":    data,
	})
}
