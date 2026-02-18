package gateway

import (
	"github.com/rs/cors"
)

// NewCORS creates a CORS handler configured for the Skaftin platform.
// Includes SuperTokens-specific headers required for session management.
// Allows all origins (echoing the request Origin) since client apps using
// API keys may connect from any domain.
func NewCORS() *cors.Cors {
	return cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Authorization",
			"X-API-Key",
			"X-Requested-With",
			"rid",
			"fdi-version",
			"st-auth-mode",
			"anti-csrf",
		},
		ExposedHeaders: []string{
			"st-access-token",
			"st-refresh-token",
			"front-token",
			"anti-csrf",
			"id-refresh-token",
		},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
