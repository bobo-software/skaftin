package startup

import (
	"slices"
	"testing"
)

func TestStartupMigrationsOrder(t *testing.T) {
	t.Helper()
	idx38 := slices.Index(startupMigrations, "0038_ensure_public_schema.sql")
	idx39 := slices.Index(startupMigrations, "0039_supertokens_schema_baseline.sql")
	idx41 := slices.Index(startupMigrations, "0041_supertokens_public_app_seed.sql")
	idx37 := slices.Index(startupMigrations, "0037_platform_core_public_baseline.sql")
	idx34 := slices.Index(startupMigrations, "0034_public_system_tables_baseline.sql")
	idx36 := slices.Index(startupMigrations, "0036_bucket_access_policy_idempotent.sql")
	idx40 := slices.Index(startupMigrations, "0040_public_workflows_and_backup_baseline.sql")
	if idx38 < 0 || idx39 < 0 || idx41 < 0 || idx37 < 0 || idx34 < 0 || idx36 < 0 || idx40 < 0 {
		t.Fatalf("expected all startup migration filenames present, got %#v", startupMigrations)
	}
	if idx38 >= idx39 {
		t.Fatalf("0038 must run before 0039: indices %d, %d", idx38, idx39)
	}
	if idx39 >= idx41 {
		t.Fatalf("0039 must run before 0041: indices %d, %d", idx39, idx41)
	}
	if idx41 >= idx37 {
		t.Fatalf("0041 must run before 0037: indices %d, %d", idx41, idx37)
	}
	if idx37 >= idx34 {
		t.Fatalf("0037 must run before 0034 (FK to projects): indices %d, %d", idx37, idx34)
	}
	if idx34 >= idx36 {
		t.Fatalf("0034 must run before 0036 (alters project_buckets): indices %d, %d", idx34, idx36)
	}
	if idx36 >= idx40 {
		t.Fatalf("0036 must run before 0040 (workflows reference projects): indices %d, %d", idx36, idx40)
	}
}

func TestRequiredPublicPlatformTablesIncludesCore(t *testing.T) {
	t.Helper()
	names := RequiredPublicPlatformTables()
	for _, required := range []string{
		"skaftin_system_organizations",
		"skaftin_system_organization_members",
		"skaftin_system_projects",
		"skaftin_system_auth_settings",
		"skaftin_system_project_buckets",
		"skaftin_system_workflows",
		"skaftin_system_backup_schedules",
	} {
		if !slices.Contains(names, required) {
			t.Fatalf("RequiredPublicPlatformTables missing %q: %#v", required, names)
		}
	}
}

func TestRequiredSuperTokensTablesIncludesCore(t *testing.T) {
	t.Helper()
	names := RequiredSuperTokensTables()
	for _, required := range []string{"apps", "tenants", "session_info"} {
		if !slices.Contains(names, required) {
			t.Fatalf("RequiredSuperTokensTables missing %q: %#v", required, names)
		}
	}
}
