package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
)

func registerGraphQLTools(srv toolRegistrar, pool *pgxpool.Pool, dbSvc *dbproxy.Service) {
	reg := &graphqlTools{pool: pool, svc: dbSvc}

	srv.AddTool(makeTool("graphql_query", "Execute a GraphQL query (via direct SQL - same result)", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"query":     {Type: "string", Desc: "SQL query to execute (SELECT only)"},
	}, []string{"projectId", "query"}), reg.graphqlQuery)

	srv.AddTool(makeTool("graphql_mutation", "Execute a GraphQL mutation (via direct SQL)", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"mutation":  {Type: "string", Desc: "SQL mutation to execute"},
	}, []string{"projectId", "mutation"}), reg.graphqlMutation)

	srv.AddTool(makeTool("graphql_list_tables", "List all tables in a project using GraphQL", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.graphqlListTables)

	srv.AddTool(makeTool("graphql_get_table_schema", "Get detailed schema for a table using GraphQL", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"projectId", "tableName"}), reg.graphqlGetTableSchema)

	srv.AddTool(makeTool("graphql_query_table", "Query data from a table with filtering and pagination", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"columns":   {Type: "array", Desc: "Columns to select"},
		"where":     {Type: "object", Desc: "WHERE condition as key-value pairs"},
		"limit":     {Type: "number", Desc: "Max rows to return (default: 100)"},
		"offset":    {Type: "number", Desc: "Rows to skip (default: 0)"},
	}, []string{"projectId", "tableName"}), reg.graphqlQueryTable)

	srv.AddTool(makeTool("graphql_insert_data", "Insert a single row into a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"data":      {Type: "object", Desc: "Data to insert"},
	}, []string{"projectId", "tableName", "data"}), reg.graphqlInsertData)

	srv.AddTool(makeTool("graphql_bulk_insert", "Insert multiple rows into a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"dataArray": {Type: "array", Desc: "Array of data objects"},
	}, []string{"projectId", "tableName", "dataArray"}), reg.graphqlBulkInsert)

	srv.AddTool(makeTool("graphql_update_data", "Update data in a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"data":      {Type: "object", Desc: "Data to update"},
		"where":     {Type: "object", Desc: "WHERE condition"},
	}, []string{"projectId", "tableName", "data", "where"}), reg.graphqlUpdateData)

	srv.AddTool(makeTool("graphql_delete_data", "Delete data from a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"where":     {Type: "object", Desc: "WHERE condition"},
	}, []string{"projectId", "tableName", "where"}), reg.graphqlDeleteData)

	srv.AddTool(makeTool("graphql_create_table", "Create a new table with columns", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
		"columns":   {Type: "array", Desc: "Array of column definitions"},
	}, []string{"projectId", "tableName", "columns"}), reg.graphqlCreateTable)

	srv.AddTool(makeTool("graphql_drop_table", "Drop a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"projectId", "tableName"}), reg.graphqlDropTable)

	srv.AddTool(makeTool("graphql_add_column", "Add a column to an existing table", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"tableName":    {Type: "string", Desc: "Name of the table"},
		"columnName":   {Type: "string", Desc: "Column name"},
		"columnType":   {Type: "string", Desc: "Data type"},
		"nullable":     {Type: "boolean", Desc: "Whether column can be NULL (default: true)"},
		"defaultValue": {Type: "string", Desc: "Default value"},
	}, []string{"projectId", "tableName", "columnName", "columnType"}), reg.graphqlAddColumn)

	srv.AddTool(makeTool("graphql_create_foreign_key", "Create a foreign key constraint", map[string]prop{
		"projectId":        {Type: "string", Desc: "Project ID"},
		"tableName":        {Type: "string", Desc: "Name of the table"},
		"columnName":       {Type: "string", Desc: "Column name"},
		"referencedTable":  {Type: "string", Desc: "Referenced table"},
		"referencedColumn": {Type: "string", Desc: "Referenced column"},
		"onDelete":         {Type: "string", Desc: "ON DELETE action (default: RESTRICT)"},
		"onUpdate":         {Type: "string", Desc: "ON UPDATE action (default: RESTRICT)"},
	}, []string{"projectId", "tableName", "columnName", "referencedTable", "referencedColumn"}), reg.graphqlCreateForeignKey)

	srv.AddTool(makeTool("graphql_get_constraints", "Get all constraints for a table", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"tableName": {Type: "string", Desc: "Name of the table"},
	}, []string{"projectId", "tableName"}), reg.graphqlGetConstraints)

	srv.AddTool(makeTool("graphql_introspect_schema", "Get the complete schema definition", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, nil), reg.graphqlIntrospect)
}

type graphqlTools struct {
	pool *pgxpool.Pool
	svc  *dbproxy.Service
}

func (g *graphqlTools) acquireConn(ctx context.Context, args map[string]any) (*dbproxy.ProjectConn, error) {
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return nil, err
	}
	return g.svc.AcquireConn(ctx, pid)
}

func (g *graphqlTools) graphqlQuery(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	query := getString(args, "query")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, query)
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"data": collectRows(rows)})
}

func (g *graphqlTools) graphqlMutation(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	mutation := getString(args, "mutation")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, mutation)
	if err != nil {
		return errorResult(fmt.Sprintf("Mutation failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"data": collectRows(rows)})
}

func (g *graphqlTools) graphqlListTables(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	tables, err := g.svc.ListTables(ctx, pc, false)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(tables)
}

func (g *graphqlTools) graphqlGetTableSchema(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	columns, err := g.svc.GetTableSchema(ctx, pc, tableName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(columns)
}

func (g *graphqlTools) graphqlQueryTable(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	pc, err := g.acquireConn(ctx, args)
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
	limit := getInt(args, "limit", 100)
	query += fmt.Sprintf(" LIMIT $%d", idx)
	qArgs = append(qArgs, limit)
	idx++
	if offset := getInt(args, "offset", 0); offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", idx)
		qArgs = append(qArgs, offset)
	}

	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	return textResult(map[string]any{"rows": result, "rowCount": len(result)})
}

func (g *graphqlTools) graphqlInsertData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	data := getMap(args, "data")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	columns, values, placeholders := buildInsertParts(data)
	query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`, tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))
	rows, err := pc.Query(ctx, query, values...)
	if err != nil {
		return errorResult(fmt.Sprintf("Insert failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "data": collectRows(rows)})
}

func (g *graphqlTools) graphqlBulkInsert(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	dataArray := getMapSlice(args, "dataArray")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var inserted []map[string]any
	for _, data := range dataArray {
		columns, values, placeholders := buildInsertParts(data)
		query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`, tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))
		rows, err := pc.Query(ctx, query, values...)
		if err != nil {
			return errorResult(fmt.Sprintf("Bulk insert failed: %v", err))
		}
		result := collectRows(rows)
		rows.Close()
		inserted = append(inserted, result...)
	}
	return textResult(map[string]any{"success": true, "rowCount": len(inserted), "data": inserted})
}

func (g *graphqlTools) graphqlUpdateData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	data := getMap(args, "data")
	where := getMap(args, "where")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var setClauses, whereClauses []string
	var qArgs []any
	idx := 1
	for col, val := range data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		qArgs = append(qArgs, val)
		idx++
	}
	for col, val := range where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		qArgs = append(qArgs, val)
		idx++
	}

	query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s RETURNING *`, tableName, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Update failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	return textResult(map[string]any{"success": true, "rowCount": len(result), "data": result})
}

func (g *graphqlTools) graphqlDeleteData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	where := getMap(args, "where")
	pc, err := g.acquireConn(ctx, args)
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
	return textResult(map[string]any{"success": true, "rowCount": len(result)})
}

func (g *graphqlTools) graphqlCreateTable(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	rawCols, ok := args["columns"].([]any)
	if !ok || len(rawCols) == 0 {
		return errorResult("columns are required")
	}
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var colDefs, pkCols []string
	for _, rawCol := range rawCols {
		col, _ := rawCol.(map[string]any)
		name := getString(col, "name")
		colType := getString(col, "type")
		def := fmt.Sprintf(`"%s" %s`, name, colType)
		if !getBool(col, "nullable", true) {
			def += " NOT NULL"
		}
		if dv := getString(col, "defaultValue"); dv != "" {
			def += " DEFAULT " + dv
		}
		colDefs = append(colDefs, def)
		if getBool(col, "primaryKey", false) {
			pkCols = append(pkCols, fmt.Sprintf(`"%s"`, name))
		}
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (%s`, tableName, strings.Join(colDefs, ", "))
	if len(pkCols) > 0 {
		sql += fmt.Sprintf(", PRIMARY KEY (%s)", strings.Join(pkCols, ", "))
	}
	sql += ")"

	if err := pc.Exec(ctx, sql); err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Table %s created", tableName)})
}

func (g *graphqlTools) graphqlDropTable(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	if err := pc.Exec(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tableName)); err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Table %s dropped", tableName)})
}

func (g *graphqlTools) graphqlAddColumn(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	columnName := getString(args, "columnName")
	columnType := getString(args, "columnType")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN "%s" %s`, tableName, columnName, columnType)
	if !getBool(args, "nullable", true) {
		sql += " NOT NULL"
	}
	if dv := getString(args, "defaultValue"); dv != "" {
		sql += " DEFAULT " + dv
	}

	if err := pc.Exec(ctx, sql); err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(map[string]any{"success": true, "message": fmt.Sprintf("Column %s added to %s", columnName, tableName)})
}

func (g *graphqlTools) graphqlCreateForeignKey(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	columnName := getString(args, "columnName")
	refTable := getString(args, "referencedTable")
	refColumn := getString(args, "referencedColumn")
	onDelete := getString(args, "onDelete")
	if onDelete == "" {
		onDelete = "RESTRICT"
	}
	onUpdate := getString(args, "onUpdate")
	if onUpdate == "" {
		onUpdate = "RESTRICT"
	}

	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	constraintName := strings.ToLower(fmt.Sprintf("fk_%s_%s_%s_%s", tableName, columnName, refTable, refColumn))
	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY ("%s") REFERENCES "%s" ("%s") ON DELETE %s ON UPDATE %s`,
		tableName, constraintName, columnName, refTable, refColumn, onDelete, onUpdate)
	if err := pc.Exec(ctx, sql); err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	return textResult(map[string]any{"success": true, "constraintName": constraintName})
}

func (g *graphqlTools) graphqlGetConstraints(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	tableName := getString(args, "tableName")
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT tc.constraint_name, tc.constraint_type, kcu.column_name,
			ccu.table_name AS referenced_table_name, ccu.column_name AS referenced_column_name,
			rc.update_rule, rc.delete_rule, cc.check_clause
		FROM information_schema.table_constraints tc
		LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		LEFT JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
		WHERE tc.table_schema = current_schema() AND tc.table_name = $1
		ORDER BY tc.constraint_type, tc.constraint_name`, tableName)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (g *graphqlTools) graphqlIntrospect(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := g.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `
		SELECT t.table_name, json_agg(json_build_object(
			'column_name', c.column_name, 'data_type', c.data_type,
			'is_nullable', c.is_nullable, 'column_default', c.column_default
		) ORDER BY c.ordinal_position) as columns
		FROM information_schema.tables t
		JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
		WHERE t.table_schema = current_schema() AND t.table_type = 'BASE TABLE'
		GROUP BY t.table_name ORDER BY t.table_name`)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"schema": collectRows(rows)})
}

func buildInsertParts(data map[string]any) ([]string, []any, []string) {
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
	return columns, values, placeholders
}
