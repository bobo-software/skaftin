package middleware

import (
	"github.com/rs/cors"
)

// NewCORS creates a CORS handler configured for the Skaftin platform.
func NewCORS() *cors.Cors {
	return cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Authorization",
			"X-API-Key",
			"X-Requested-With",
		},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
