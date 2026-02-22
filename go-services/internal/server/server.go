package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/gateway"
	"github.com/skaftin/go-services/internal/middleware"
)

// Server wraps the HTTP server and its dependencies.
type Server struct {
	httpServer *http.Server
	cfg        *config.Config
	pool       *pgxpool.Pool
	cleanup    func()
}

// New creates a configured Server ready to start.
func New(cfg *config.Config, pool *pgxpool.Pool) (*Server, error) {
	mux := http.NewServeMux()

	cleanup, err := RegisterRoutes(mux, cfg, pool)
	if err != nil {
		return nil, err
	}

	corsHandler := gateway.NewCORS()
	handler := corsHandler.Handler(middleware.Logging(mux))

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return &Server{
		httpServer: httpServer,
		cfg:        cfg,
		pool:       pool,
		cleanup:    cleanup,
	}, nil
}

// Start begins listening for HTTP requests. It blocks until the server
// encounters an error or is shut down.
func (s *Server) Start() error {
	slog.Info("Go gateway starting",
		"port", s.cfg.Port,
		"nodeBackend", s.cfg.NodeBackendURL,
		"supertokensCore", s.cfg.SuperTokensCoreURL,
		"autoStartNode", s.cfg.AutoStartNode,
	)
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the HTTP server and background services.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.cleanup != nil {
		s.cleanup()
	}
	return s.httpServer.Shutdown(ctx)
}
