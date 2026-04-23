package startup

import (
	"context"
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
		full := filepath.Join(dir, name)
		sqlBytes, err := os.ReadFile(full)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

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
