package auth

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// VerifyProjectAccess returns middleware that checks if the JWT-authenticated
// user has access to the project specified by the {projectId} path parameter.
// Admin users bypass the check.
func VerifyProjectAccess(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userCtx := GetUserContext(r)
			if userCtx == nil {
				httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
				return
			}

			projectIDStr := r.PathValue("projectId")
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
