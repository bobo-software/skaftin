package startup

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/config"
	"github.com/skaftin/go-services/internal/storage"
)

// LogDependencyStatus pings PostgreSQL, SuperTokens /hello, and MinIO (bucket existence).
// Uses emoji in message strings for quick visual scanning in log aggregators.
func LogDependencyStatus(ctx context.Context, cfg *config.Config, pool *pgxpool.Pool) {
	if err := pool.Ping(ctx); err != nil {
		slog.Info("dependencies: PostgreSQL ❌ — "+err.Error(), "component", "postgres")
	} else {
		slog.Info("dependencies: PostgreSQL ✅", "component", "postgres")
	}

	stURL := strings.TrimRight(cfg.SuperTokensCoreURL, "/")
	stHello := stURL + "/hello"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, stHello, nil)
	if err != nil {
		slog.Info("dependencies: SuperTokens ❌ — "+err.Error(), "component", "supertokens", "url", stHello)
	} else {
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			slog.Info("dependencies: SuperTokens ❌ — "+err.Error(), "component", "supertokens", "url", stHello)
		} else {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				slog.Info("dependencies: SuperTokens ✅", "component", "supertokens", "url", stHello)
			} else {
				slog.Info(fmt.Sprintf("dependencies: SuperTokens ⚠️ — HTTP %d", resp.StatusCode), "component", "supertokens", "url", stHello)
			}
		}
	}

	s3, err := storage.NewS3Client(cfg.MinIO)
	if err != nil {
		slog.Info("dependencies: MinIO ❌ — "+err.Error(), "component", "minio", "endpoint", cfg.MinIO.Endpoint)
		return
	}
	bucket := cfg.MinioBucket
	exists, err := s3.BucketExists(ctx, bucket)
	if err != nil {
		slog.Info("dependencies: MinIO ❌ — "+err.Error(), "component", "minio", "endpoint", cfg.MinIO.Endpoint, "bucket", bucket)
		return
	}
	if exists {
		slog.Info("dependencies: MinIO ✅", "component", "minio", "endpoint", cfg.MinIO.Endpoint, "bucket", bucket)
	} else {
		slog.Info("dependencies: MinIO ⚠️ — bucket missing (API may fail when storage initializes)", "component", "minio", "endpoint", cfg.MinIO.Endpoint, "bucket", bucket)
	}
}
