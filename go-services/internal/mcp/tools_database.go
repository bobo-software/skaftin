package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
)

func registerDatabaseTools(srv toolRegistrar, pool *pgxpool.Pool, dbSvc *dbproxy.Service) {
	reg := &dbTools{pool: pool, svc: dbSvc}

	srv.AddTool(makeTool("list_tables", "List all tables in a project schema", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, nil), reg.listTables)

	srv.AddTool(makeTool("get_table_schema", "Get the schema (column definitions) for a specific table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"tableName"}), reg.getTableSchema)

	srv.AddTool(makeTool("execute_sql", "Run SQL queries safely", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"query":      {Type: "string", Desc: "SQL query to execute"},
		"parameters": {Type: "array", Desc: "Query parameters for prepared statements"},
		"readonly":   {Type: "boolean", Desc: "If true, only SELECT queries are allowed (default: true)"},
	}, []string{"query"}), reg.executeSql)

	srv.AddTool(makeTool("select_data", "Select data from a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"columns":   {Type: "array", Desc: "Columns to select (optional)"},
		"where":     {Type: "object", Desc: "WHERE condition as key-value pairs (optional)"},
		"limit":     {Type: "number", Desc: "Maximum number of rows to return (optional)"},
		"offset":    {Type: "number", Desc: "Number of rows to skip (optional)"},
	}, []string{"tableName"}), reg.selectData)

	srv.AddTool(makeTool("insert_data", "Insert data into a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"data":      {Type: "object", Desc: "Data to insert as key-value pairs"},
	}, []string{"tableName", "data"}), reg.insertData)

	srv.AddTool(makeTool("bulk_insert_data", "Insert multiple rows into a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"dataArray": {Type: "array", Desc: "Array of data objects to insert"},
	}, []string{"tableName", "dataArray"}), reg.bulkInsertData)

	srv.AddTool(makeTool("update_data", "Update data in a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"data":      {Type: "object", Desc: "Data to update as key-value pairs"},
		"where":     {Type: "object", Desc: "WHERE condition as key-value pairs"},
	}, []string{"tableName", "data", "where"}), reg.updateData)

	srv.AddTool(makeTool("delete_data", "Delete data from a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"where":     {Type: "object", Desc: "WHERE condition as key-value pairs"},
	}, []string{"tableName", "where"}), reg.deleteData)

	srv.AddTool(makeTool("create_table", "Create a new database table with specified columns", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table to create"},
		"columns":   {Type: "array", Desc: "Array of column definitions (objects with name, type, nullable, primaryKey, defaultValue)"},
	}, []string{"tableName", "columns"}), reg.createTable)

	srv.AddTool(makeTool("drop_table", "Drop a table from the database", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table to drop"},
	}, []string{"tableName"}), reg.dropTable)

	srv.AddTool(makeTool("create_foreign_key", "Create a foreign key constraint on a table", map[string]prop{
		"projectId":        {Type: "string", Desc: "Project ID"},
		"tableName":        {Type: "string", Desc: "Name of the table"},
		"columnName":       {Type: "string", Desc: "Name of the column"},
		"referencedTable":  {Type: "string", Desc: "Referenced table name"},
		"referencedColumn": {Type: "string", Desc: "Referenced column name"},
		"onDelete":         {Type: "string", Desc: "ON DELETE action (default: RESTRICT)"},
		"onUpdate":         {Type: "string", Desc: "ON UPDATE action (default: RESTRICT)"},
	}, []string{"tableName", "columnName", "referencedTable", "referencedColumn"}), reg.createForeignKey)

	srv.AddTool(makeTool("list_all_constraints", "List all constraints for a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"tableName"}), reg.listAllConstraints)

	srv.AddTool(makeTool("drop_constraint", "Drop a constraint from a table", map[string]prop{
		"projectId":      {Type: "string", Desc: "Project ID"},
		"tableName":      {Type: "string", Desc: "Name of the table"},
		"constraintName": {Type: "string", Desc: "Name of the constraint to drop"},
	}, []string{"tableName", "constraintName"}), reg.dropConstraint)

	srv.AddTool(makeTool("list_foreign_keys", "List all foreign keys for a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"tableName"}), reg.listForeignKeys)

	srv.AddTool(makeTool("list_extensions", "Show available PostgreSQL extensions", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"installed": {Type: "boolean", Desc: "Filter to show only installed extensions (default: false)"},
	}, nil), reg.listExtensions)

	srv.AddTool(makeTool("generate_typescript_types", "Auto-generate TypeScript types from database schema", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"outputFormat": {Type: "string", Desc: "TypeScript output format: interface, class, or type (default: interface)"},
	}, nil), reg.generateTypescriptTypes)

	srv.AddTool(makeTool("search_docs", "Search through database documentation and help content", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"query":     {Type: "string", Desc: "Search query string"},
		"category":  {Type: "string", Desc: "Category to search within: tables, functions, migrations, general"},
		"limit":     {Type: "number", Desc: "Maximum number of results to return (default: 10)"},
	}, []string{"query"}), reg.searchDocs)

	srv.AddTool(makeTool("list_migrations", "Display migration history", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"limit":     {Type: "number", Desc: "Maximum number of migrations to return (default: 50)"},
		"status":    {Type: "string", Desc: "Filter by migration status: applied, pending, failed"},
	}, nil), reg.listMigrations)

	srv.AddTool(makeTool("apply_migration", "Execute database migrations", map[string]prop{
		"projectId":     {Type: "string", Desc: "Project ID"},
		"migrationFile": {Type: "string", Desc: "SQL content to execute as a migration"},
		"rollback":      {Type: "boolean", Desc: "Rollback the migration instead of applying it (default: false)"},
	}, []string{"migrationFile"}), reg.applyMigration)

	srv.AddTool(makeTool("get_logs", "Retrieve database operation logs", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"level":     {Type: "string", Desc: "Log level filter: error, warn, info, debug"},
		"limit":     {Type: "number", Desc: "Maximum number of log entries (default: 100)"},
	}, nil), reg.getLogs)

	srv.AddTool(makeTool("get_advisors", "Get performance and security recommendations", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"type":      {Type: "string", Desc: "Type of recommendations: performance, security, maintenance"},
	}, nil), reg.getAdvisors)

	srv.AddTool(makeTool("create_schema", "Create new database schema", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"schemaName":  {Type: "string", Desc: "Name of the schema to create"},
		"description": {Type: "string", Desc: "Description of the schema"},
	}, []string{"schemaName"}), reg.createSchema)

	srv.AddTool(makeTool("delete_schema", "Remove database schema", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"schemaName": {Type: "string", Desc: "Name of the schema to delete"},
		"force":      {Type: "boolean", Desc: "Force deletion even if schema has dependencies (default: false)"},
	}, []string{"schemaName"}), reg.deleteSchema)

	srv.AddTool(makeTool("list_cron_jobs", "List all scheduled cron jobs in the database", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, nil), reg.listCronJobs)

	srv.AddTool(makeTool("create_cron_job", "Create a new cron job to schedule automated tasks", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobName":   {Type: "string", Desc: "Name for the cron job"},
		"schedule":  {Type: "string", Desc: "Cron schedule expression (e.g. '*/5 * * * *')"},
		"command":   {Type: "string", Desc: "SQL command to execute"},
	}, []string{"jobName", "schedule", "command"}), reg.createCronJob)

	srv.AddTool(makeTool("update_cron_job", "Update an existing cron job", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Job ID"},
		"jobName":   {Type: "string", Desc: "New job name (optional)"},
		"schedule":  {Type: "string", Desc: "New cron schedule expression (optional)"},
		"command":   {Type: "string", Desc: "New SQL command (optional)"},
	}, []string{"jobId"}), reg.updateCronJob)

	srv.AddTool(makeTool("delete_cron_job", "Delete a cron job", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Job ID to delete"},
	}, []string{"jobId"}), reg.deleteCronJob)

	srv.AddTool(makeTool("toggle_cron_job", "Enable or disable a cron job", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Job ID"},
		"active":    {Type: "boolean", Desc: "Set to true to activate, false to deactivate"},
	}, []string{"jobId", "active"}), reg.toggleCronJob)

	srv.AddTool(makeTool("get_cron_job_history", "Get execution history for a cron job", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Job ID"},
		"limit":     {Type: "number", Desc: "Maximum number of history entries (default: 50)"},
	}, []string{"jobId"}), reg.getCronJobHistory)
}

type dbTools struct {
	pool *pgxpool.Pool
	svc  *dbproxy.Service
}

func (d *dbTools) acquireConn(ctx context.Context, args map[string]any) (*dbproxy.ProjectConn, error) {
	pid, err := resolveProjectID(ctx, args, isClientEndpointContext(ctx))
	if err != nil {
		return nil, err
	}
	return d.svc.AcquireConn(ctx, pid)
}

// --- list_tables ---

func (d *dbTools) listTables(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	tables, err := d.svc.ListTables(ctx, pc, false)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list tables: %v", err))
	}
	return textResult(tables)
}

// --- get_table_schema ---

func (d *dbTools) getTableSchema(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	columns, err := d.svc.GetTableSchema(ctx, pc, tableName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get table schema: %v", err))
	}
	if columns == nil {
		return errorResult(fmt.Sprintf("Table %q not found", tableName))
	}
	return textResult(map[string]any{
		"table_name":   tableName,
		"table_schema": pc.SchemaName,
		"columns":      columns,
	})
}

// --- execute_sql ---

func (d *dbTools) executeSql(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	query := getString(args, "query")
	if query == "" {
		return errorResult("query is required")
	}
	readonly := getBool(args, "readonly", true)

	if readonly {
		trimmed := strings.TrimSpace(strings.ToUpper(query))
		if !strings.HasPrefix(trimmed, "SELECT") && !strings.HasPrefix(trimmed, "WITH") {
			return errorResult("Only SELECT queries are allowed in readonly mode")
		}
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	normalized := normalizeQuery(query)
	var params []any
	if rawParams, ok := args["parameters"]; ok {
		if arr, ok := rawParams.([]any); ok {
			params = arr
		}
	}

	start := time.Now()
	rows, err := pc.Query(ctx, normalized, params...)
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err))
	}
	defer rows.Close()

	descs := rows.FieldDescriptions()
	colNames := make([]string, len(descs))
	for i, d := range descs {
		colNames[i] = d.Name
	}

	result := collectRows(rows)
	execTime := time.Since(start).Milliseconds()

	return textResult(map[string]any{
		"rows":          result,
		"rowCount":      len(result),
		"columns":       colNames,
		"executionTime": execTime,
	})
}

// --- select_data ---

func (d *dbTools) selectData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	selectClause := "*"
	if cols := getStringSlice(args, "columns"); len(cols) > 0 {
		quoted := make([]string, len(cols))
		for i, c := range cols {
			quoted[i] = fmt.Sprintf(`"%s"`, c)
		}
		selectClause = strings.Join(quoted, ", ")
	}

	query := fmt.Sprintf(`SELECT %s FROM "%s"`, selectClause, tableName)
	var qArgs []any
	idx := 1

	if where := getMap(args, "where"); len(where) > 0 {
		var clauses []string
		for col, val := range where {
			clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
			qArgs = append(qArgs, val)
			idx++
		}
		query += " WHERE " + strings.Join(clauses, " AND ")
	}

	if limit := getInt(args, "limit", 0); limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", idx)
		qArgs = append(qArgs, limit)
		idx++
	}
	if offset := getInt(args, "offset", 0); offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", idx)
		qArgs = append(qArgs, offset)
	}

	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Select failed: %v", err))
	}
	defer rows.Close()

	return textResult(collectRows(rows))
}

// --- insert_data ---

func (d *dbTools) insertData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	data := getMap(args, "data")
	if tableName == "" || data == nil {
		return errorResult("tableName and data are required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	columns := make([]string, 0, len(data))
	values := make([]any, 0, len(data))
	placeholders := make([]string, 0, len(data))
	i := 1
	for col, val := range data {
		columns = append(columns, fmt.Sprintf(`"%s"`, col))
		values = append(values, val)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
		tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))

	rows, err := pc.Query(ctx, query, values...)
	if err != nil {
		return errorResult(fmt.Sprintf("Insert failed: %v", err))
	}
	defer rows.Close()

	result := collectRows(rows)
	var row any
	if len(result) > 0 {
		row = result[0]
	}
	return textResult(map[string]any{
		"success": true,
		"message": "Data inserted successfully",
		"data":    row,
	})
}

// --- bulk_insert_data ---

func (d *dbTools) bulkInsertData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	dataArray := getMapSlice(args, "dataArray")
	if tableName == "" || len(dataArray) == 0 {
		return errorResult("tableName and dataArray are required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var inserted []map[string]any
	for _, data := range dataArray {
		columns := make([]string, 0, len(data))
		values := make([]any, 0, len(data))
		placeholders := make([]string, 0, len(data))
		i := 1
		for col, val := range data {
			columns = append(columns, fmt.Sprintf(`"%s"`, col))
			values = append(values, val)
			placeholders = append(placeholders, fmt.Sprintf("$%d", i))
			i++
		}

		query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
			tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))

		rows, err := pc.Query(ctx, query, values...)
		if err != nil {
			return errorResult(fmt.Sprintf("Bulk insert failed: %v", err))
		}
		result := collectRows(rows)
		rows.Close()
		if len(result) > 0 {
			inserted = append(inserted, result[0])
		}
	}

	return textResult(map[string]any{
		"success": true,
		"message": fmt.Sprintf("%d rows inserted successfully", len(inserted)),
		"data":    inserted,
	})
}

// --- update_data ---

func (d *dbTools) updateData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	data := getMap(args, "data")
	where := getMap(args, "where")
	if tableName == "" || data == nil || where == nil {
		return errorResult("tableName, data, and where are required")
	}
	if len(where) == 0 {
		return errorResult("Where clause cannot be empty")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var setClauses []string
	var qArgs []any
	idx := 1
	for col, val := range data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		qArgs = append(qArgs, val)
		idx++
	}
	var whereClauses []string
	for col, val := range where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		qArgs = append(qArgs, val)
		idx++
	}

	query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s RETURNING *`,
		tableName, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))

	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Update failed: %v", err))
	}
	defer rows.Close()

	result := collectRows(rows)
	return textResult(map[string]any{
		"success": true,
		"message": fmt.Sprintf("%d row(s) updated successfully", len(result)),
		"data":    result,
	})
}

// --- delete_data ---

func (d *dbTools) deleteData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	where := getMap(args, "where")
	if tableName == "" || where == nil {
		return errorResult("tableName and where are required")
	}
	if len(where) == 0 {
		return errorResult("Where clause cannot be empty")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var whereClauses []string
	var qArgs []any
	idx := 1
	for col, val := range where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		qArgs = append(qArgs, val)
		idx++
	}

	query := fmt.Sprintf(`DELETE FROM "%s" WHERE %s RETURNING *`, tableName, strings.Join(whereClauses, " AND "))

	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Delete failed: %v", err))
	}
	defer rows.Close()

	result := collectRows(rows)
	return textResult(map[string]any{
		"success":      true,
		"message":      fmt.Sprintf("%d row(s) deleted successfully", len(result)),
		"deletedCount": len(result),
	})
}

// --- create_table ---

func (d *dbTools) createTable(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}
	if ok, _ := regexp.MatchString(`^[a-zA-Z_][a-zA-Z0-9_]*$`, tableName); !ok {
		return errorResult("Invalid table name")
	}

	rawCols, ok := args["columns"].([]any)
	if !ok || len(rawCols) == 0 {
		return errorResult("columns array is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var colDefs []string
	var pkCols []string

	for _, rawCol := range rawCols {
		col, ok := rawCol.(map[string]any)
		if !ok {
			continue
		}
		name := getString(col, "name")
		colType := getString(col, "type")
		if name == "" || colType == "" {
			return errorResult("Each column must have a name and type")
		}

		def := fmt.Sprintf(`"%s" %s`, name, colType)

		isPK := getBool(col, "primaryKey", false)
		nullable := getBool(col, "nullable", true)
		if isPK || (!nullable && colType != "SERIAL" && colType != "BIGSERIAL") {
			def += " NOT NULL"
		}

		if dv := getString(col, "defaultValue"); dv != "" && colType != "SERIAL" && colType != "BIGSERIAL" {
			upperType := strings.ToUpper(colType)
			if strings.Contains(upperType, "INT") || strings.EqualFold(colType, "BOOLEAN") {
				def += " DEFAULT " + dv
			} else {
				def += fmt.Sprintf(` DEFAULT '%s'`, strings.ReplaceAll(dv, "'", "''"))
			}
		}

		colDefs = append(colDefs, def)
		if isPK {
			pkCols = append(pkCols, fmt.Sprintf(`"%s"`, name))
		}
	}

	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS \"%s\" (\n  %s", tableName, strings.Join(colDefs, ",\n  "))
	if len(pkCols) > 0 {
		sql += fmt.Sprintf(",\n  PRIMARY KEY (%s)", strings.Join(pkCols, ", "))
	}
	sql += "\n)"

	if err := pc.Exec(ctx, sql); err != nil {
		return errorResult(fmt.Sprintf("Failed to create table: %v", err))
	}

	return textResult(map[string]any{
		"success":   true,
		"message":   fmt.Sprintf("Table %s created successfully", tableName),
		"tableName": tableName,
		"columns":   len(colDefs),
	})
}

// --- drop_table ---

func (d *dbTools) dropTable(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if err := pc.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tableName)); err != nil {
		return errorResult(fmt.Sprintf("Failed to drop table: %v", err))
	}
	return textResult(map[string]any{
		"success": true,
		"message": fmt.Sprintf("Table %s dropped successfully", tableName),
	})
}

// --- create_foreign_key ---

func (d *dbTools) createForeignKey(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	columnName := getString(args, "columnName")
	referencedTable := getString(args, "referencedTable")
	referencedColumn := getString(args, "referencedColumn")
	if tableName == "" || columnName == "" || referencedTable == "" || referencedColumn == "" {
		return errorResult("tableName, columnName, referencedTable, and referencedColumn are required")
	}

	onDelete := getString(args, "onDelete")
	if onDelete == "" {
		onDelete = "RESTRICT"
	}
	onUpdate := getString(args, "onUpdate")
	if onUpdate == "" {
		onUpdate = "RESTRICT"
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	constraintName := strings.ToLower(fmt.Sprintf("fk_%s_%s_%s_%s", tableName, columnName, referencedTable, referencedColumn))
	sql := fmt.Sprintf(
		`ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY ("%s") REFERENCES "%s" ("%s") ON DELETE %s ON UPDATE %s`,
		tableName, constraintName, columnName, referencedTable, referencedColumn, onDelete, onUpdate,
	)

	if err := pc.Exec(ctx, sql); err != nil {
		return errorResult(fmt.Sprintf("Failed to create foreign key: %v", err))
	}

	return textResult(map[string]any{
		"success":        true,
		"message":        "Foreign key constraint created successfully",
		"constraintName": constraintName,
	})
}

// --- list_all_constraints ---

func (d *dbTools) listAllConstraints(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT
			tc.constraint_name, tc.constraint_type, kcu.column_name,
			ccu.table_name AS referenced_table_name, ccu.column_name AS referenced_column_name,
			rc.update_rule, rc.delete_rule, cc.check_clause
		FROM information_schema.table_constraints AS tc
		LEFT JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		LEFT JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		LEFT JOIN information_schema.referential_constraints AS rc
			ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		LEFT JOIN information_schema.check_constraints AS cc
			ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1
		ORDER BY tc.constraint_type, tc.constraint_name
	`, tableName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list constraints: %v", err))
	}
	defer rows.Close()

	return textResult(map[string]any{"success": true, "data": collectRows(rows)})
}

// --- drop_constraint ---

func (d *dbTools) dropConstraint(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	constraintName := getString(args, "constraintName")
	if tableName == "" || constraintName == "" {
		return errorResult("tableName and constraintName are required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if err := pc.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"`, tableName, constraintName)); err != nil {
		return errorResult(fmt.Sprintf("Failed to drop constraint: %v", err))
	}
	return textResult(map[string]any{
		"success": true,
		"message": fmt.Sprintf("Constraint %s dropped successfully", constraintName),
	})
}

// --- list_foreign_keys ---

func (d *dbTools) listForeignKeys(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	if tableName == "" {
		return errorResult("tableName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT
			tc.constraint_name, kcu.column_name,
			ccu.table_name AS referenced_table_name, ccu.column_name AS referenced_column_name,
			rc.update_rule, rc.delete_rule
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		JOIN information_schema.referential_constraints AS rc
			ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
		ORDER BY tc.constraint_name
	`, tableName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list foreign keys: %v", err))
	}
	defer rows.Close()

	return textResult(map[string]any{"success": true, "data": collectRows(rows)})
}

// --- list_extensions ---

func (d *dbTools) listExtensions(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	installed := getBool(args, "installed", false)

	conn, err := d.pool.Acquire(ctx)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to acquire connection: %v", err))
	}
	defer conn.Release()

	var query string
	if installed {
		query = `SELECT extname, extversion, extrelocatable FROM pg_extension ORDER BY extname`
	} else {
		query = `SELECT name, default_version, comment FROM pg_available_extensions ORDER BY name`
	}

	rows, err := conn.Query(ctx, query)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list extensions: %v", err))
	}
	defer rows.Close()

	return textResult(collectRows(rows))
}

// --- generate_typescript_types ---

func (d *dbTools) generateTypescriptTypes(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	outputFormat := getString(args, "outputFormat")
	if outputFormat == "" {
		outputFormat = "interface"
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT
			t.table_name,
			json_agg(
				json_build_object(
					'name', c.column_name,
					'type', c.data_type,
					'nullable', c.is_nullable = 'YES'
				) ORDER BY c.ordinal_position
			) as columns
		FROM information_schema.tables t
		JOIN information_schema.columns c
			ON t.table_name = c.table_name AND t.table_schema = c.table_schema
		WHERE t.table_schema = current_schema()
			AND t.table_type = 'BASE TABLE'
			AND t.table_name NOT LIKE 'skaftin_system_%'
		GROUP BY t.table_name
		ORDER BY t.table_name
	`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to query tables: %v", err))
	}
	defer rows.Close()

	typeMap := map[string]string{
		"integer": "number", "bigint": "number", "smallint": "number",
		"decimal": "number", "numeric": "number", "real": "number", "double precision": "number",
		"boolean": "boolean",
		"text":    "string", "varchar": "string", "character varying": "string", "char": "string",
		"timestamp": "Date", "timestamp with time zone": "Date", "date": "Date",
		"json": "any", "jsonb": "any",
	}

	var types []string
	for rows.Next() {
		var tableName string
		var columnsJSON []byte
		if err := rows.Scan(&tableName, &columnsJSON); err != nil {
			slog.Error("scan error", "error", err)
			continue
		}

		var cols []struct {
			Name     string `json:"name"`
			Type     string `json:"type"`
			Nullable bool   `json:"nullable"`
		}
		if err := json.Unmarshal(columnsJSON, &cols); err != nil {
			continue
		}

		ifName := toPascalCase(tableName)
		var props []string
		for _, col := range cols {
			tsType := typeMap[col.Type]
			if tsType == "" {
				tsType = "string"
			}
			nullable := ""
			if col.Nullable {
				nullable = " | null"
			}
			props = append(props, fmt.Sprintf("  %s: %s%s;", col.Name, tsType, nullable))
		}

		switch outputFormat {
		case "type":
			types = append(types, fmt.Sprintf("type %s = {\n%s\n};", ifName, strings.Join(props, "\n")))
		case "class":
			types = append(types, fmt.Sprintf("class %s {\n%s\n}", ifName, strings.Join(props, "\n")))
		default:
			types = append(types, fmt.Sprintf("interface %s {\n%s\n}", ifName, strings.Join(props, "\n")))
		}
	}

	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: strings.Join(types, "\n\n")},
		},
	}, nil
}

// --- search_docs ---

func (d *dbTools) searchDocs(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	query := getString(args, "query")
	if query == "" {
		return errorResult("query is required")
	}
	category := getString(args, "category")
	limit := getInt(args, "limit", 10)

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	pattern := "%" + query + "%"
	var sql string
	switch category {
	case "tables":
		sql = `SELECT table_schema, table_name, 'table' as type FROM information_schema.tables WHERE table_schema = current_schema() AND table_name ILIKE $1 LIMIT $2`
	case "functions":
		sql = `SELECT routine_schema, routine_name, routine_type as type FROM information_schema.routines WHERE routine_schema = current_schema() AND routine_name ILIKE $1 LIMIT $2`
	default:
		sql = `SELECT table_schema as schema, table_name as name, 'table' as type FROM information_schema.tables WHERE table_schema = current_schema() AND table_name ILIKE $1 UNION ALL SELECT routine_schema, routine_name, routine_type FROM information_schema.routines WHERE routine_schema = current_schema() AND routine_name ILIKE $1 LIMIT $2`
	}

	rows, err := pc.Query(ctx, sql, pattern, limit)
	if err != nil {
		return errorResult(fmt.Sprintf("Search failed: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

// --- list_migrations ---

func (d *dbTools) listMigrations(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	limit := getInt(args, "limit", 50)
	status := getString(args, "status")

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var exists bool
	pc.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'schema_migrations')`).Scan(&exists)
	if !exists {
		return textResult(map[string]any{"message": "Migration tracking is not set up. No schema_migrations table found.", "exists": false})
	}

	sql := `SELECT * FROM schema_migrations`
	var qArgs []any
	if status != "" {
		sql += ` WHERE status = $1 ORDER BY version DESC LIMIT $2`
		qArgs = append(qArgs, status, limit)
	} else {
		sql += ` ORDER BY version DESC LIMIT $1`
		qArgs = append(qArgs, limit)
	}

	rows, err := pc.Query(ctx, sql, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list migrations: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"exists": true, "migrations": collectRows(rows)})
}

// --- apply_migration ---

func (d *dbTools) applyMigration(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	migrationSQL := getString(args, "migrationFile")
	if migrationSQL == "" {
		return errorResult("migrationFile (SQL content) is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	start := time.Now()
	if err := pc.Exec(ctx, migrationSQL); err != nil {
		return errorResult(fmt.Sprintf("Migration failed: %v", err))
	}

	return textResult(map[string]any{
		"success":       true,
		"message":       "Migration applied successfully",
		"executionTime": time.Since(start).Milliseconds(),
	})
}

// --- get_logs ---

func (d *dbTools) getLogs(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Logging system not yet implemented"})
}

// --- get_advisors ---

func (d *dbTools) getAdvisors(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT
			kcu.table_name, kcu.column_name,
			ccu.table_name AS referenced_table
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'FOREIGN KEY'
		AND NOT EXISTS (
			SELECT 1 FROM pg_indexes
			WHERE schemaname = current_schema()
			AND tablename = kcu.table_name
			AND indexdef ILIKE '%' || kcu.column_name || '%'
		)
	`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get advisors: %v", err))
	}
	defer rows.Close()

	var recommendations []map[string]any
	for _, row := range collectRows(rows) {
		recommendations = append(recommendations, map[string]any{
			"type":     "performance",
			"severity": "medium",
			"message":  fmt.Sprintf("Missing index on foreign key column %s.%s (references %s)", row["table_name"], row["column_name"], row["referenced_table"]),
			"fix":      fmt.Sprintf(`CREATE INDEX ON "%s" ("%s")`, row["table_name"], row["column_name"]),
		})
	}
	return textResult(map[string]any{"recommendations": recommendations})
}

// --- create_schema ---

func (d *dbTools) createSchema(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	schemaName := getString(args, "schemaName")
	if schemaName == "" {
		return errorResult("schemaName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if err := pc.Exec(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName)); err != nil {
		return errorResult(fmt.Sprintf("Failed to create schema: %v", err))
	}
	if desc := getString(args, "description"); desc != "" {
		pc.Exec(ctx, fmt.Sprintf("COMMENT ON SCHEMA %s IS '%s'", schemaName, strings.ReplaceAll(desc, "'", "''")))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Schema %s created successfully", schemaName)})
}

// --- delete_schema ---

func (d *dbTools) deleteSchema(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	schemaName := getString(args, "schemaName")
	if schemaName == "" {
		return errorResult("schemaName is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	cascade := ""
	if getBool(args, "force", false) {
		cascade = " CASCADE"
	}
	if err := pc.Exec(ctx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s%s", schemaName, cascade)); err != nil {
		if strings.Contains(err.Error(), "2BP01") {
			return errorResult("Schema has dependent objects. Use force=true to drop with CASCADE.")
		}
		return errorResult(fmt.Sprintf("Failed to delete schema: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Schema %s deleted successfully", schemaName)})
}

// --- list_cron_jobs ---

func (d *dbTools) listCronJobs(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var pgCronExists bool
	pc.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')`).Scan(&pgCronExists)
	if !pgCronExists {
		return textResult(map[string]any{"message": "pg_cron extension is not installed", "hint": "Run: CREATE EXTENSION IF NOT EXISTS pg_cron"})
	}

	rows, err := pc.Query(ctx, `SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname FROM cron.job ORDER BY jobid DESC`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to list cron jobs: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

// --- create_cron_job ---

func (d *dbTools) createCronJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobName := getString(args, "jobName")
	schedule := getString(args, "schedule")
	command := getString(args, "command")
	if jobName == "" || schedule == "" || command == "" {
		return errorResult("jobName, schedule, and command are required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var currentSchema string
	pc.QueryRow(ctx, "SELECT current_schema()").Scan(&currentSchema)
	fullCommand := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, command)

	var jobID int
	if err := pc.QueryRow(ctx, `SELECT cron.schedule($1, $2, $3)`, jobName, schedule, fullCommand).Scan(&jobID); err != nil {
		return errorResult(fmt.Sprintf("Failed to create cron job: %v", err))
	}
	return textResult(map[string]any{"success": true, "jobid": jobID, "jobName": jobName, "schedule": schedule, "command": fullCommand})
}

// --- update_cron_job ---

func (d *dbTools) updateCronJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	if jobId == "" {
		return errorResult("jobId is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if s := getString(args, "schedule"); s != "" {
		pc.Exec(ctx, `UPDATE cron.job SET schedule = $1 WHERE jobid = $2`, s, jobId)
	}
	if c := getString(args, "command"); c != "" {
		var currentSchema string
		pc.QueryRow(ctx, "SELECT current_schema()").Scan(&currentSchema)
		fullCmd := fmt.Sprintf("SET search_path TO %s, public; %s", currentSchema, c)
		pc.Exec(ctx, `UPDATE cron.job SET command = $1 WHERE jobid = $2`, fullCmd, jobId)
	}
	if n := getString(args, "jobName"); n != "" {
		pc.Exec(ctx, `UPDATE cron.job SET jobname = $1 WHERE jobid = $2`, n, jobId)
	}
	return textResult(map[string]any{"success": true, "message": "Cron job updated successfully", "jobId": jobId})
}

// --- delete_cron_job ---

func (d *dbTools) deleteCronJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	if jobId == "" {
		return errorResult("jobId is required")
	}

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var unscheduled bool
	pc.QueryRow(ctx, `SELECT cron.unschedule($1::int)`, jobId).Scan(&unscheduled)
	return textResult(map[string]any{"success": true, "message": "Cron job deleted successfully", "jobId": jobId})
}

// --- toggle_cron_job ---

func (d *dbTools) toggleCronJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	active := getBool(args, "active", true)

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	pc.Exec(ctx, `UPDATE cron.job SET active = $1 WHERE jobid = $2`, active, jobId)
	msg := "deactivated"
	if active {
		msg = "activated"
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Cron job %s successfully", msg), "active": active})
}

// --- get_cron_job_history ---

func (d *dbTools) getCronJobHistory(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	if jobId == "" {
		return errorResult("jobId is required")
	}
	limit := getInt(args, "limit", 50)

	pc, err := d.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT runid, jobid, job_pid, database, username, command, status, return_message, start_time, end_time
		FROM cron.job_run_details WHERE jobid = $1 ORDER BY start_time DESC LIMIT $2
	`, jobId, limit)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get cron job history: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

// --- schema helpers ---

type prop struct {
	Type string
	Desc string
}

func makeTool(name, description string, properties map[string]prop, required []string) *sdkmcp.Tool {
	props := make(map[string]any, len(properties))
	for pname, p := range properties {
		props[pname] = map[string]string{
			"type":        p.Type,
			"description": p.Desc,
		}
	}
	schema := map[string]any{
		"type":       "object",
		"properties": props,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return &sdkmcp.Tool{
		Name:        name,
		Description: description,
		InputSchema: schema,
	}
}

// --- utility ---

func normalizeQuery(query string) string {
	re := regexp.MustCompile("`([^`]+)`")
	return re.ReplaceAllStringFunc(query, func(match string) string {
		ident := match[1 : len(match)-1]
		if strings.Contains(ident, ".") {
			parts := strings.Split(ident, ".")
			quoted := make([]string, len(parts))
			for i, p := range parts {
				quoted[i] = fmt.Sprintf(`"%s"`, strings.TrimSpace(p))
			}
			return strings.Join(quoted, ".")
		}
		return fmt.Sprintf(`"%s"`, ident)
	})
}

func toPascalCase(s string) string {
	parts := strings.Split(s, "_")
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	return strings.Join(parts, "")
}

// collectRows reads all rows from pgx.Rows into a slice of maps.
func collectRows(rows pgx.Rows) []map[string]any {
	descs := rows.FieldDescriptions()
	var result []map[string]any

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			slog.Error("row scan error", "error", err)
			continue
		}
		row := make(map[string]any, len(descs))
		for i, fd := range descs {
			row[fd.Name] = values[i]
		}
		result = append(result, row)
	}

	if result == nil {
		result = []map[string]any{}
	}
	return result
}
