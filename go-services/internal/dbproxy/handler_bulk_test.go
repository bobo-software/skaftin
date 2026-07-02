package dbproxy

import (
	"reflect"
	"testing"
)

func TestBuildWhereClauseSortsKeys(t *testing.T) {
	where := map[string]any{
		"status": "active",
		"id":     42,
	}

	clause, args, nextIdx := buildWhereClause(where, 3)

	if clause != `"id" = $3 AND "status" = $4` {
		t.Fatalf("clause = %q", clause)
	}
	if nextIdx != 5 {
		t.Fatalf("nextIdx = %d, want 5", nextIdx)
	}
	if !reflect.DeepEqual(args, []any{42, "active"}) {
		t.Fatalf("args = %#v", args)
	}
}

func TestBuildBulkUpsertQueryUsesDeterministicOrder(t *testing.T) {
	query, args, err := buildBulkUpsertQuery("customers", map[string]any{
		"name": "Ada",
		"id":   7,
	}, []string{"id"})
	if err != nil {
		t.Fatalf("buildBulkUpsertQuery returned error: %v", err)
	}

	wantQuery := `INSERT INTO "customers" ("id", "name") VALUES ($1, $2) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name" RETURNING *, (xmax = 0) AS "__skaftin_inserted"`
	if query != wantQuery {
		t.Fatalf("query = %q", query)
	}
	if !reflect.DeepEqual(args, []any{7, "Ada"}) {
		t.Fatalf("args = %#v", args)
	}
}

func TestValidateConflictColumnsRequiresPrimaryKeys(t *testing.T) {
	schema := []TableColumn{
		{ColumnName: "id", IsPrimaryKey: true},
		{ColumnName: "external_id", IsPrimaryKey: true},
		{ColumnName: "name"},
	}

	if !validateConflictColumns(schema, []string{"id"}) {
		t.Fatalf("expected id to be accepted")
	}
	if !validateConflictColumns(schema, []string{"id", "external_id"}) {
		t.Fatalf("expected composite primary key subset to be accepted")
	}
	if validateConflictColumns(schema, []string{"name"}) {
		t.Fatalf("did not expect non-primary-key column to be accepted")
	}
	if validateConflictColumns(schema, []string{"id", "missing"}) {
		t.Fatalf("did not expect missing column to be accepted")
	}
}
