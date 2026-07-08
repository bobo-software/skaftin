package startup

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// requiredPublicPlatformTables lists public tables that must exist after the startup
// migration allowlist has been applied successfully.
var requiredPublicPlatformTables = []string{
	"skaftin_system_organizations",
	"skaftin_system_organization_members",
	"skaftin_system_projects",
	"skaftin_system_auth_settings",
	"skaftin_system_api_credentials",
	"skaftin_system_project_buckets",
	"skaftin_system_email_providers",
	"skaftin_system_email_templates",
	"skaftin_system_sms_templates",
	"skaftin_system_project_invitations",
	"skaftin_system_project_members",
	"skaftin_system_api_metrics",
	"skaftin_system_storage_metrics",
	"skaftin_system_workflows",
	"skaftin_system_backup_schedules",
	"sms_providers",
	"skaftin_system_expo_push_settings",
}

// requiredSuperTokensTables lists supertokens schema tables that must exist after startup migrations.
var requiredSuperTokensTables = []string{
	"apps",
	"tenants",
	"session_info",
}

// RequiredPublicPlatformTables returns a copy of the table names checked by ValidatePlatformSchema.
func RequiredPublicPlatformTables() []string {
	out := make([]string, len(requiredPublicPlatformTables))
	copy(out, requiredPublicPlatformTables)
	return out
}

// RequiredSuperTokensTables returns supertokens table names checked by ValidatePlatformSchema.
func RequiredSuperTokensTables() []string {
	out := make([]string, len(requiredSuperTokensTables))
	copy(out, requiredSuperTokensTables)
	return out
}

// ValidatePlatformSchema returns an error if any required public platform table is missing,
// if skaftin_system_project_buckets lacks access_policy (required by projects store), or if
// required supertokens tables (apps, tenants, session_info) are missing.
//
// Skipped when SKIP_STARTUP_SCHEMA_CHECK=1 (break-glass; API may still fail at runtime).
func ValidatePlatformSchema(ctx context.Context, pool *pgxpool.Pool) error {
	if strings.TrimSpace(os.Getenv("SKIP_STARTUP_SCHEMA_CHECK")) == "1" {
		return nil
	}

	var missing []string
	for _, name := range requiredPublicPlatformTables {
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = $1
			)`, name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("schema check for table %q: %w", name, err)
		}
		if !exists {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required public tables: %s", strings.Join(missing, ", "))
	}

	var hasAccessPolicy bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'skaftin_system_project_buckets'
			  AND column_name = 'access_policy'
		)`).Scan(&hasAccessPolicy)
	if err != nil {
		return fmt.Errorf("schema check for column skaftin_system_project_buckets.access_policy: %w", err)
	}
	if !hasAccessPolicy {
		return fmt.Errorf("missing required column: public.skaftin_system_project_buckets.access_policy")
	}

	var missingST []string
	for _, name := range requiredSuperTokensTables {
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'supertokens' AND table_name = $1
			)`, name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("schema check for supertokens table %q: %w", name, err)
		}
		if !exists {
			missingST = append(missingST, "supertokens."+name)
		}
	}
	if len(missingST) > 0 {
		return fmt.Errorf("missing required supertokens tables: %s", strings.Join(missingST, ", "))
	}

	return nil
}
