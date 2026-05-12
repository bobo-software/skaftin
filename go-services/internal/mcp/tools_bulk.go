package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/dbproxy"
)

func registerBulkTools(srv toolRegistrar, pool *pgxpool.Pool, dbSvc *dbproxy.Service) {
	reg := &bulkTools{pool: pool, svc: dbSvc}

	srv.AddTool(makeTool("bulk_create_app_users", "Create multiple application users in a single operation", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"users":     {Type: "array", Desc: "Array of user objects to create (name, email, password, phone, role_ids, metadata)"},
	}, []string{"projectId", "users"}), reg.bulkCreateAppUsers)

	srv.AddTool(makeTool("execute_batch_operations", "Execute multiple operations in a single call", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"operations": {Type: "array", Desc: "Array of operations ({type, data})"},
	}, []string{"projectId", "operations"}), reg.executeBatchOperations)

	srv.AddTool(makeTool("migrate_table_to_users", "Migrate data from a source table to the users system", map[string]prop{
		"projectId":      {Type: "string", Desc: "Project ID"},
		"sourceTable":    {Type: "string", Desc: "Source table name"},
		"sourceIdColumn": {Type: "string", Desc: "Source table ID column"},
		"mapping":        {Type: "object", Desc: "Field mapping config (name, email, phone, role_ids, metadata)"},
	}, []string{"projectId", "sourceTable", "sourceIdColumn", "mapping"}), reg.migrateTableToUsers)

	srv.AddTool(makeTool("create_migration_job", "Create a migration job to track progress", map[string]prop{
		"projectId":    {Type: "string", Desc: "Project ID"},
		"jobName":      {Type: "string", Desc: "Name of the migration job"},
		"jobType":      {Type: "string", Desc: "Type: table_to_users, bulk_create_users, custom"},
		"totalRecords": {Type: "number", Desc: "Total number of records to process"},
		"metadata":     {Type: "object", Desc: "Additional metadata"},
	}, []string{"projectId", "jobName", "jobType", "totalRecords"}), reg.createMigrationJob)

	srv.AddTool(makeTool("update_migration_job", "Update migration job progress and status", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Migration job ID"},
		"processed": {Type: "number", Desc: "Records processed"},
		"created":   {Type: "number", Desc: "Records created"},
		"skipped":   {Type: "number", Desc: "Records skipped"},
		"errors":    {Type: "number", Desc: "Errors encountered"},
		"status":    {Type: "string", Desc: "Status: running, completed, failed, paused"},
	}, []string{"projectId", "jobId", "processed"}), reg.updateMigrationJob)

	srv.AddTool(makeTool("get_migration_job", "Get migration job details and progress", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"jobId":     {Type: "string", Desc: "Migration job ID"},
	}, []string{"projectId", "jobId"}), reg.getMigrationJob)

	srv.AddTool(makeTool("validate_migration_data", "Validate data before migration", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"sourceTable": {Type: "string", Desc: "Source table name"},
		"validation":  {Type: "object", Desc: "Validation rules (requiredColumns, emailColumns, phoneColumns, uniqueColumns)"},
	}, []string{"projectId", "sourceTable", "validation"}), reg.validateMigrationData)

	srv.AddTool(makeTool("find_or_create_user", "Find existing user by email/phone, or create new", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"lookup":     {Type: "object", Desc: "Lookup criteria (email, phone)"},
		"createData": {Type: "object", Desc: "Data to create if not found (name, email, password, phone, role_ids)"},
	}, []string{"projectId", "lookup"}), reg.findOrCreateUser)
}

type bulkTools struct {
	pool *pgxpool.Pool
	svc  *dbproxy.Service
}

func (b *bulkTools) acquireConn(ctx context.Context, args map[string]any) (*dbproxy.ProjectConn, error) {
	pid, err := projectIDFromArgs(ctx, args)
	if err != nil {
		return nil, err
	}
	return b.svc.AcquireConn(ctx, pid)
}

func (b *bulkTools) bulkCreateAppUsers(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	users := getMapSlice(args, "users")
	if len(users) == 0 {
		return errorResult("users array is required")
	}

	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var created, skipped, errors int
	for _, user := range users {
		name := getString(user, "name")
		email := getString(user, "email")
		if name == "" || email == "" {
			errors++
			continue
		}

		var exists bool
		pc.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skaftin_system_users WHERE email = $1)`, email).Scan(&exists)
		if exists {
			skipped++
			continue
		}

		err := pc.Exec(ctx, `INSERT INTO skaftin_system_users (name, last_name, email, phone, metadata) VALUES ($1, $2, $3, $4, $5)`,
			name, getString(user, "last_name"), email, getString(user, "phone"), getMap(user, "metadata"))
		if err != nil {
			errors++
			continue
		}
		created++
	}

	return textResult(map[string]any{
		"success": true,
		"message": fmt.Sprintf("%d users created, %d skipped, %d errors", created, skipped, errors),
		"created": created, "skipped": skipped, "errors": errors,
	})
}

func (b *bulkTools) executeBatchOperations(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	operations := getMapSlice(args, "operations")
	if len(operations) == 0 {
		return errorResult("operations array is required")
	}

	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var results []map[string]any
	for i, op := range operations {
		opType := getString(op, "type")
		data := getMap(op, "data")
		result := map[string]any{"index": i, "type": opType}

		switch opType {
		case "execute_sql":
			query := getString(data, "query")
			rows, err := pc.Query(ctx, query)
			if err != nil {
				result["error"] = err.Error()
			} else {
				result["data"] = collectRows(rows)
				result["success"] = true
				rows.Close()
			}
		case "insert_data":
			tableName := getString(data, "tableName")
			insertData := getMap(data, "data")
			columns, values, placeholders := buildInsertParts(insertData)
			query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`, tableName, strings.Join(columns, ", "), strings.Join(placeholders, ", "))
			rows, err := pc.Query(ctx, query, values...)
			if err != nil {
				result["error"] = err.Error()
			} else {
				result["data"] = collectRows(rows)
				result["success"] = true
				rows.Close()
			}
		default:
			result["error"] = fmt.Sprintf("Unknown operation type: %s", opType)
		}
		results = append(results, result)
	}

	return textResult(map[string]any{"results": results, "total": len(results)})
}

func (b *bulkTools) migrateTableToUsers(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Table-to-users migration is a complex operation. Use the HTTP API at /api/bulk/:projectId/migrate-to-users for full support including password hashing and role assignment."})
}

func (b *bulkTools) createMigrationJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	pc.Exec(ctx, `CREATE TABLE IF NOT EXISTS migration_jobs (
		id SERIAL PRIMARY KEY, job_name VARCHAR(255), job_type VARCHAR(50),
		status VARCHAR(20) DEFAULT 'running', total_records INT, processed INT DEFAULT 0,
		created INT DEFAULT 0, skipped INT DEFAULT 0, errors INT DEFAULT 0,
		metadata JSONB, started_at TIMESTAMP DEFAULT NOW(), completed_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT NOW())`)

	rows, err := pc.Query(ctx, `INSERT INTO migration_jobs (job_name, job_type, total_records, metadata) VALUES ($1, $2, $3, $4) RETURNING *`,
		getString(args, "jobName"), getString(args, "jobType"), getInt(args, "totalRecords", 0), getMap(args, "metadata"))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "job": collectRows(rows)})
}

func (b *bulkTools) updateMigrationJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var setClauses []string
	var qArgs []any
	idx := 1

	for _, f := range []string{"processed", "created", "skipped", "errors"} {
		if v := getInt(args, f, -1); v >= 0 {
			setClauses = append(setClauses, fmt.Sprintf(`%s = $%d`, f, idx))
			qArgs = append(qArgs, v)
			idx++
		}
	}
	if s := getString(args, "status"); s != "" {
		setClauses = append(setClauses, fmt.Sprintf(`status = $%d`, idx))
		qArgs = append(qArgs, s)
		idx++
		if s == "completed" || s == "failed" {
			setClauses = append(setClauses, "completed_at = NOW()")
		}
	}
	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}

	qArgs = append(qArgs, jobId)
	query := fmt.Sprintf(`UPDATE migration_jobs SET %s WHERE id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx)
	rows, err := pc.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "job": collectRows(rows)})
}

func (b *bulkTools) getMigrationJob(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	jobId := getString(args, "jobId")
	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	rows, err := pc.Query(ctx, `SELECT * FROM migration_jobs WHERE id = $1`, jobId)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Migration job not found")
	}
	return textResult(result[0])
}

func (b *bulkTools) validateMigrationData(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	sourceTable := getString(args, "sourceTable")
	validation := getMap(args, "validation")
	if sourceTable == "" || validation == nil {
		return errorResult("sourceTable and validation are required")
	}

	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	var issues []map[string]any

	if reqCols := getStringSlice(validation, "requiredColumns"); len(reqCols) > 0 {
		for _, col := range reqCols {
			var nullCount int
			pc.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s" WHERE "%s" IS NULL OR "%s"::text = ''`, sourceTable, col, col)).Scan(&nullCount)
			if nullCount > 0 {
				issues = append(issues, map[string]any{"column": col, "issue": "null_or_empty", "count": nullCount, "severity": "error"})
			}
		}
	}

	var totalRows int
	pc.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, sourceTable)).Scan(&totalRows)

	return textResult(map[string]any{
		"valid":      len(issues) == 0,
		"totalRows":  totalRows,
		"issues":     issues,
		"issueCount": len(issues),
	})
}

func (b *bulkTools) findOrCreateUser(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	lookup := getMap(args, "lookup")
	if lookup == nil {
		return errorResult("lookup is required")
	}

	pc, err := b.acquireConn(ctx, args)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer pc.Release()

	email := getString(lookup, "email")
	phone := getString(lookup, "phone")

	var clauses []string
	var qArgs []any
	idx := 1
	if email != "" {
		clauses = append(clauses, fmt.Sprintf(`email = $%d`, idx))
		qArgs = append(qArgs, email)
		idx++
	}
	if phone != "" {
		clauses = append(clauses, fmt.Sprintf(`phone = $%d`, idx))
		qArgs = append(qArgs, phone)
	}
	if len(clauses) == 0 {
		return errorResult("At least one of email or phone is required in lookup")
	}

	rows, err := pc.Query(ctx, `SELECT * FROM skaftin_system_users WHERE `+strings.Join(clauses, " OR "), qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)

	if len(result) > 0 {
		return textResult(map[string]any{"user": result[0], "created": false})
	}

	createData := getMap(args, "createData")
	if createData == nil {
		return errorResult("User not found and no createData provided")
	}

	insertRows, err := pc.Query(ctx, `INSERT INTO skaftin_system_users (name, email, phone) VALUES ($1, $2, $3) RETURNING *`,
		getString(createData, "name"), getString(createData, "email"), getString(createData, "phone"))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to create user: %v", err))
	}
	defer insertRows.Close()
	newResult := collectRows(insertRows)
	if len(newResult) == 0 {
		return errorResult("Failed to create user")
	}
	return textResult(map[string]any{"user": newResult[0], "created": true})
}
