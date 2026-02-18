package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

const UserContextKey contextKey = "userContext"

// GetUserContext extracts the UserContext from the request context.
func GetUserContext(r *http.Request) *model.UserContext {
	if val, ok := r.Context().Value(UserContextKey).(*model.UserContext); ok {
		return val
	}
	return nil
}

// JWTAuth returns middleware that validates SuperTokens JWT access tokens.
// It checks the sAccessToken cookie and Authorization: Bearer header.
func JWTAuth(jwks *JWKSProvider) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractJWT(r)
			if tokenStr == "" {
				slog.Warn("no JWT token found",
					"path", r.URL.Path,
					"method", r.Method,
				)
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required. Provide a valid session cookie or Authorization Bearer token.")
				return
			}

			token, err := jwt.Parse(tokenStr, jwks.GetKey, jwt.WithValidMethods([]string{"RS256"}))
			if err != nil {
				slog.Warn("JWT validation failed",
					"error", err,
					"path", r.URL.Path,
				)
				httputil.WriteError(w, http.StatusUnauthorized, "Invalid or expired session token")
				return
			}

			if !token.Valid {
				httputil.WriteError(w, http.StatusUnauthorized, "Invalid session token")
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				httputil.WriteError(w, http.StatusUnauthorized, "Invalid token claims")
				return
			}

			userCtx := &model.UserContext{
				UserID: getStringClaim(claims, "sub"),
				Role:   getStringClaim(claims, "role"),
			}

			if ids, ok := claims["projectIds"]; ok {
				if idSlice, ok := ids.([]interface{}); ok {
					for _, id := range idSlice {
						if num, ok := id.(float64); ok {
							userCtx.ProjectIDs = append(userCtx.ProjectIDs, num)
						}
					}
				}
			}

			slog.Info("JWT authenticated request",
				"userId", userCtx.UserID,
				"role", userCtx.Role,
				"path", r.URL.Path,
			)

			ctx := context.WithValue(r.Context(), UserContextKey, userCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractJWT(r *http.Request) string {
	if cookie, err := r.Cookie("sAccessToken"); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

func getStringClaim(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
