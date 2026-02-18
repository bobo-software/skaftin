package dbproxy

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// --- Phase 6: Import / Export ---

func (h *Handler) ImportDatabaseDump(w http.ResponseWriter, r *http.Request) {
	pc, _ := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()

	var body struct {
		SQLContent   string `json:"sqlContent"`
		DropExisting bool   `json:"dropExisting"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SQLContent == "" {
		httputil.WriteError(w, http.StatusBadRequest, "SQL content is required")
		return
	}

	ctx := r.Context()
	successCount := 0
	errorCount := 0
	droppedCount := 0
	var errors []string

	pc.Exec(ctx, "BEGIN")

	if body.DropExisting {
		rows, _ := pc.Query(ctx, `
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
			  AND table_name NOT LIKE 'skaftin_system_%'
			ORDER BY table_name
		`)
		if rows != nil {
			var tables []string
			for rows.Next() {
				var t string
				rows.Scan(&t)
				tables = append(tables, t)
			}
			rows.Close()

			for _, t := range tables {
				if err := pc.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s" CASCADE`, t)); err != nil {
					errorCount++
					errors = append(errors, fmt.Sprintf("Failed to drop table %s: %s", t, err.Error()))
				} else {
					droppedCount++
				}
			}
		}
	}

	statements := splitSQLStatements(body.SQLContent)

	for i, stmt := range statements {
		sp := fmt.Sprintf("sp_%d", i)
		if err := pc.Exec(ctx, fmt.Sprintf("SAVEPOINT %s", sp)); err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Statement %d: Transaction error", i+1))
			continue
		}

		if err := pc.Exec(ctx, stmt); err != nil {
			pc.Exec(ctx, fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", sp))
			errorCount++
			truncated := stmt
			if len(truncated) > 100 {
				truncated = truncated[:100] + "..."
			}
			errors = append(errors, fmt.Sprintf("Statement %d: %s Error: %s", i+1, truncated, err.Error()))
		} else {
			pc.Exec(ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", sp))
			successCount++
		}
	}

	pc.Exec(ctx, "COMMIT")

	data := map[string]any{
		"successCount":     successCount,
		"errorCount":       errorCount,
		"droppedTablesCount": droppedCount,
	}
	if errorCount > 0 {
		limit := 10
		if len(errors) < limit {
			limit = len(errors)
		}
		data["errors"] = errors[:limit]
	}

	msg := "Database dump imported successfully"
	if errorCount > 0 {
		msg = "Database dump imported with warnings"
	}
	httputil.WriteSuccess(w, http.StatusOK, msg, data)
}

func (h *Handler) ExportDatabaseDump(w http.ResponseWriter, r *http.Request) {
	pc, pid := h.acquireConn(w, r)
	if pc == nil {
		return
	}
	defer pc.Release()
	_ = pid

	var body struct {
		Tables                    []string `json:"tables"`
		IncludeSystemTables       bool     `json:"includeSystemTables"`
		SchemaOnly                bool     `json:"schemaOnly"`
		SkipSystemTableForeignKeys bool    `json:"skipSystemTableForeignKeys"`
	}
	body.SkipSystemTableForeignKeys = true
	json.NewDecoder(r.Body).Decode(&body)

	ctx := r.Context()
	schema := pc.SchemaName

	var sql strings.Builder
	sql.WriteString(fmt.Sprintf("-- PostgreSQL database dump\n-- Exported from schema: %s\n-- Exported at: %s\n\n", schema, time.Now().UTC().Format(time.RFC3339)))

	tablesToExport := body.Tables
	if len(tablesToExport) == 0 {
		rows, _ := pc.Query(ctx, `
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'skaftin_system_%'
			ORDER BY table_name
		`, schema)
		if rows != nil {
			for rows.Next() {
				var t string
				rows.Scan(&t)
				tablesToExport = append(tablesToExport, t)
			}
			rows.Close()
		}
	}

	type fkInfo struct {
		tableName, constraintName, localCols, foreignTable, foreignCols string
	}
	var foreignKeys []fkInfo

	for _, tableName := range tablesToExport {
		// Column definitions
		colRows, err := pc.Query(ctx, `
			SELECT column_name, data_type, udt_name, character_maximum_length,
				numeric_precision, numeric_scale, is_nullable, column_default, ordinal_position
			FROM information_schema.columns
			WHERE table_schema = $1 AND table_name = $2
			ORDER BY ordinal_position
		`, schema, tableName)
		if err != nil {
			continue
		}

		type colInfo struct {
			name, dataType, udtName string
			charMaxLen, numPrec, numScale *int32
			isNullable, colDefault string
		}
		var cols []colInfo
		for colRows.Next() {
			var c colInfo
			var nullable, def *string
			colRows.Scan(&c.name, &c.dataType, &c.udtName, &c.charMaxLen, &c.numPrec, &c.numScale, &nullable, &def, new(int))
			if nullable != nil { c.isNullable = *nullable }
			if def != nil { c.colDefault = *def }
			cols = append(cols, c)
		}
		colRows.Close()
		if len(cols) == 0 {
			continue
		}

		// Primary keys
		pkRows, _ := pc.Query(ctx, `
			SELECT kcu.column_name FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
			WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
			ORDER BY kcu.ordinal_position
		`, schema, tableName)
		var pkCols []string
		if pkRows != nil {
			for pkRows.Next() {
				var c string
				pkRows.Scan(&c)
				pkCols = append(pkCols, c)
			}
			pkRows.Close()
		}

		sql.WriteString(fmt.Sprintf("\n-- Table: %s\nCREATE TABLE IF NOT EXISTS \"%s\" (\n", tableName, tableName))
		var colDefs []string
		for _, c := range cols {
			isSerial := strings.Contains(c.colDefault, "nextval(")
			def := fmt.Sprintf(`  "%s" `, c.name)
			if isSerial {
				switch c.dataType {
				case "bigint":
					def += "BIGSERIAL"
				case "smallint":
					def += "SMALLSERIAL"
				default:
					def += "SERIAL"
				}
			} else if c.dataType == "USER-DEFINED" {
				def += c.udtName
			} else {
				def += c.dataType
				if c.charMaxLen != nil && (c.dataType == "character varying" || c.dataType == "character") {
					def += fmt.Sprintf("(%d)", *c.charMaxLen)
				} else if c.numPrec != nil && (c.dataType == "numeric" || c.dataType == "decimal") {
					if c.numScale != nil {
						def += fmt.Sprintf("(%d,%d)", *c.numPrec, *c.numScale)
					} else {
						def += fmt.Sprintf("(%d)", *c.numPrec)
					}
				}
			}
			if c.isNullable == "NO" {
				def += " NOT NULL"
			}
			if c.colDefault != "" && !isSerial {
				def += " DEFAULT " + c.colDefault
			}
			colDefs = append(colDefs, def)
		}
		sql.WriteString(strings.Join(colDefs, ",\n"))
		if len(pkCols) > 0 {
			quoted := make([]string, len(pkCols))
			for i, c := range pkCols { quoted[i] = fmt.Sprintf(`"%s"`, c) }
			sql.WriteString(fmt.Sprintf(",\n  PRIMARY KEY (%s)", strings.Join(quoted, ", ")))
		}
		sql.WriteString("\n);\n\n")

		// Data
		if !body.SchemaOnly {
			dataRows, err := pc.Query(ctx, fmt.Sprintf(`SELECT * FROM "%s"."%s"`, schema, tableName))
			if err == nil {
				descs := dataRows.FieldDescriptions()
				for dataRows.Next() {
					vals, _ := dataRows.Values()
					colNames := make([]string, len(descs))
					valStrs := make([]string, len(vals))
					for i, fd := range descs {
						colNames[i] = fmt.Sprintf(`"%s"`, fd.Name)
						valStrs[i] = pgLiteral(vals[i])
					}
					sql.WriteString(fmt.Sprintf("INSERT INTO \"%s\" (%s) VALUES (%s);\n",
						tableName, strings.Join(colNames, ", "), strings.Join(valStrs, ", ")))
				}
				dataRows.Close()
				sql.WriteString("\n")
			}
		}

		// Foreign keys
		fkRows, _ := pc.Query(ctx, `
			SELECT DISTINCT tc.constraint_name,
				STRING_AGG(DISTINCT kcu.column_name, ', ') AS column_names,
				ccu.table_name AS foreign_table_name,
				STRING_AGG(DISTINCT ccu.column_name, ', ') AS foreign_column_names
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2
			GROUP BY tc.constraint_name, ccu.table_name
		`, schema, tableName)
		if fkRows != nil {
			for fkRows.Next() {
				var cn, localC, fTable, foreignC string
				fkRows.Scan(&cn, &localC, &fTable, &foreignC)
				if body.SkipSystemTableForeignKeys && strings.HasPrefix(fTable, "skaftin_system_") {
					continue
				}
				lc := quoteCSV(localC)
				fc := quoteCSV(foreignC)
				foreignKeys = append(foreignKeys, fkInfo{tableName, cn, lc, fTable, fc})
			}
			fkRows.Close()
		}
	}

	if len(foreignKeys) > 0 {
		sql.WriteString("\n-- Foreign Key Constraints\n\n")
		for _, fk := range foreignKeys {
			sql.WriteString(fmt.Sprintf("ALTER TABLE \"%s\" ADD CONSTRAINT \"%s\" FOREIGN KEY (%s) REFERENCES \"%s\" (%s);\n",
				fk.tableName, fk.constraintName, fk.localCols, fk.foreignTable, fk.foreignCols))
		}
	}

	content := sql.String()
	ts := time.Now().UTC().Format("2006-01-02T15-04-05")
	fileName := fmt.Sprintf("database-export-%s.sql", ts)

	w.Header().Set("Content-Type", "application/sql")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(content)))
	w.Write([]byte(content))
}

// splitSQLStatements splits SQL by semicolons, respecting quoted strings.
func splitSQLStatements(input string) []string {
	// Strip line comments outside quotes
	lines := strings.Split(input, "\n")
	var cleaned []string
	for _, line := range lines {
		inQ := false
		for i := 0; i < len(line)-1; i++ {
			if line[i] == '\'' {
				inQ = !inQ
			}
			if !inQ && line[i] == '-' && line[i+1] == '-' {
				line = line[:i]
				break
			}
		}
		cleaned = append(cleaned, line)
	}
	joined := strings.Join(cleaned, "\n")

	var stmts []string
	var current strings.Builder
	inQuote := false
	for _, ch := range joined {
		if ch == '\'' {
			inQuote = !inQuote
		}
		if ch == ';' && !inQuote {
			s := strings.TrimSpace(current.String())
			if s != "" {
				stmts = append(stmts, s)
			}
			current.Reset()
			continue
		}
		current.WriteRune(ch)
	}
	if s := strings.TrimSpace(current.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}

func pgLiteral(v any) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("'%s'", strings.ReplaceAll(val, "'", "''"))
	case bool:
		if val {
			return "TRUE"
		}
		return "FALSE"
	case time.Time:
		return fmt.Sprintf("'%s'", val.Format(time.RFC3339Nano))
	case map[string]any, []any:
		b, _ := json.Marshal(val)
		return fmt.Sprintf("'%s'", strings.ReplaceAll(string(b), "'", "''"))
	default:
		return fmt.Sprintf("%v", val)
	}
}

func quoteCSV(csv string) string {
	parts := strings.Split(csv, ",")
	quoted := make([]string, len(parts))
	for i, p := range parts {
		quoted[i] = fmt.Sprintf(`"%s"`, strings.TrimSpace(p))
	}
	return strings.Join(quoted, ", ")
}
