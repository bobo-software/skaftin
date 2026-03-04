package authmanagement

import (
	"context"
	"net/http"
	"os"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

type Handler struct {
	service   *Service
	loginFunc func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error)
}

func NewHandler(pool *pgxpool.Pool, st *supertokens.Client, comms *communications.Service) *Handler {
	svc := NewService(pool, st, comms)
	return &Handler{
		service:   svc,
		loginFunc: svc.Login,
	}
}

// RegisterLegacyCompatibilityRoutes registers non-project legacy platform auth routes.
func (h *Handler) RegisterLegacyCompatibilityRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/register", h.LegacyRegister)
	mux.HandleFunc("POST /api/auth/login", h.LegacyLogin)
	mux.HandleFunc("POST /api/auth/logout", h.LegacyLogout)

	// Legacy verify/refresh overlap with canonical web flow:
	// session via /auth/* and profile via /api/users/me.
	// Keep opt-in support for old clients behind an env flag.
	if os.Getenv("SKAFTIN_ENABLE_LEGACY_VERIFY_REFRESH") == "true" {
		mux.HandleFunc("POST /api/auth/verify", h.LegacyVerify)
		mux.HandleFunc("POST /api/auth/refresh", h.LegacyRefresh)
	}
}

// RegisterPublicRoutes registers unauthenticated routes (app auth).
func (h *Handler) RegisterPublicRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/{projectId}/auth/register", h.Register)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/login", h.Login)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/single-credential-login", h.SingleCredentialLogin)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/otp-login", h.RequestOTPLogin)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify-otp-login", h.VerifyOTPLogin)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify", h.VerifySession)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/logout", h.LogoutSession)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify-otp", h.VerifyOTP)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/forgot-password", h.ForgotPassword)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify-forgot-password-otp", h.VerifyForgotPasswordOTP)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/reset-password", h.ResetPassword)
}

// RegisterAppAPICompatibilityRoutes registers app-api compatibility routes that
// preserve legacy client URL shape while being handled in Go.
func (h *Handler) RegisterAppAPICompatibilityRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /app-api/auth/auth/login", h.LoginFromAppAPI)
	mux.HandleFunc("POST /app-api/auth/auth/logout", h.LogoutFromAppAPI)
	mux.HandleFunc("POST /app-api/auth/session/refresh", h.RefreshFromAppAPI)
}

// RegisterAppAPIRoutes registers the full app-api auth surface in Go.
// Routes keep legacy shapes (no projectId in URL) and resolve project context
// from API-key authentication middleware.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	// Legacy compatibility endpoints (already used by clients)
	h.RegisterAppAPICompatibilityRoutes(mux)

	// App user public auth endpoints
	mux.HandleFunc("POST /app-api/auth/auth/register", h.withAppAPIProject(h.Register))
	mux.HandleFunc("POST /app-api/auth/auth/single-credential-login", h.withAppAPIProject(h.SingleCredentialLogin))
	mux.HandleFunc("POST /app-api/auth/auth/otp-login", h.withAppAPIProject(h.RequestOTPLogin))
	mux.HandleFunc("POST /app-api/auth/auth/verify-otp-login", h.withAppAPIProject(h.VerifyOTPLogin))
	mux.HandleFunc("POST /app-api/auth/auth/verify", h.withAppAPIProject(h.VerifySession))
	mux.HandleFunc("POST /app-api/auth/auth/verify-otp", h.withAppAPIProject(h.VerifyOTP))
	mux.HandleFunc("POST /app-api/auth/auth/forgot-password", h.withAppAPIProject(h.ForgotPassword))
	mux.HandleFunc("POST /app-api/auth/auth/verify-forgot-password-otp", h.withAppAPIProject(h.VerifyForgotPasswordOTP))
	mux.HandleFunc("POST /app-api/auth/auth/reset-password", h.withAppAPIProject(h.ResetPassword))

	// App user protected auth endpoints
	mux.HandleFunc("POST /app-api/auth/auth/change-password-request", h.withAppAPIProject(h.ChangePasswordRequest))
	mux.HandleFunc("POST /app-api/auth/auth/verify-password-change-otp", h.withAppAPIProject(h.VerifyPasswordChangeOTP))
	mux.HandleFunc("POST /app-api/auth/auth/request-account-deletion", h.withAppAPIProject(h.RequestAccountDeletion))
	mux.HandleFunc("POST /app-api/auth/auth/verify-account-deletion-otp", h.withAppAPIProject(h.VerifyAccountDeletionOTP))
	mux.HandleFunc("POST /app-api/auth/auth/cancel-account-deletion", h.withAppAPIProject(h.CancelAccountDeletion))

	// Users
	mux.HandleFunc("GET /app-api/auth/users", h.withAppAPIProject(h.ListUsers))
	// Keep role-user lookup on /roles to avoid ServeMux overlap with /users/{userId}/password.
	mux.HandleFunc("GET /app-api/auth/roles/{roleId}/users", h.withAppAPIProject(h.GetUsersByRole))
	mux.HandleFunc("GET /app-api/auth/users/{userId}", h.withAppAPIProject(h.GetUserHandler))
	mux.HandleFunc("GET /app-api/auth/users/{userId}/password", h.withAppAPIProject(h.GetUserPasswordHandler))
	mux.HandleFunc("POST /app-api/auth/users/{userId}/password", h.withAppAPIProject(h.SetUserPasswordHandler))
	mux.HandleFunc("POST /app-api/auth/users/{userId}/password/verify", h.withAppAPIProject(h.VerifyUserPasswordHandler))
	mux.HandleFunc("POST /app-api/auth/users", h.withAppAPIProject(h.CreateUserHandler))
	mux.HandleFunc("PUT /app-api/auth/users/{userId}", h.withAppAPIProject(h.UpdateUserHandler))
	mux.HandleFunc("DELETE /app-api/auth/users/{userId}", h.withAppAPIProject(h.DeleteUserHandler))
	mux.HandleFunc("GET /app-api/auth/users/{userId}/otp-status", h.withAppAPIProject(h.GetUserOTPStatusHandler))
	mux.HandleFunc("POST /app-api/auth/users/{userId}/resend-otp", h.withAppAPIProject(h.ResendOTPHandler))
	mux.HandleFunc("POST /app-api/auth/users/{userId}/manual-verify", h.withAppAPIProject(h.ManuallyVerifyHandler))
	mux.HandleFunc("POST /app-api/auth/users/{userId}/roles", h.withAppAPIProject(h.AssignRoleHandler))
	mux.HandleFunc("DELETE /app-api/auth/users/{userId}/roles/{roleId}", h.withAppAPIProject(h.RemoveRoleHandler))
	mux.HandleFunc("POST /app-api/auth/users/export", h.withAppAPIProject(h.ExportUsersHandler))

	// Roles
	mux.HandleFunc("GET /app-api/auth/roles", h.withAppAPIProject(h.ListRolesHandler))
	mux.HandleFunc("GET /app-api/auth/roles/{roleId}", h.withAppAPIProject(h.GetRoleHandler))
	mux.HandleFunc("POST /app-api/auth/roles", h.withAppAPIProject(h.CreateRoleHandler))
	mux.HandleFunc("PUT /app-api/auth/roles/{roleId}", h.withAppAPIProject(h.UpdateRoleHandler))
	mux.HandleFunc("DELETE /app-api/auth/roles/{roleId}", h.withAppAPIProject(h.DeleteRoleHandler))
	mux.HandleFunc("GET /app-api/auth/roles/{roleId}/permissions", h.withAppAPIProject(h.GetRolePermissionsHandler))
	mux.HandleFunc("PUT /app-api/auth/roles/{roleId}/permissions", h.withAppAPIProject(h.UpdateRolePermissionsHandler))
	mux.HandleFunc("PUT /app-api/auth/roles/{roleId}/session-duration", h.withAppAPIProject(h.UpdateSessionDurationHandler))
	mux.HandleFunc("GET /app-api/auth/roles/{roleId}/verify-org-context", h.withAppAPIProject(h.VerifyOrgContextHandler))

	// Custom fields
	mux.HandleFunc("GET /app-api/auth/fields/available-tables", h.withAppAPIProject(h.GetAvailableTablesHandler))
	mux.HandleFunc("GET /app-api/auth/fields", h.withAppAPIProject(h.ListCustomFieldsHandler))
	mux.HandleFunc("GET /app-api/auth/fields/{fieldId}", h.withAppAPIProject(h.GetCustomFieldHandler))
	mux.HandleFunc("POST /app-api/auth/fields", h.withAppAPIProject(h.CreateCustomFieldHandler))
	mux.HandleFunc("PUT /app-api/auth/fields/{fieldId}", h.withAppAPIProject(h.UpdateCustomFieldHandler))
	mux.HandleFunc("DELETE /app-api/auth/fields/{fieldId}", h.withAppAPIProject(h.DeleteCustomFieldHandler))
	mux.HandleFunc("POST /app-api/auth/fields/{fieldId}/apply", h.withAppAPIProject(h.ApplyCustomFieldHandler))

	// Settings
	mux.HandleFunc("GET /app-api/auth/settings/email-providers", h.withAppAPIProject(h.GetEmailProvidersHandler))
	mux.HandleFunc("GET /app-api/auth/settings/sms-providers", h.withAppAPIProject(h.GetSmsProvidersHandler))
	mux.HandleFunc("GET /app-api/auth/settings/session-durations", h.withAppAPIProject(h.GetAllSessionDurationsHandler))
	mux.HandleFunc("GET /app-api/auth/settings/session-config/{roleId}", h.withAppAPIProject(h.GetSessionConfigHandler))
	mux.HandleFunc("GET /app-api/auth/settings", h.withAppAPIProject(h.GetAuthSettingsHandler))
	mux.HandleFunc("PUT /app-api/auth/settings", h.withAppAPIProject(h.UpdateAuthSettingsHandler))
	mux.HandleFunc("POST /app-api/auth/settings/send-verification", h.withAppAPIProject(h.SendVerificationHandler))
	mux.HandleFunc("POST /app-api/auth/settings/send-reset", h.withAppAPIProject(h.SendPasswordResetHandler))
	mux.HandleFunc("POST /app-api/auth/settings/verify-otp", h.withAppAPIProject(h.VerifyOTPSettingsHandler))
	mux.HandleFunc("POST /app-api/auth/settings/test-email-provider", h.withAppAPIProject(h.TestEmailProviderHandler))
	mux.HandleFunc("POST /app-api/auth/settings/test-sms-provider", h.withAppAPIProject(h.TestSmsProviderHandler))
}

// RegisterProtectedRoutes registers JWT + project access routes.
func (h *Handler) RegisterProtectedRoutes(mux *http.ServeMux) {
	// App auth (requires auth)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/change-password-request", h.ChangePasswordRequest)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify-password-change-otp", h.VerifyPasswordChangeOTP)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/request-account-deletion", h.RequestAccountDeletion)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/verify-account-deletion-otp", h.VerifyAccountDeletionOTP)
	mux.HandleFunc("POST /api/auth/{projectId}/auth/cancel-account-deletion", h.CancelAccountDeletion)

	// Users
	mux.HandleFunc("GET /api/auth/{projectId}/users", h.ListUsers)
	mux.HandleFunc("GET /api/auth/{projectId}/users/{userId}", h.GetUserHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/users/{userId}/password", h.GetUserPasswordHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/{userId}/password", h.SetUserPasswordHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/{userId}/password/verify", h.VerifyUserPasswordHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users", h.CreateUserHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/users/{userId}", h.UpdateUserHandler)
	mux.HandleFunc("DELETE /api/auth/{projectId}/users/{userId}", h.DeleteUserHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/users/{userId}/otp-status", h.GetUserOTPStatusHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/{userId}/resend-otp", h.ResendOTPHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/{userId}/manual-verify", h.ManuallyVerifyHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/{userId}/roles", h.AssignRoleHandler)
	mux.HandleFunc("DELETE /api/auth/{projectId}/users/{userId}/roles/{roleId}", h.RemoveRoleHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/export", h.ExportUsersHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/users/import", h.ImportUsersHandler)

	// Roles
	mux.HandleFunc("GET /api/auth/{projectId}/roles/{roleId}/users", h.GetUsersByRole)
	mux.HandleFunc("GET /api/auth/{projectId}/roles", h.ListRolesHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/roles/{roleId}", h.GetRoleHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/roles", h.CreateRoleHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/roles/{roleId}", h.UpdateRoleHandler)
	mux.HandleFunc("DELETE /api/auth/{projectId}/roles/{roleId}", h.DeleteRoleHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/roles/{roleId}/permissions", h.GetRolePermissionsHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/roles/{roleId}/permissions", h.UpdateRolePermissionsHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/roles/{roleId}/session-duration", h.UpdateSessionDurationHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/roles/{roleId}/verify-org-context", h.VerifyOrgContextHandler)

	// Custom Fields
	mux.HandleFunc("GET /api/auth/{projectId}/fields/available-tables", h.GetAvailableTablesHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/fields", h.ListCustomFieldsHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/fields/{fieldId}", h.GetCustomFieldHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/fields", h.CreateCustomFieldHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/fields/{fieldId}", h.UpdateCustomFieldHandler)
	mux.HandleFunc("DELETE /api/auth/{projectId}/fields/{fieldId}", h.DeleteCustomFieldHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/fields/{fieldId}/apply", h.ApplyCustomFieldHandler)

	// Settings
	mux.HandleFunc("GET /api/auth/{projectId}/settings/email-providers", h.GetEmailProvidersHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/settings/sms-providers", h.GetSmsProvidersHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/settings/session-durations", h.GetAllSessionDurationsHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/settings/session-config/{roleId}", h.GetSessionConfigHandler)
	mux.HandleFunc("GET /api/auth/{projectId}/settings", h.GetAuthSettingsHandler)
	mux.HandleFunc("PUT /api/auth/{projectId}/settings", h.UpdateAuthSettingsHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/settings/send-verification", h.SendVerificationHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/settings/send-reset", h.SendPasswordResetHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/settings/verify-otp", h.VerifyOTPSettingsHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/settings/test-email-provider", h.TestEmailProviderHandler)
	mux.HandleFunc("POST /api/auth/{projectId}/settings/test-sms-provider", h.TestSmsProviderHandler)
}

func parseProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		httputil.WriteError(w, 400, "Project ID is required")
		return 0, false
	}
	return id, true
}

func parsePathInt(r *http.Request, name string) (int, bool) {
	v, err := strconv.Atoi(r.PathValue(name))
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if len(auth) > 7 && auth[:7] == "Bearer " {
		return auth[7:]
	}
	return ""
}

func (h *Handler) withAppAPIProject(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authCtx := auth.GetAuthContext(r)
		if authCtx == nil || authCtx.ProjectID <= 0 {
			httputil.WriteError(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		r.SetPathValue("projectId", strconv.Itoa(authCtx.ProjectID))
		next(w, r)
	}
}
