package authmanagement

import "testing"

func TestPrepareImportStatementsFiltersControlStatements(t *testing.T) {
	sqlContent := `
-- header comment
BEGIN;
SET search_path TO some_schema, public;
INSERT INTO skaftin_system_users (id, email) VALUES (1, 'test@example.com');
SAVEPOINT test;
RELEASE SAVEPOINT test;
ROLLBACK TO SAVEPOINT test;
COMMIT;
`

	statements := prepareImportStatements(sqlContent)
	if len(statements) != 1 {
		t.Fatalf("expected one executable statement, got %d", len(statements))
	}
	if statements[0] != "INSERT INTO skaftin_system_users (id, email) VALUES (1, 'test@example.com')" {
		t.Fatalf("unexpected statement after filtering: %q", statements[0])
	}
}

func TestPrepareImportStatementsPreservesQuotedDoubleDash(t *testing.T) {
	sqlContent := `
INSERT INTO logs (message) VALUES ('hello -- world');
-- trailing comment
`

	statements := prepareImportStatements(sqlContent)
	if len(statements) != 1 {
		t.Fatalf("expected one statement, got %d", len(statements))
	}
	if statements[0] != "INSERT INTO logs (message) VALUES ('hello -- world')" {
		t.Fatalf("unexpected statement: %q", statements[0])
	}
}

func TestSplitSQLHandlesEscapedStrings(t *testing.T) {
	sqlContent := "INSERT INTO logs (body) VALUES (E'line1\\nline2');INSERT INTO users (name) VALUES ('O''Reilly');"

	statements := splitSQL(sqlContent)
	if len(statements) != 2 {
		t.Fatalf("expected two statements, got %d", len(statements))
	}
}

func TestRewriteUserRoleInsertStatementForLegacySchema(t *testing.T) {
	statement := "INSERT INTO skaftin_system_user_roles (app_user_id, role_id) VALUES (1, 2)"
	rewritten := rewriteUserRoleInsertStatement(statement, "user_id")

	if rewritten != "INSERT INTO skaftin_system_user_roles (user_id, role_id) VALUES (1, 2)" {
		t.Fatalf("expected app_user_id to be rewritten to user_id, got %q", rewritten)
	}
}

func TestRewriteUserRoleInsertStatementNoopForNonRoleInsert(t *testing.T) {
	statement := "INSERT INTO another_table (user_id) VALUES (1)"
	rewritten := rewriteUserRoleInsertStatement(statement, "app_user_id")

	if rewritten != statement {
		t.Fatalf("expected non-role insert statement to remain unchanged")
	}
}
