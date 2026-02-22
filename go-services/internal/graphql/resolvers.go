package graphql

import (
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	gql "github.com/graphql-go/graphql"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/dbproxy"
	"github.com/skaftin/go-services/internal/pkg/encryption"
)

// Resolver holds shared state for all GraphQL resolvers.
type Resolver struct {
	pool  *pgxpool.Pool
	store *dbproxy.Store
}

func NewResolver(pool *pgxpool.Pool) *Resolver {
	return &Resolver{pool: pool, store: dbproxy.NewStore(pool)}
}

// acquireConn is a shorthand for acquiring a project connection from args.
func (r *Resolver) acquireConn(p gql.ResolveParams) (*dbproxy.ProjectConn, error) {
	projectID, _ := p.Args["projectId"].(int)
	if projectID <= 0 {
		return nil, fmt.Errorf("invalid projectId")
	}
	return r.store.AcquireProjectConn(p.Context, projectID)
}

func (r *Resolver) projectID(p gql.ResolveParams) int {
	id, _ := p.Args["projectId"].(int)
	return id
}

// getEncryptionKey returns the field encryption key for a project, or an error if needed but missing.
func (r *Resolver) getEncryptionKey(p gql.ResolveParams, projectID int) (string, error) {
	key, err := encryption.GetProjectFieldEncryptionKey(p.Context, r.pool, projectID)
	if err != nil {
		return "", fmt.Errorf("failed to get encryption key: %w", err)
	}
	if key == "" {
		return "", fmt.Errorf("No encryption key / secret found")
	}
	return key, nil
}

// --- helpers ---

// collectRows reads pgx.Rows into []map[string]any using field descriptors.
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

func getStringSlice(args map[string]any, key string) []string {
	val, ok := args[key]
	if !ok || val == nil {
		return nil
	}
	if arr, ok := val.([]any); ok {
		out := make([]string, 0, len(arr))
		for _, v := range arr {
			if s, ok := v.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func toMapAny(val any) map[string]any {
	if m, ok := val.(map[string]any); ok {
		return m
	}
	return nil
}

// buildQueryFields constructs the Query root type with all resolver bindings.
func (r *Resolver) buildQueryFields() gql.Fields {
	return gql.Fields{
		"tables": &gql.Field{
			Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(tableType))),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
			},
			Resolve: r.resolveTables,
		},
		"tableSchema": &gql.Field{
			Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(columnType))),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveTableSchema,
		},
		"queryTable": &gql.Field{
			Type: gql.NewNonNull(queryResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"columns":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
				"where":     &gql.ArgumentConfig{Type: jsonScalar},
				"limit":     &gql.ArgumentConfig{Type: gql.Int},
				"offset":    &gql.ArgumentConfig{Type: gql.Int},
				"orderBy":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(orderByInput))},
				"decrypt":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
			},
			Resolve: r.resolveQueryTable,
		},
		"executeQuery": &gql.Field{
			Type: gql.NewNonNull(queryResultType),
			Args: gql.FieldConfigArgument{
				"projectId":  &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"query":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"parameters": &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(jsonScalar))},
			},
			Resolve: r.resolveExecuteQuery,
		},
		"tableConstraints": &gql.Field{
			Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(constraintType))),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveTableConstraints,
		},
		"tableForeignKeys": &gql.Field{
			Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(constraintType))),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveTableForeignKeys,
		},
	}
}

// buildMutationFields constructs the Mutation root type with all resolver bindings.
func (r *Resolver) buildMutationFields() gql.Fields {
	return gql.Fields{
		"createTable": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"input":     &gql.ArgumentConfig{Type: gql.NewNonNull(createTableInput)},
			},
			Resolve: r.resolveCreateTable,
		},
		"insertData": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"data":      &gql.ArgumentConfig{Type: gql.NewNonNull(jsonScalar)},
				"encrypt":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
				"decrypt":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
			},
			Resolve: r.resolveInsertData,
		},
		"bulkInsertData": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"dataArray": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(jsonScalar)))},
				"encrypt":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
			},
			Resolve: r.resolveBulkInsertData,
		},
		"updateData": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"data":      &gql.ArgumentConfig{Type: gql.NewNonNull(jsonScalar)},
				"where":     &gql.ArgumentConfig{Type: gql.NewNonNull(jsonScalar)},
				"encrypt":   &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
			},
			Resolve: r.resolveUpdateData,
		},
		"deleteData": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"where":     &gql.ArgumentConfig{Type: gql.NewNonNull(jsonScalar)},
			},
			Resolve: r.resolveDeleteData,
		},
		"dropTable": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveDropTable,
		},
		"renameTable": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId":    &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName":    &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"newTableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveRenameTable,
		},
		"addColumn": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"input":     &gql.ArgumentConfig{Type: gql.NewNonNull(addColumnInput)},
			},
			Resolve: r.resolveAddColumn,
		},
		"dropColumn": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId":  &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName":  &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"columnName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveDropColumn,
		},
		"createForeignKey": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"input":     &gql.ArgumentConfig{Type: gql.NewNonNull(createForeignKeyInput)},
			},
			Resolve: r.resolveCreateForeignKey,
		},
		"dropConstraint": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"constraintName": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
			},
			Resolve: r.resolveDropConstraint,
		},
		"createUniqueConstraint": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"tableName":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"columnName":     &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"constraintName": &gql.ArgumentConfig{Type: gql.String},
			},
			Resolve: r.resolveCreateUniqueConstraint,
		},
		"executeMutation": &gql.Field{
			Type: gql.NewNonNull(mutationResultType),
			Args: gql.FieldConfigArgument{
				"projectId":  &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Int)},
				"query":      &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				"parameters": &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(jsonScalar))},
			},
			Resolve: r.resolveExecuteMutation,
		},
	}
}

// ============================================================================
// Query resolvers
// ============================================================================

func (r *Resolver) resolveTables(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	return r.store.ListTables(p.Context, pc, false)
}

func (r *Resolver) resolveTableSchema(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	cols, err := r.store.GetTableSchema(p.Context, pc, tableName)
	if err != nil {
		return nil, err
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("Table not found")
	}
	return cols, nil
}

func (r *Resolver) resolveQueryTable(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	projectID := r.projectID(p)
	tableName, _ := p.Args["tableName"].(string)
	columns := getStringSlice(p.Args, "columns")
	where := toMapAny(p.Args["where"])
	limit := 100
	if l, ok := p.Args["limit"].(int); ok {
		limit = l
	}
	offset := 0
	if o, ok := p.Args["offset"].(int); ok {
		offset = o
	}
	decryptFields := getStringSlice(p.Args, "decrypt")

	var encKey string
	if len(decryptFields) > 0 {
		encKey, err = r.getEncryptionKey(p, projectID)
		if err != nil {
			return nil, err
		}
	}

	selectClause := "*"
	if len(columns) > 0 {
		quoted := make([]string, len(columns))
		for i, c := range columns {
			quoted[i] = fmt.Sprintf(`"%s"`, c)
		}
		selectClause = strings.Join(quoted, ", ")
	}

	query := fmt.Sprintf(`SELECT %s FROM "%s"`, selectClause, tableName)
	var values []any

	if len(where) > 0 {
		var clauses []string
		for col, val := range where {
			values = append(values, val)
			clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, col, len(values)))
		}
		query += " WHERE " + strings.Join(clauses, " AND ")
	}

	if orderByRaw, ok := p.Args["orderBy"]; ok && orderByRaw != nil {
		if orderByArr, ok := orderByRaw.([]any); ok && len(orderByArr) > 0 {
			var orderClauses []string
			for _, item := range orderByArr {
				if ob, ok := item.(map[string]any); ok {
					field, _ := ob["field"].(string)
					dir, _ := ob["direction"].(string)
					if field != "" {
						orderClauses = append(orderClauses, fmt.Sprintf(`"%s" %s`, field, dir))
					}
				}
			}
			if len(orderClauses) > 0 {
				query += " ORDER BY " + strings.Join(orderClauses, ", ")
			}
		}
	}

	values = append(values, limit)
	query += fmt.Sprintf(" LIMIT $%d", len(values))

	if offset > 0 {
		values = append(values, offset)
		query += fmt.Sprintf(" OFFSET $%d", len(values))
	}

	startTime := time.Now()
	rows, err := pc.Query(p.Context, query, values...)
	if err != nil {
		return nil, fmt.Errorf("Failed to query table: %w", err)
	}
	defer rows.Close()

	fieldNames := make([]string, 0)
	for _, fd := range rows.FieldDescriptions() {
		fieldNames = append(fieldNames, fd.Name)
	}

	collected := collectRows(rows)
	execTime := float64(time.Since(startTime).Milliseconds())

	if len(decryptFields) > 0 && encKey != "" {
		if err := encryption.DecryptFieldsInRows(collected, decryptFields, encKey); err != nil {
			return nil, err
		}
	}

	wrappedRows := make([]map[string]any, len(collected))
	for i, row := range collected {
		wrappedRows[i] = map[string]any{"data": row}
	}

	return map[string]any{
		"rows":          wrappedRows,
		"rowCount":      len(collected),
		"columns":       fieldNames,
		"executionTime": execTime,
	}, nil
}

func (r *Resolver) resolveExecuteQuery(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	query, _ := p.Args["query"].(string)
	query = normalizeQuery(query)

	var params []any
	if rawParams, ok := p.Args["parameters"]; ok && rawParams != nil {
		if arr, ok := rawParams.([]any); ok {
			params = arr
		}
	}

	startTime := time.Now()
	rows, err := pc.Query(p.Context, query, params...)
	if err != nil {
		return nil, fmt.Errorf("Failed to execute query: %w", err)
	}
	defer rows.Close()

	fieldNames := make([]string, 0)
	for _, fd := range rows.FieldDescriptions() {
		fieldNames = append(fieldNames, fd.Name)
	}

	collected := collectRows(rows)
	execTime := float64(time.Since(startTime).Milliseconds())

	wrappedRows := make([]map[string]any, len(collected))
	for i, row := range collected {
		wrappedRows[i] = map[string]any{"data": row}
	}

	return map[string]any{
		"rows":          wrappedRows,
		"rowCount":      len(collected),
		"columns":       fieldNames,
		"executionTime": execTime,
	}, nil
}

func (r *Resolver) resolveTableConstraints(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	rows, err := pc.Query(p.Context, `
		SELECT
			tc.constraint_name,
			tc.constraint_type,
			kcu.column_name,
			ccu.table_name AS referenced_table_name,
			ccu.column_name AS referenced_column_name,
			rc.update_rule,
			rc.delete_rule,
			cc.check_clause
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
		return nil, fmt.Errorf("Failed to fetch constraints: %w", err)
	}
	defer rows.Close()

	return collectRows(rows), nil
}

func (r *Resolver) resolveTableForeignKeys(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	rows, err := pc.Query(p.Context, `
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ccu.table_name AS referenced_table_name,
			ccu.column_name AS referenced_column_name,
			rc.update_rule,
			rc.delete_rule
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		JOIN information_schema.referential_constraints AS rc
			ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
		WHERE tc.table_schema = current_schema()
			AND tc.table_name = $1
			AND tc.constraint_type = 'FOREIGN KEY'
		ORDER BY tc.constraint_name
	`, tableName)
	if err != nil {
		return nil, fmt.Errorf("Failed to fetch foreign keys: %w", err)
	}
	defer rows.Close()

	return collectRows(rows), nil
}

// ============================================================================
// Mutation resolvers
// ============================================================================

func (r *Resolver) resolveCreateTable(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	input := toMapAny(p.Args["input"])
	tableName, _ := input["tableName"].(string)
	columnsRaw, _ := input["columns"].([]any)

	if tableName == "" || len(columnsRaw) == 0 {
		return nil, fmt.Errorf("Table name and columns are required")
	}

	var colDefs []string
	var pkCols []string

	for _, cRaw := range columnsRaw {
		col, ok := cRaw.(map[string]any)
		if !ok {
			continue
		}
		name, _ := col["name"].(string)
		colType, _ := col["type"].(string)
		isPK, _ := col["primaryKey"].(bool)
		nullable, _ := col["nullable"].(bool)
		defaultVal, _ := col["defaultValue"].(string)

		def := fmt.Sprintf(`"%s" %s`, name, colType)
		if isPK || (!nullable && colType != "SERIAL" && colType != "BIGSERIAL") {
			def += " NOT NULL"
		}
		if defaultVal != "" && colType != "SERIAL" && colType != "BIGSERIAL" {
			def += " DEFAULT " + formatDefaultValue(defaultVal, colType)
		}
		colDefs = append(colDefs, def)
		if isPK {
			pkCols = append(pkCols, fmt.Sprintf(`"%s"`, name))
		}
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (%s`, tableName, strings.Join(colDefs, ", "))
	if len(pkCols) > 0 {
		sql += fmt.Sprintf(", PRIMARY KEY (%s)", strings.Join(pkCols, ", "))
	}
	sql += ")"

	if err := pc.Exec(p.Context, sql); err != nil {
		return nil, fmt.Errorf("Failed to create table: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf("Table %s created successfully", tableName),
		"data":    map[string]any{"tableName": tableName, "columns": len(columnsRaw)},
	}, nil
}

func (r *Resolver) resolveInsertData(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	projectID := r.projectID(p)
	tableName, _ := p.Args["tableName"].(string)
	data := toMapAny(p.Args["data"])
	encryptFields := getStringSlice(p.Args, "encrypt")
	decryptFields := getStringSlice(p.Args, "decrypt")

	if data == nil {
		return nil, fmt.Errorf("Data is required")
	}

	if len(encryptFields) > 0 {
		key, err := r.getEncryptionKey(p, projectID)
		if err != nil {
			return nil, err
		}
		if err := encryption.EncryptFieldsInData(data, encryptFields, key); err != nil {
			return nil, err
		}
	}

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

	rows, err := pc.Query(p.Context, query, values...)
	if err != nil {
		return nil, fmt.Errorf("Failed to insert data: %w", err)
	}
	defer rows.Close()

	collected := collectRows(rows)
	var row map[string]any
	if len(collected) > 0 {
		row = collected[0]
	}

	if len(decryptFields) > 0 && row != nil {
		key, err := r.getEncryptionKey(p, projectID)
		if err != nil {
			return nil, err
		}
		if err := encryption.DecryptFieldsInRow(row, decryptFields, key); err != nil {
			return nil, err
		}
	}

	return map[string]any{
		"success":  true,
		"message":  "Data inserted successfully",
		"data":     row,
		"rowCount": 1,
	}, nil
}

func (r *Resolver) resolveBulkInsertData(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	projectID := r.projectID(p)
	tableName, _ := p.Args["tableName"].(string)
	encryptFields := getStringSlice(p.Args, "encrypt")

	dataArrayRaw, _ := p.Args["dataArray"].([]any)
	if len(dataArrayRaw) == 0 {
		return nil, fmt.Errorf("Data array is required")
	}

	var encKey string
	if len(encryptFields) > 0 {
		encKey, err = r.getEncryptionKey(p, projectID)
		if err != nil {
			return nil, err
		}
	}

	var insertedRows []map[string]any
	for _, rawItem := range dataArrayRaw {
		data := toMapAny(rawItem)
		if data == nil {
			continue
		}

		if encKey != "" {
			if err := encryption.EncryptFieldsInData(data, encryptFields, encKey); err != nil {
				return nil, err
			}
		}

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

		rows, err := pc.Query(p.Context, query, values...)
		if err != nil {
			return nil, fmt.Errorf("Failed to bulk insert data: %w", err)
		}
		collected := collectRows(rows)
		rows.Close()
		if len(collected) > 0 {
			insertedRows = append(insertedRows, collected[0])
		}
	}

	return map[string]any{
		"success":  true,
		"message":  fmt.Sprintf("%d rows inserted successfully", len(insertedRows)),
		"data":     insertedRows,
		"rowCount": len(insertedRows),
	}, nil
}

func (r *Resolver) resolveUpdateData(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	projectID := r.projectID(p)
	tableName, _ := p.Args["tableName"].(string)
	data := toMapAny(p.Args["data"])
	where := toMapAny(p.Args["where"])
	encryptFields := getStringSlice(p.Args, "encrypt")

	if data == nil || where == nil {
		return nil, fmt.Errorf("Data and where clause are required")
	}
	if len(where) == 0 {
		return nil, fmt.Errorf("Where clause cannot be empty. At least one condition is required for safety.")
	}

	if len(encryptFields) > 0 {
		key, err := r.getEncryptionKey(p, projectID)
		if err != nil {
			return nil, err
		}
		if err := encryption.EncryptFieldsInData(data, encryptFields, key); err != nil {
			return nil, err
		}
	}

	var setClauses []string
	var values []any
	idx := 1
	for col, val := range data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		values = append(values, val)
		idx++
	}

	var whereClauses []string
	for col, val := range where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		values = append(values, val)
		idx++
	}

	query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s RETURNING *`,
		tableName, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))

	rows, err := pc.Query(p.Context, query, values...)
	if err != nil {
		return nil, fmt.Errorf("Failed to update data: %w", err)
	}
	defer rows.Close()

	collected := collectRows(rows)
	return map[string]any{
		"success":  true,
		"message":  fmt.Sprintf("%d row(s) updated successfully", len(collected)),
		"data":     collected,
		"rowCount": len(collected),
	}, nil
}

func (r *Resolver) resolveDeleteData(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	where := toMapAny(p.Args["where"])

	if where == nil || len(where) == 0 {
		return nil, fmt.Errorf("Where clause cannot be empty. At least one condition is required for safety.")
	}

	var clauses []string
	var values []any
	idx := 1
	for col, val := range where {
		clauses = append(clauses, fmt.Sprintf(`"%s" = $%d`, col, idx))
		values = append(values, val)
		idx++
	}

	query := fmt.Sprintf(`DELETE FROM "%s" WHERE %s RETURNING *`, tableName, strings.Join(clauses, " AND "))
	rows, err := pc.Query(p.Context, query, values...)
	if err != nil {
		return nil, fmt.Errorf("Failed to delete data: %w", err)
	}
	defer rows.Close()

	collected := collectRows(rows)
	return map[string]any{
		"success":  true,
		"message":  fmt.Sprintf("%d row(s) deleted successfully", len(collected)),
		"data":     map[string]any{"deletedCount": len(collected)},
		"rowCount": len(collected),
	}, nil
}

func (r *Resolver) resolveDropTable(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	if err := pc.Exec(p.Context, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tableName)); err != nil {
		return nil, fmt.Errorf("Failed to drop table: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf("Table %s dropped successfully", tableName),
	}, nil
}

func (r *Resolver) resolveRenameTable(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	newName, _ := p.Args["newTableName"].(string)

	if strings.TrimSpace(newName) == "" {
		return nil, fmt.Errorf("New table name is required")
	}

	nameRegex := regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	if !nameRegex.MatchString(newName) {
		return nil, fmt.Errorf("Table name must start with a letter or underscore and contain only letters, numbers, and underscores")
	}

	var exists bool
	pc.QueryRow(p.Context, `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_name = $1
		)
	`, newName).Scan(&exists)
	if exists {
		return nil, fmt.Errorf(`Table "%s" already exists`, newName)
	}

	if err := pc.Exec(p.Context, fmt.Sprintf(`ALTER TABLE "%s" RENAME TO "%s"`, tableName, newName)); err != nil {
		return nil, fmt.Errorf("Failed to rename table: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf(`Table renamed from "%s" to "%s" successfully`, tableName, newName),
		"data":    map[string]any{"oldName": tableName, "newName": newName},
	}, nil
}

func (r *Resolver) resolveAddColumn(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	input := toMapAny(p.Args["input"])

	columnName, _ := input["columnName"].(string)
	columnType, _ := input["columnType"].(string)
	nullable := true
	if n, ok := input["nullable"].(bool); ok {
		nullable = n
	}
	defaultVal, _ := input["defaultValue"].(string)

	if columnName == "" || columnType == "" {
		return nil, fmt.Errorf("Column name and type are required")
	}

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN "%s" %s`, tableName, columnName, columnType)
	if !nullable {
		sql += " NOT NULL"
	}
	if defaultVal != "" {
		sql += " DEFAULT " + formatDefaultValue(defaultVal, columnType)
	}

	if err := pc.Exec(p.Context, sql); err != nil {
		return nil, fmt.Errorf("Failed to add column: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf("Column %s added successfully", columnName),
		"data":    map[string]any{"columnName": columnName, "columnType": columnType},
	}, nil
}

func (r *Resolver) resolveDropColumn(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	columnName, _ := p.Args["columnName"].(string)

	if err := pc.Exec(p.Context, fmt.Sprintf(`ALTER TABLE "%s" DROP COLUMN IF EXISTS "%s"`, tableName, columnName)); err != nil {
		return nil, fmt.Errorf("Failed to drop column: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf("Column %s dropped successfully", columnName),
	}, nil
}

func (r *Resolver) resolveCreateForeignKey(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	input := toMapAny(p.Args["input"])

	columnName, _ := input["columnName"].(string)
	refTable, _ := input["referencedTable"].(string)
	refColumn, _ := input["referencedColumn"].(string)
	onDelete := "RESTRICT"
	if v, ok := input["onDelete"].(string); ok && v != "" {
		onDelete = v
	}
	onUpdate := "RESTRICT"
	if v, ok := input["onUpdate"].(string); ok && v != "" {
		onUpdate = v
	}

	if columnName == "" || refTable == "" || refColumn == "" {
		return nil, fmt.Errorf("Column name, referenced table, and referenced column are required")
	}

	validActions := map[string]bool{"RESTRICT": true, "CASCADE": true, "SET NULL": true, "SET DEFAULT": true, "NO ACTION": true}
	if !validActions[onDelete] || !validActions[onUpdate] {
		return nil, fmt.Errorf("Invalid referential action")
	}

	constraintName := fmt.Sprintf("fk_%s_%s_%s_%s", tableName, columnName, refTable, refColumn)
	constraintName = strings.ToLower(constraintName)

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY ("%s") REFERENCES "%s" ("%s") ON DELETE %s ON UPDATE %s`,
		tableName, constraintName, columnName, refTable, refColumn, onDelete, onUpdate)

	if err := pc.Exec(p.Context, sql); err != nil {
		return nil, fmt.Errorf("Failed to create foreign key: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": "Foreign key created successfully",
		"data": map[string]any{
			"constraintName":   constraintName,
			"tableName":        tableName,
			"columnName":       columnName,
			"referencedTable":  refTable,
			"referencedColumn": refColumn,
			"onDelete":         onDelete,
			"onUpdate":         onUpdate,
		},
	}, nil
}

func (r *Resolver) resolveDropConstraint(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	constraintName, _ := p.Args["constraintName"].(string)

	if err := pc.Exec(p.Context, fmt.Sprintf(`ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"`, tableName, constraintName)); err != nil {
		return nil, fmt.Errorf("Failed to drop constraint: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": fmt.Sprintf("Constraint %s dropped successfully", constraintName),
	}, nil
}

func (r *Resolver) resolveCreateUniqueConstraint(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	tableName, _ := p.Args["tableName"].(string)
	columnName, _ := p.Args["columnName"].(string)
	constraintName, _ := p.Args["constraintName"].(string)

	if columnName == "" {
		return nil, fmt.Errorf("Column name is required")
	}
	if constraintName == "" {
		constraintName = fmt.Sprintf("%s_%s_unique", tableName, columnName)
	}

	sql := fmt.Sprintf(`ALTER TABLE "%s" ADD CONSTRAINT "%s" UNIQUE ("%s")`, tableName, constraintName, columnName)
	if err := pc.Exec(p.Context, sql); err != nil {
		return nil, fmt.Errorf("Failed to create unique constraint: %w", err)
	}

	return map[string]any{
		"success": true,
		"message": "Unique constraint created successfully",
		"data": map[string]any{
			"constraintName": constraintName,
			"tableName":      tableName,
			"columnName":     columnName,
		},
	}, nil
}

func (r *Resolver) resolveExecuteMutation(p gql.ResolveParams) (any, error) {
	pc, err := r.acquireConn(p)
	if err != nil {
		return nil, err
	}
	defer pc.Release()

	query, _ := p.Args["query"].(string)
	var params []any
	if rawParams, ok := p.Args["parameters"]; ok && rawParams != nil {
		if arr, ok := rawParams.([]any); ok {
			params = arr
		}
	}

	rows, err := pc.Query(p.Context, query, params...)
	if err != nil {
		return nil, fmt.Errorf("Failed to execute mutation: %w", err)
	}
	defer rows.Close()

	collected := collectRows(rows)
	return map[string]any{
		"success":  true,
		"message":  "Mutation executed successfully",
		"data":     collected,
		"rowCount": len(collected),
	}, nil
}

// formatDefaultValue formats a column default value for PostgreSQL DDL.
func formatDefaultValue(val, colType string) string {
	pgFunctions := []string{"CURRENT_TIMESTAMP", "NOW()", "CURRENT_DATE", "CURRENT_TIME", "LOCALTIMESTAMP", "LOCALTIME"}
	upper := strings.ToUpper(val)
	for _, fn := range pgFunctions {
		if strings.Contains(upper, fn) {
			return val
		}
	}
	if strings.Contains(strings.ToUpper(colType), "INT") || strings.ToUpper(colType) == "BOOLEAN" {
		return val
	}
	escaped := strings.ReplaceAll(val, "'", "''")
	return fmt.Sprintf("'%s'", escaped)
}
