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
//
// Order: 0038 public; 0039 supertokens DDL; 0041 default app/tenant rows; 0037/0034/0036; 0040 workflows; 0042 sms providers; 0043 google sign-in settings.
var startupMigrations = []string{
	"0038_ensure_public_schema.sql",
	"0039_supertokens_schema_baseline.sql",
	"0041_supertokens_public_app_seed.sql",
	"0037_platform_core_public_baseline.sql",
	"0034_public_system_tables_baseline.sql",
	"0036_bucket_access_policy_idempotent.sql",
	"0040_public_workflows_and_backup_baseline.sql",
	"0042_public_sms_providers_baseline.sql",
	"0043_google_sign_in_settings.sql",
	"0044_apple_sign_in_settings.sql",
}

// RunMigrations executes the startup allowlist against dir.
//
// Skipped entirely when SKIP_STARTUP_MIGRATIONS=1 (SQL is not applied). Callers should still
// run ValidatePlatformSchema unless SKIP_STARTUP_SCHEMA_CHECK=1 (break-glass only).
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

// ResolveMigrationsDir returns the first existing migrations directory from a
// list of common runtime locations. It prefers go-services/migrations.
func ResolveMigrationsDir(appRootDir string) string {
	candidates := make([]string, 0, 8)
	if appRootDir != "" {
		candidates = append(candidates,
			filepath.Join(appRootDir, "go-services", "migrations"),
			filepath.Join(appRootDir, "migrations"),
		)
	}
	candidates = append(candidates,
		filepath.Join("go-services", "migrations"),
		"migrations",
		filepath.Join("..", "go-services", "migrations"),
		filepath.Join("..", "migrations"),
	)

	seen := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		clean := filepath.Clean(candidate)
		if _, ok := seen[clean]; ok {
			continue
		}
		seen[clean] = struct{}{}
		if info, err := os.Stat(clean); err == nil && info.IsDir() {
			return clean
		}
	}

	// Fallback to expected modern location, even if it doesn't exist yet.
	return filepath.Join("go-services", "migrations")
}

func readMigrationWithFallback(name, configuredDir string) ([]byte, string, error) {
	// Primary source: startup-owned embedded SQL files.
	if b, err := readStartupEmbedded(name); err == nil {
		return b, "embedded://internal/startup/sql/" + name, nil
	}

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
	uniqueCandidates := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		clean := filepath.Clean(candidate)
		if _, ok := seen[clean]; ok {
			continue
		}
		seen[clean] = struct{}{}
		uniqueCandidates = append(uniqueCandidates, clean)

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

	logMigrationLookupDebug(name, configuredDir, uniqueCandidates)
	return nil, "", fmt.Errorf("not found in candidate paths")
}

func logMigrationLookupDebug(name, configuredDir string, candidateFiles []string) {
	var cwd string
	if wd, err := os.Getwd(); err == nil {
		cwd = wd
	}

	var exePath string
	if exe, err := os.Executable(); err == nil {
		exePath = exe
	}

	// Build a compact "ls -a"-style snapshot for relevant directories.
	dirsSeen := map[string]struct{}{}
	dirsToInspect := make([]string, 0, len(candidateFiles)+3)
	addDir := func(dir string) {
		if dir == "" {
			return
		}
		clean := filepath.Clean(dir)
		if _, ok := dirsSeen[clean]; ok {
			return
		}
		dirsSeen[clean] = struct{}{}
		dirsToInspect = append(dirsToInspect, clean)
	}

	addDir(configuredDir)
	addDir("migrations")
	addDir("go-services/migrations")
	for _, f := range candidateFiles {
		addDir(filepath.Dir(f))
	}

	dirSnapshots := make([]string, 0, len(dirsToInspect))
	for _, dir := range dirsToInspect {
		entries, err := os.ReadDir(dir)
		if err != nil {
			dirSnapshots = append(dirSnapshots, fmt.Sprintf("%s (error: %v)", dir, err))
			continue
		}
		names := make([]string, 0, len(entries)+2)
		names = append(names, ".", "..")
		for i, e := range entries {
			// Keep logs readable if directory is very large.
			if i >= 50 {
				names = append(names, fmt.Sprintf("... (%d more)", len(entries)-50))
				break
			}
			name := e.Name()
			if e.IsDir() {
				name += "/"
			}
			names = append(names, name)
		}
		dirSnapshots = append(dirSnapshots, fmt.Sprintf("%s: %s", dir, strings.Join(names, ", ")))
	}

	slog.Error("startup migration file lookup failed",
		"file", name,
		"configuredDir", configuredDir,
		"cwd", cwd,
		"executable", exePath,
		"candidateFiles", candidateFiles,
		"dirSnapshots", dirSnapshots,
	)
}
