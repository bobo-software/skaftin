package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/store"
)

type contextKey string

const AuthContextKey contextKey = "authContext"

// GetAuthContext extracts the AuthContext from the request context.
func GetAuthContext(r *http.Request) *model.AuthContext {
	if val, ok := r.Context().Value(AuthContextKey).(*model.AuthContext); ok {
		return val
	}
	return nil
}

// APIKey returns middleware that validates API keys and access tokens.
// It checks the X-API-Key header and Authorization: Bearer <token> header,
// then verifies the credential against the database.
func APIKey(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				slog.Warn("no authentication token provided",
					"path", r.URL.Path,
					"method", r.Method,
				)
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required. Provide X-API-Key header or Authorization Bearer token.")
				return
			}

			cred, err := store.VerifyCredential(r.Context(), pool, token)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					slog.Warn("invalid credential", "path", r.URL.Path)
					httputil.WriteError(w, http.StatusForbidden, "Invalid API key or access token")
					return
				}
				if errors.Is(err, model.ErrCredentialInactive) {
					httputil.WriteError(w, http.StatusForbidden, "Credential is inactive")
					return
				}
				if errors.Is(err, model.ErrCredentialExpired) {
					httputil.WriteError(w, http.StatusForbidden, "Credential has expired")
					return
				}
				slog.Error("credential verification failed", "error", err, "path", r.URL.Path)
				httputil.WriteError(w, http.StatusInternalServerError, "Authentication failed")
				return
			}

			schemaName, err := store.LookupSchemaName(r.Context(), pool, cred.ProjectID)
			if err != nil {
				slog.Error("failed to look up project schema", "error", err, "projectId", cred.ProjectID)
				httputil.WriteError(w, http.StatusBadRequest, "Project not found")
				return
			}

			store.UpdateLastUsed(r.Context(), pool, token)

			authCtx := &model.AuthContext{
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

// APIKeyWebSocket validates credentials for websocket upgrade requests.
// In addition to headers, it allows query-string auth for browser clients:
// - ?api_key=...
// - ?token=...
func APIKeyWebSocket(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractTokenForWebSocket(r)
			if token == "" {
				slog.Warn("no websocket authentication token provided",
					"path", r.URL.Path,
					"method", r.Method,
				)
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required. Provide X-API-Key, Authorization Bearer token, or ?api_key query parameter.")
				return
			}

			cred, err := store.VerifyCredential(r.Context(), pool, token)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					slog.Warn("invalid websocket credential", "path", r.URL.Path)
					httputil.WriteError(w, http.StatusForbidden, "Invalid API key or access token")
					return
				}
				if errors.Is(err, model.ErrCredentialInactive) {
					httputil.WriteError(w, http.StatusForbidden, "Credential is inactive")
					return
				}
				if errors.Is(err, model.ErrCredentialExpired) {
					httputil.WriteError(w, http.StatusForbidden, "Credential has expired")
					return
				}
				slog.Error("websocket credential verification failed", "error", err, "path", r.URL.Path)
				httputil.WriteError(w, http.StatusInternalServerError, "Authentication failed")
				return
			}

			schemaName, err := store.LookupSchemaName(r.Context(), pool, cred.ProjectID)
			if err != nil {
				slog.Error("failed to look up project schema", "error", err, "projectId", cred.ProjectID)
				httputil.WriteError(w, http.StatusBadRequest, "Project not found")
				return
			}

			store.UpdateLastUsed(r.Context(), pool, token)
			authCtx := &model.AuthContext{
				Credential: cred,
				ProjectID:  cred.ProjectID,
				SchemaName: schemaName,
			}
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
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
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
				httputil.WriteError(w, http.StatusForbidden, "Insufficient permissions. Required: "+permission)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractToken gets the authentication token from request headers.
func extractToken(r *http.Request) string {
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return apiKey
	}

	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

func extractTokenForWebSocket(r *http.Request) string {
	if token := extractToken(r); token != "" {
		return token
	}
	if apiKey := strings.TrimSpace(r.URL.Query().Get("api_key")); apiKey != "" {
		return apiKey
	}
	if token := strings.TrimSpace(r.URL.Query().Get("token")); token != "" {
		return token
	}
	return ""
}
