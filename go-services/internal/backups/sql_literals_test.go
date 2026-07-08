package backups

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestPgLiteral_Time(t *testing.T) {
	t.Parallel()

	micros := int64(6*3600+3*60) * 1_000_000 // 06:03:00
	got := pgLiteral(pgtype.Time{Microseconds: micros, Valid: true})
	want := "'06:03:00.000000'"
	if got != want {
		t.Fatalf("pgLiteral(time) = %q, want %q", got, want)
	}
}

func TestPgLiteral_InvalidTime(t *testing.T) {
	t.Parallel()

	got := pgLiteral(pgtype.Time{Valid: false})
	if got != "NULL" {
		t.Fatalf("pgLiteral(invalid time) = %q, want NULL", got)
	}
}

func TestPgLiteral_NumericStillUnquoted(t *testing.T) {
	t.Parallel()

	n := pgtype.Numeric{}
	if err := n.Scan("123.45"); err != nil {
		t.Fatalf("scan numeric: %v", err)
	}
	got := pgLiteral(n)
	if got != "123.45" {
		t.Fatalf("pgLiteral(numeric) = %q, want 123.45", got)
	}
}

func TestQuoteBareTimeLiterals(t *testing.T) {
	t.Parallel()

	in := `INSERT INTO "s"."events" ("startTime", "endTime") VALUES (06:03:00.000000, 21:03:00.000000);`
	want := `INSERT INTO "s"."events" ("startTime", "endTime") VALUES ('06:03:00.000000', '21:03:00.000000');`
	got := quoteBareTimeLiterals(in)
	if got != want {
		t.Fatalf("quoteBareTimeLiterals() =\n%q\nwant\n%q", got, want)
	}
}

func TestQuoteBareTimeLiterals_SkipsQuotedStrings(t *testing.T) {
	t.Parallel()

	in := `INSERT INTO "s"."events" ("note") VALUES ('meet at 06:03:00.000000');`
	got := quoteBareTimeLiterals(in)
	if got != in {
		t.Fatalf("quoteBareTimeLiterals() modified quoted string:\n%q", got)
	}
}

func TestRemapFullBackupSQL_AllProjectSchemas(t *testing.T) {
	t.Parallel()

	sql := `ALTER TABLE "project_taxi_admin_local_1783490841404"."app_user_auth_providers" ADD CONSTRAINT "app_user_auth_providers_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "project_dira_1779195342728"."skaftin_system_users" ("id");`
	manifest := fullBackupManifest{SchemaName: "project_taxi_admin_local_1783490841404", ProjectID: 2}
	got := remapFullBackupSQL(sql, manifest, "project_target_123", 1)
	if strings.Contains(got, "project_dira_") || strings.Contains(got, "project_taxi_admin") {
		t.Fatalf("remapFullBackupSQL() left source schema names:\n%q", got)
	}
	if !strings.Contains(got, `"project_target_123"`) {
		t.Fatalf("remapFullBackupSQL() did not rewrite to target schema:\n%q", got)
	}
}

func TestConstraintDropBeforeAdd(t *testing.T) {
	t.Parallel()

	in := `ALTER TABLE "s"."t" ADD CONSTRAINT "t_fkey" FOREIGN KEY ("a") REFERENCES "s"."u" ("id");`
	drop, add, ok := constraintDropBeforeAdd(in)
	if !ok {
		t.Fatal("expected ok")
	}
	wantDrop := `ALTER TABLE "s"."t" DROP CONSTRAINT IF EXISTS "t_fkey"`
	if drop != wantDrop {
		t.Fatalf("drop SQL = %q, want %q", drop, wantDrop)
	}
	wantAdd := strings.TrimSuffix(in, ";")
	if add != wantAdd {
		t.Fatalf("add SQL = %q, want %q", add, wantAdd)
	}
}

func TestPartitionSQLStatements_DeferredFK(t *testing.T) {
	t.Parallel()

	sql := strings.Join([]string{
		`CREATE TABLE "s"."children_details" ("id" SERIAL PRIMARY KEY, "parent_id" INTEGER);`,
		`INSERT INTO "s"."children_details" ("id", "parent_id") VALUES (1, 9);`,
		`ALTER TABLE "s"."children_details" ADD CONSTRAINT "fk_children" FOREIGN KEY ("parent_id") REFERENCES "s"."skaftin_system_users" ("id");`,
	}, "\n")
	main, fk := partitionSQLStatements(sql)
	if len(main) != 2 {
		t.Fatalf("main statements = %d, want 2", len(main))
	}
	if len(fk) != 1 {
		t.Fatalf("deferred FK statements = %d, want 1", len(fk))
	}
	if !strings.Contains(fk[0], "ADD CONSTRAINT") {
		t.Fatalf("deferred statement = %q", fk[0])
	}
}

func TestConstraintDropBeforeAdd_SkipsInserts(t *testing.T) {
	t.Parallel()

	in := `INSERT INTO "s"."t" ("id") VALUES (1);`
	_, _, ok := constraintDropBeforeAdd(in)
	if ok {
		t.Fatal("constraintDropBeforeAdd() matched non-constraint statement")
	}
}
