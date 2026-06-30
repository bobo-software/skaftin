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

// AppAPI2Auth returns middleware for /app-api2 open-browse routes.
// It requires both X-API-Key (api_key) and Authorization Bearer (access_token)
// from the same project. Permissions are taken from the access token.
func AppAPI2Auth(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKeyToken := extractAPIKeyHeader(r)
			if apiKeyToken == "" {
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required. Provide X-API-Key header with an api_key credential.")
				return
			}

			accessToken := extractBearerToken(r)
			if accessToken == "" {
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required. Provide Authorization Bearer header with an access_token credential.")
				return
			}

			apiKeyCred, err := store.VerifyCredential(r.Context(), pool, apiKeyToken)
			if err != nil {
				writeCredentialError(w, err, "API key")
				return
			}

			accessCred, err := store.VerifyCredential(r.Context(), pool, accessToken)
			if err != nil {
				writeCredentialError(w, err, "Access token")
				return
			}

			if err := validateAppAPI2CredentialPair(apiKeyCred, accessCred); err != nil {
				httputil.WriteError(w, http.StatusForbidden, err.Error())
				return
			}

			schemaName, err := store.LookupSchemaName(r.Context(), pool, apiKeyCred.ProjectID)
			if err != nil {
				slog.Error("failed to look up project schema", "error", err, "projectId", apiKeyCred.ProjectID)
				httputil.WriteError(w, http.StatusBadRequest, "Project not found")
				return
			}

			store.UpdateLastUsed(r.Context(), pool, apiKeyToken)
			store.UpdateLastUsed(r.Context(), pool, accessToken)

			authCtx := &model.AuthContext{
				Credential:       accessCred,
				APIKeyCredential: apiKeyCred,
				ProjectID:        apiKeyCred.ProjectID,
				SchemaName:       schemaName,
			}

			slog.Info("app-api2 authenticated request",
				"projectId", apiKeyCred.ProjectID,
				"path", r.URL.Path,
			)

			ctx := context.WithValue(r.Context(), AuthContextKey, authCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func validateAppAPI2CredentialPair(apiKeyCred, accessCred *model.Credential) error {
	if apiKeyCred.CredentialType != "api_key" {
		return errors.New("X-API-Key must be an api_key credential")
	}
	if accessCred.CredentialType != "access_token" {
		return errors.New("Authorization Bearer must be an access_token credential")
	}
	if apiKeyCred.ProjectID != accessCred.ProjectID {
		return errors.New("API key and access token must belong to the same project")
	}
	return nil
}

func writeCredentialError(w http.ResponseWriter, err error, label string) {
	if errors.Is(err, pgx.ErrNoRows) {
		httputil.WriteError(w, http.StatusForbidden, "Invalid "+label)
		return
	}
	if errors.Is(err, model.ErrCredentialInactive) {
		httputil.WriteError(w, http.StatusForbidden, label+" is inactive")
		return
	}
	if errors.Is(err, model.ErrCredentialExpired) {
		httputil.WriteError(w, http.StatusForbidden, label+" has expired")
		return
	}
	slog.Error("credential verification failed", "error", err, "label", label)
	httputil.WriteError(w, http.StatusInternalServerError, "Authentication failed")
}

func extractAPIKeyHeader(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-API-Key"))
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}
