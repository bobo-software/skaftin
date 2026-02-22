package authmanagement

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/pkg/httputil"
	"github.com/skaftin/go-services/internal/supertokens"
)

type Handler struct {
	service *Service
}

func NewHandler(pool *pgxpool.Pool, st *supertokens.Client, comms *communications.Service) *Handler {
	return &Handler{service: NewService(pool, st, comms)}
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
