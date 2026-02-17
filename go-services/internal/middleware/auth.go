package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/models"
)

type contextKey string

const AuthContextKey contextKey = "authContext"

// GetAuthContext extracts the AuthContext from the request context.
func GetAuthContext(r *http.Request) *models.AuthContext {
	if val, ok := r.Context().Value(AuthContextKey).(*models.AuthContext); ok {
		return val
	}
	return nil
}

// Auth returns middleware that validates API keys and access tokens.
// It checks the X-API-Key header and Authorization: Bearer <token> header,
// then verifies the credential against the database.
func Auth(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				slog.Warn("no authentication token provided",
					"path", r.URL.Path,
					"method", r.Method,
				)
				writeError(w, "Authentication required. Provide X-API-Key header or Authorization Bearer token.", http.StatusUnauthorized)
				return
			}

			// Verify the credential against the database
			cred, err := models.VerifyCredential(r.Context(), pool, token)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					slog.Warn("invalid credential",
						"path", r.URL.Path,
					)
					writeError(w, "Invalid API key or access token", http.StatusForbidden)
					return
				}
				if errors.Is(err, models.ErrCredentialInactive) {
					writeError(w, "Credential is inactive", http.StatusForbidden)
					return
				}
				if errors.Is(err, models.ErrCredentialExpired) {
					writeError(w, "Credential has expired", http.StatusForbidden)
					return
				}
				slog.Error("credential verification failed",
					"error", err,
					"path", r.URL.Path,
				)
				writeError(w, "Authentication failed", http.StatusInternalServerError)
				return
			}

			// Look up the project schema name
			schemaName, err := models.LookupSchemaName(r.Context(), pool, cred.ProjectID)
			if err != nil {
				slog.Error("failed to look up project schema",
					"error", err,
					"projectId", cred.ProjectID,
				)
				writeError(w, "Project not found", http.StatusBadRequest)
				return
			}

			// Update last used timestamp (non-blocking)
			models.UpdateLastUsed(r.Context(), pool, token)

			// Attach auth context to the request
			authCtx := &models.AuthContext{
				Credential: cred,
				ProjectID:  cred.ProjectID,
				SchemaName: schemaName,
			}

			slog.Info("authenticated request",
				"projectId", cred.ProjectID,
				"credentialType", cred.CredentialType,
				"path", r.URL.Path,
			)

			ctx := context.WithValue(r.Context(), AuthContextKey, authCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission returns middleware that checks if the authenticated
// credential has a specific permission.
func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authCtx := GetAuthContext(r)
			if authCtx == nil || authCtx.Credential == nil {
				writeError(w, "Authentication required", http.StatusUnauthorized)
				return
			}

			hasPermission := false
			for _, p := range authCtx.Credential.Permissions {
				if p == permission {
					hasPermission = true
					break
				}
			}

			if !hasPermission {
				slog.Warn("permission denied",
					"required", permission,
					"has", authCtx.Credential.Permissions,
					"projectId", authCtx.ProjectID,
				)
				writeError(w, "Insufficient permissions. Required: "+permission, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractToken gets the authentication token from request headers.
// Checks X-API-Key first, then Authorization: Bearer <token>.
func extractToken(r *http.Request) string {
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return apiKey
	}

	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"success": false,
		"error":   message,
	})
}
