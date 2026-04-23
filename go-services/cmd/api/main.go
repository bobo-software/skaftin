package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/database"
	"github.com/skaftin/go-services/internal/server"
	"github.com/skaftin/go-services/internal/startup"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()

	poolCtx, poolCancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := database.NewPool(poolCtx, cfg.Database)
	poolCancel()
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	migrationsDir := filepath.Join(cfg.AppRootDir, "migrations")
	migCtx, migCancel := context.WithTimeout(context.Background(), 120*time.Second)
	migErr := startup.RunMigrations(migCtx, pool, migrationsDir)
	migCancel()
	if migErr != nil {
		slog.Error("startup migrations failed", "error", migErr)
		os.Exit(1)
	}

	depCtx, depCancel := context.WithTimeout(context.Background(), 15*time.Second)
	startup.LogDependencyStatus(depCtx, cfg, pool)
	depCancel()

	srv, err := server.New(cfg, pool)
	if err != nil {
		slog.Error("failed to create server", "error", err)
		os.Exit(1)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server stopped")
}
