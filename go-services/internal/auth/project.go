package auth

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// VerifyProjectAccess returns middleware that checks if the JWT-authenticated
// user has access to the project specified in the URL path.
// Admin users bypass the check.
//
// The project ID is extracted from the URL path segment immediately after the
// mount prefix (e.g. /api/database/{projectId}/...). We cannot rely on
// r.PathValue because path parameters are only populated after the inner
// ServeMux matches, which hasn't happened at the middleware layer.
func VerifyProjectAccess(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return VerifyProjectAccessForPrefix(pool, "/api/database/")
}

func VerifyProjectAccessForPrefix(pool *pgxpool.Pool, mountPrefix string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userCtx := GetUserContext(r)
			if userCtx == nil {
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
				return
			}

			projectIDStr := r.PathValue("projectId")
			if projectIDStr == "" {
				projectIDStr = extractProjectID(r.URL.Path, mountPrefix)
			}
			if projectIDStr == "" {
				httputil.WriteError(w, http.StatusBadRequest, "Project ID is required")
				return
			}

			projectID, err := strconv.Atoi(projectIDStr)
			if err != nil {
				httputil.WriteError(w, http.StatusBadRequest, "Invalid project ID")
				return
			}

			if userCtx.Role == "admin" {
				next.ServeHTTP(w, r)
				return
			}

			hasAccess := false
			for _, id := range userCtx.ProjectIDs {
				if int(id) == projectID {
					hasAccess = true
					break
				}
			}

			if !hasAccess {
				slog.Warn("project access denied",
					"userId", userCtx.UserID,
					"projectId", projectID,
					"userProjectIds", userCtx.ProjectIDs,
				)
				httputil.WriteError(w, http.StatusForbidden, "You do not have access to this project")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractProjectID pulls the first path segment after the given prefix.
// For "/api/database/1/tables" with prefix "/api/database/" it returns "1".
func extractProjectID(path, prefix string) string {
	after, found := strings.CutPrefix(path, prefix)
	if !found {
		return ""
	}
	seg, _, _ := strings.Cut(after, "/")
	return seg
}
