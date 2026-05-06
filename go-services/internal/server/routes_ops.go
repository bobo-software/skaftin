package server

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/appcron"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/backups"
	"github.com/skaftin/go-services/internal/communications"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/healthcron"
	"github.com/skaftin/go-services/internal/invitations"
	"github.com/skaftin/go-services/internal/maintenance"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/payments"
	"github.com/skaftin/go-services/internal/projects"
	"github.com/skaftin/go-services/internal/storage"
	"github.com/skaftin/go-services/internal/supertokens"
	"github.com/skaftin/go-services/internal/workflows"
)

func registerOperationalRoutes(
	mux *http.ServeMux,
	pool *pgxpool.Pool,
	cfg *config.Config,
	jwks *auth.JWKSProvider,
	requestLogger *middleware.RequestLogger,
	stClient *supertokens.Client,
	communicationsHandler *communications.Handler,
	paymentsHandler *payments.Handler,
	s3Client *storage.S3Client,
) (func(), error) {
	// Invitations: mixed auth (public, JWT-only, JWT+project)
	invitationsHandler := invitations.NewHandler(pool, communicationsHandler.Service(), cfg.FrontendURL)
	invitationsPublicMux := http.NewServeMux()
	invitationsHandler.RegisterPublicRoutes(invitationsPublicMux)
	mux.Handle("/api/invitations/code/", invitationsPublicMux)

	invitationsAuthMux := http.NewServeMux()
	invitationsHandler.RegisterAuthRoutes(invitationsAuthMux)
	mux.Handle("/api/invitations/accept/", auth.JWTAuth(jwks)(invitationsAuthMux))

	invitationsProjectMux := http.NewServeMux()
	invitationsHandler.RegisterProjectRoutes(invitationsProjectMux)
	mux.Handle("/api/invitations/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/invitations/")(invitationsProjectMux)))

	communicationsPublicMux := http.NewServeMux()
	communicationsHandler.RegisterPublicRoutes(communicationsPublicMux)
	mux.Handle("/api/communications/{projectId}/sms/webhook", communicationsPublicMux)

	communicationsProjectMux := http.NewServeMux()
	communicationsHandler.RegisterProjectRoutes(communicationsProjectMux)
	mux.Handle("/api/communications/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/communications/")(communicationsProjectMux)))

	communicationsAppMux := http.NewServeMux()
	communicationsHandler.RegisterAppAPIRoutes(communicationsAppMux)
	mux.Handle("/app-api/communications/", auth.APIKey(pool)(requestLogger.Middleware(communicationsAppMux)))

	// Payments webhook routes are public and handled by Go.
	paymentsWebhookMux := http.NewServeMux()
	paymentsHandler.RegisterWebhookRoutes(paymentsWebhookMux)
	mux.Handle("/api/payments/webhook/", paymentsWebhookMux)

	paymentsSessionMux := http.NewServeMux()
	paymentsHandler.RegisterSessionRoutes(paymentsSessionMux)
	mux.Handle("/api/payments/handle_fnb_payment", auth.JWTAuth(jwks)(paymentsSessionMux))

	paymentsProjectMux := http.NewServeMux()
	paymentsHandler.RegisterProjectRoutes(paymentsProjectMux)
	mux.Handle("/api/payments/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/payments/")(paymentsProjectMux)))

	paymentsAppMux := http.NewServeMux()
	paymentsHandler.RegisterAppAPIRoutes(paymentsAppMux)
	mux.Handle("/app-api/payments/", auth.APIKey(pool)(requestLogger.Middleware(paymentsAppMux)))

	// Backups: project-scoped routes (JWT + project access) + restore route (JWT only)
	projectsStore := projects.NewStore(pool)
	backupsHandler := backups.NewHandler(pool, s3Client, cfg.MinioBucket, projectsStore)

	backupsMux := http.NewServeMux()
	backupsHandler.RegisterRoutes(backupsMux)
	mux.Handle("/api/backups/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/backups/")(backupsMux)))

	backupsRestoreMux := http.NewServeMux()
	backupsHandler.RegisterRestoreRoute(backupsRestoreMux)
	mux.Handle("/api/backups/restore", auth.JWTAuth(jwks)(backupsRestoreMux))

	backupScheduler := backups.NewScheduler(backupsHandler.Service())
	backupsHandler.SetScheduler(backupScheduler)
	if err := backupScheduler.LoadAll(context.Background()); err != nil {
		slog.Error("failed to load backup schedules", "error", err)
	}

	// Workflows: project-scoped routes (JWT + project access)
	workflowsHandler := workflows.NewHandler(pool)
	workflowsMux := http.NewServeMux()
	workflowsHandler.RegisterRoutes(workflowsMux)
	mux.Handle("/api/workflows/", auth.JWTAuth(jwks)(auth.VerifyProjectAccessForPrefix(pool, "/api/workflows/")(workflowsMux)))

	workflowScheduler := workflows.NewScheduler(workflowsHandler.Service())
	workflowsHandler.SetScheduler(workflowScheduler)
	if err := workflowScheduler.LoadAll(context.Background()); err != nil {
		slog.Error("failed to load workflow schedules", "error", err)
	}

	maintenanceScheduler := maintenance.NewScheduler(pool, stClient, cfg.MinIO)
	if err := maintenanceScheduler.Start(); err != nil {
		return nil, err
	}

	appCronScheduler := appcron.NewScheduler(pool)
	appCronScheduler.Start()

	healthCron := healthcron.New()
	if err := healthCron.Start(); err != nil {
		appCronScheduler.Stop()
		maintenanceScheduler.Stop()
		workflowScheduler.Stop()
		backupScheduler.Stop()
		return nil, err
	}

	cleanup := func() {
		healthCron.Stop()
		appCronScheduler.Stop()
		backupScheduler.Stop()
		workflowScheduler.Stop()
		maintenanceScheduler.Stop()
	}
	return cleanup, nil
}
