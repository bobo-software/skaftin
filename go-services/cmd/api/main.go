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
	"github.com/skaftin/go-services/internal/handlers"
	"github.com/skaftin/go-services/internal/middleware"
	"github.com/skaftin/go-services/internal/noderunner"
	"github.com/skaftin/go-services/internal/proxy"
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

	// ======================================================================
	// NODE.JS CHILD PROCESS (local dev only)
	// ======================================================================
	var nodeRunner *noderunner.Runner
	if cfg.AutoStartNode {
		// Extract the port from the Node backend URL for the health check
		nodePort := "4007"
		if parts := strings.Split(cfg.NodeBackendURL, ":"); len(parts) == 3 {
			nodePort = parts[2]
		}

		healthURL := cfg.NodeBackendURL + "/api/health"
		nodeRunner = noderunner.New(cfg.NodeCommand, cfg.NodeWorkDir, nodePort, healthURL)

		startCtx, startCancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer startCancel()

		if err := nodeRunner.Start(startCtx); err != nil {
			slog.Error("failed to start Node.js backend", "error", err)
			os.Exit(1)
		}
	} else {
		slog.Info("AUTO_START_NODE=false, skipping Node.js child process")
	}

	// ======================================================================
	// JWKS + REVERSE PROXY
	// ======================================================================
	jwks := middleware.NewJWKSProvider(cfg.SuperTokensCoreURL)
	slog.Info("JWKS provider initialized", "supertokensCoreURL", cfg.SuperTokensCoreURL)

	nodeProxy, err := proxy.NewReverseProxy(cfg.NodeBackendURL)
	if err != nil {
		slog.Error("failed to create reverse proxy", "error", err)
		os.Exit(1)
	}
	nodeHandler := proxy.WebSocketAwareHandler(nodeProxy, cfg.NodeBackendURL)
	slog.Info("reverse proxy initialized", "nodeBackendURL", cfg.NodeBackendURL)

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(pool)

	// ======================================================================
	// ROUTE SETUP
	// ======================================================================
	mux := http.NewServeMux()

	// --- Public routes (no auth required) ---
	mux.HandleFunc("GET /api/v2/health", healthHandler.Health)

	// --- Go-handled routes (API key / access token auth) ---
	v2Mux := http.NewServeMux()
	mux.Handle("/api/v2/", middleware.Auth(pool)(v2Mux))

	// --- Auth routes: pass through to Node.js with NO auth check ---
	mux.Handle("/auth/", nodeHandler)

	// --- Platform API routes: validate JWT, then proxy to Node.js ---
	mux.Handle("/api/", middleware.JWTAuth(jwks)(nodeHandler))

	// --- Client API routes: validate API key, then proxy to Node.js ---
	mux.Handle("/app-api/", middleware.Auth(pool)(nodeHandler))

	// --- Socket.IO: pass through to Node.js (handles its own auth) ---
	mux.Handle("/socket.io/", nodeHandler)

	// ======================================================================
	// GLOBAL MIDDLEWARE
	// ======================================================================
	corsHandler := middleware.NewCORS()
	handler := corsHandler.Handler(middleware.Logging(mux))

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("Go gateway starting",
			"port", cfg.Port,
			"nodeBackend", cfg.NodeBackendURL,
			"supertokensCore", cfg.SuperTokensCoreURL,
			"autoStartNode", cfg.AutoStartNode,
		)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down gracefully...")

	// Shutdown Go HTTP server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	// Stop Node.js child process if we started it
	if nodeRunner != nil {
		nodeRunner.Stop()
	}

	slog.Info("server stopped")
}
