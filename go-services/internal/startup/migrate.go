package startup

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/migrations"
)

// startupMigrations is an explicit ordered allowlist of SQL files safe to run on every API boot.
// Only add idempotent migrations (IF NOT EXISTS / guarded DO blocks). Never add RESET_DATABASE,
// legacy projects/api_credentials migrations, or one-off data fixes here.
var startupMigrations = []string{
	"0034_public_system_tables_baseline.sql",
	"0035_public_sms_providers_baseline.sql",
	"0021_add_payment_providers.sql",
	"0036_bucket_access_policy_idempotent.sql",
	"0029_add_request_logs_table.sql",
	"0033_add_database_metrics_table.sql",
	"0024_add_fnb_payments.sql",
	"0018_add_backup_type_and_retention.sql",
}

// RunMigrations executes the startup allowlist against dir. Skipped entirely when SKIP_STARTUP_MIGRATIONS=1.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	if strings.TrimSpace(os.Getenv("SKIP_STARTUP_MIGRATIONS")) == "1" {
		slog.Info("startup migrations skipped ⚙️", "env", "SKIP_STARTUP_MIGRATIONS=1")
		return nil
	}

	for _, name := range startupMigrations {
		if !migrations.ValidateMigrationFilename(name) {
			return fmt.Errorf("startup migration has invalid filename: %q", name)
		}

		sqlBytes, full, err := readMigrationWithFallback(name, dir)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		slog.Info("startup migration source", "file", name, "path", full)

		start := time.Now()
		_, err = pool.Exec(ctx, string(sqlBytes))
		duration := time.Since(start)
		if err != nil {
			slog.Error("startup migration failed ❌", "file", name, "error", err, "duration_ms", duration.Milliseconds())
			return fmt.Errorf("exec migration %s: %w", name, err)
		}
		slog.Info("startup migration ok ✅", "file", name, "duration_ms", duration.Milliseconds())
	}
	return nil
}

func readMigrationWithFallback(name, configuredDir string) ([]byte, string, error) {
	candidates := make([]string, 0, 8)
	if configuredDir != "" {
		candidates = append(candidates, filepath.Join(configuredDir, name))
	}

	// Common runtime locations when cwd differs between local/dev/prod.
	candidates = append(candidates,
		filepath.Join("migrations", name),
		filepath.Join("..", "migrations", name),
	)

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "migrations", name),
			filepath.Join(cwd, "..", "migrations", name),
		)
	}

	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "migrations", name),
			filepath.Join(exeDir, "..", "migrations", name),
		)
	}

	seen := make(map[string]struct{}, len(candidates))
	var lastErr error
	for _, candidate := range candidates {
		clean := filepath.Clean(candidate)
		if _, ok := seen[clean]; ok {
			continue
		}
		seen[clean] = struct{}{}

		b, err := os.ReadFile(clean)
		if err == nil {
			return b, clean, nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			lastErr = fmt.Errorf("open %s: %w", clean, err)
		}
	}

	if lastErr != nil {
		return nil, "", lastErr
	}
	return nil, "", fmt.Errorf("not found in candidate paths")
}
