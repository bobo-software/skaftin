package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/database"
	mcpserver "github.com/skaftin/go-services/internal/mcp"
	"github.com/skaftin/go-services/internal/startup"
)

func main() {
	// MCP servers MUST NOT write anything to stdout except JSON-RPC messages.
	// All logging goes to stderr.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
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

	migrationsDir := startup.ResolveMigrationsDir(cfg.AppRootDir)
	migCtx, migCancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer migCancel()
	if err := startup.RunMigrations(migCtx, pool, migrationsDir); err != nil {
		slog.Error("startup migrations failed; refusing to start MCP server", "error", err)
		os.Exit(1)
	}

	schemaCtx, schemaCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer schemaCancel()
	if err := startup.ValidatePlatformSchema(schemaCtx, pool); err != nil {
		slog.Error("database schema validation failed; refusing to start MCP server", "error", err)
		os.Exit(1)
	}

	srv := mcpserver.New(pool)

	if err := srv.Run(context.Background()); err != nil {
		slog.Error("mcp server error", "error", err)
		os.Exit(1)
	}
}
