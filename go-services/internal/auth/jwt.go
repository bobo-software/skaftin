package auth

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/golang-jwt/jwt/v5"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

const UserContextKey contextKey = "userContext"

var jwtCoreFallbackCount int64

// GetUserContext extracts the UserContext from the request context.
func GetUserContext(r *http.Request) *model.UserContext {
	if val, ok := r.Context().Value(UserContextKey).(*model.UserContext); ok {
		return val
	}
	return nil
}

// RequireUser extracts the authenticated user from the request context.
// Returns nil and writes a 401 response if no user is present.
func RequireUser(w http.ResponseWriter, r *http.Request) *model.UserContext {
	u := GetUserContext(r)
	if u == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return nil
	}
	return u
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
				if os.Getenv("SKAFTIN_ENABLE_JWT_CORE_FALLBACK") == "false" {
					slog.Warn("JWT validation failed and core fallback disabled",
						"error", err,
						"path", r.URL.Path,
					)
					httputil.WriteError(w, http.StatusUnauthorized, "Invalid or expired session token")
					return
				}

				// Compatibility fallback: some SuperTokens core/session versions can
				// return access tokens that fail strict JWT parsing in this middleware.
				// In that case, verify token directly with SuperTokens Core.
				userCtx, coreErr := verifySessionWithCore(r.Context(), tokenStr)
				if coreErr != nil {
					slog.Warn("JWT validation failed",
						"error", err,
						"coreFallbackError", coreErr,
						"path", r.URL.Path,
					)
					httputil.WriteError(w, http.StatusUnauthorized, "Invalid or expired session token")
					return
				}

				fallbackCount := atomic.AddInt64(&jwtCoreFallbackCount, 1)
				slog.Warn("JWT parsed via SuperTokens core fallback",
					"path", r.URL.Path,
					"fallbackCount", fallbackCount,
				)
				ctx := context.WithValue(r.Context(), UserContextKey, userCtx)
				next.ServeHTTP(w, r.WithContext(ctx))
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
			applyClaimsToUserContext(userCtx, map[string]any(claims))

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
		// QueryUnescape would convert '+' into spaces, corrupting tokens.
		// Only perform percent-decoding when needed and preserve '+'.
		if strings.Contains(cookie.Value, "%") {
			decoded, decErr := url.PathUnescape(cookie.Value)
			if decErr == nil && decoded != "" {
				return decoded
			}
		}
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

func verifySessionWithCore(ctx context.Context, token string) (*model.UserContext, error) {
	coreURL := os.Getenv("SUPERTOKENS_CORE_URL")
	if coreURL == "" {
		coreURL = os.Getenv("SUPERTOKENS_CONNECTION_URI")
	}
	if coreURL == "" {
		return nil, fmt.Errorf("supertokens core url is not configured")
	}

	st := supertokens.NewClient(coreURL, os.Getenv("SUPERTOKENS_API_KEY"))
	sessionResp, err := st.GetSession(ctx, token)
	if err != nil {
		return nil, err
	}
	if sessionResp == nil || sessionResp.Session.UserID == "" {
		return nil, fmt.Errorf("session verification returned empty user")
	}

	userCtx := &model.UserContext{
		UserID: sessionResp.Session.UserID,
		Role:   "user",
	}
	if claims, ok := sessionResp.Session.UserDataInAccessToken.(map[string]any); ok {
		applyClaimsToUserContext(userCtx, claims)
	}
	if claims, ok := sessionResp.Session.UserDataInJWT.(map[string]any); ok {
		applyClaimsToUserContext(userCtx, claims)
	}

	slog.Info("session verified via SuperTokens core fallback",
		"userId", userCtx.UserID,
		"role", userCtx.Role,
	)
	return userCtx, nil
}

func applyClaimsToUserContext(userCtx *model.UserContext, claims map[string]any) {
	if userCtx == nil || claims == nil {
		return
	}

	sources := []map[string]any{claims}
	if nested, ok := claims["userData"].(map[string]any); ok {
		sources = append(sources, nested)
	}
	if nested, ok := claims["up"].(map[string]any); ok {
		sources = append(sources, nested)
	}

	for _, src := range sources {
		if userCtx.Role == "" || userCtx.Role == "user" {
			if role, ok := src["role"].(string); ok && role != "" {
				userCtx.Role = role
			}
		}
		userCtx.ProjectIDs = append(userCtx.ProjectIDs, parseProjectIDs(src["projectIds"])...)
	}

	if len(userCtx.ProjectIDs) > 1 {
		seen := make(map[float64]struct{}, len(userCtx.ProjectIDs))
		unique := make([]float64, 0, len(userCtx.ProjectIDs))
		for _, id := range userCtx.ProjectIDs {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			unique = append(unique, id)
		}
		userCtx.ProjectIDs = unique
	}
}

func parseProjectIDs(v any) []float64 {
	switch ids := v.(type) {
	case []any:
		out := make([]float64, 0, len(ids))
		for _, id := range ids {
			switch n := id.(type) {
			case float64:
				out = append(out, n)
			case int:
				out = append(out, float64(n))
			case int64:
				out = append(out, float64(n))
			case string:
				if parsed, err := strconv.ParseFloat(n, 64); err == nil {
					out = append(out, parsed)
				}
			}
		}
		return out
	case []float64:
		return ids
	case []int:
		out := make([]float64, 0, len(ids))
		for _, id := range ids {
			out = append(out, float64(id))
		}
		return out
	default:
		return nil
	}
}
