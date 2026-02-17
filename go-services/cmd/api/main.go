package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/database"
	"github.com/skaftin/go-services/internal/handlers"
	"github.com/skaftin/go-services/internal/middleware"
)

func main() {
	// Structured logging
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()

	// Connect to PostgreSQL
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.Database)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to PostgreSQL")

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(pool)

	// Set up routes
	mux := http.NewServeMux()

	// Public routes (no auth required)
	mux.HandleFunc("GET /api/v2/health", healthHandler.Health)

	// Authenticated routes
	authMux := http.NewServeMux()
	// Future endpoints will be registered here, for example:
	// authMux.HandleFunc("GET /api/v2/data/{table}", dataHandler.Query)
	// authMux.HandleFunc("POST /api/v2/data/{table}", dataHandler.Insert)

	// Wrap authenticated routes with auth middleware
	authHandler := middleware.Auth(pool)(authMux)
	mux.Handle("/api/v2/", authHandler)

	// Apply global middleware stack
	corsHandler := middleware.NewCORS()
	handler := corsHandler.Handler(middleware.Logging(mux))

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("Go microservice starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server stopped")
}
