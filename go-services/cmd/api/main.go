package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/database"
	"github.com/skaftin/go-services/internal/gateway"
	"github.com/skaftin/go-services/internal/server"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.Database)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to PostgreSQL")

	// Node.js child process (local dev only)
	var nodeRunner *gateway.NodeRunner
	if cfg.AutoStartNode {
		nodePort := "4007"
		if parts := strings.Split(cfg.NodeBackendURL, ":"); len(parts) == 3 {
			nodePort = parts[2]
		}

		// Probe Node root for readiness so Node-specific /api mounts can be removed safely.
		healthURL := cfg.NodeBackendURL + "/"
		nodeRunner = gateway.NewNodeRunner(cfg.NodeCommand, cfg.NodeWorkDir, nodePort, healthURL)

		startCtx, startCancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer startCancel()

		if err := nodeRunner.Start(startCtx); err != nil {
			slog.Error("failed to start Node.js backend", "error", err)
			os.Exit(1)
		}
	} else {
		slog.Info("AUTO_START_NODE=false, skipping Node.js child process")
	}

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

	if nodeRunner != nil {
		nodeRunner.Stop()
	}

	slog.Info("server stopped")
}
