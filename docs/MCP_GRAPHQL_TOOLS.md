# GraphQL MCP Tools Documentation

## Overview

The Skaftin MCP (Model Context Protocol) server now includes comprehensive GraphQL tools that allow AI assistants and other MCP clients to interact with your database using GraphQL queries and mutations.

## What are MCP Tools?

MCP tools are server-side functions that can be called by AI assistants (like Claude, ChatGPT, etc.) or other MCP clients to perform operations on your behalf. The GraphQL MCP tools provide a convenient way to execute GraphQL operations through the MCP protocol.

## Available GraphQL MCP Tools

### 1. `graphql_query`
Execute any GraphQL query against the database.

**Parameters:**
- `projectId` (number, required): Project ID to query
- `query` (string, required): GraphQL query string
- `variables` (object, optional): Variables for the query

**Example:**
```json
{
  "projectId": 1,
  "query": "query { tables(projectId: 1) { table_name table_type } }",
  "variables": {}
}
```

**Use Cases:**
- Fetch table information
- Query data with complex filters
- Get schema information
- Execute introspection queries

---

### 2. `graphql_mutation`
Execute any GraphQL mutation against the database.

**Parameters:**
- `projectId` (number, required): Project ID to mutate
- `mutation` (string, required): GraphQL mutation string
- `variables` (object, optional): Variables for the mutation

**Example:**
```json
{
  "projectId": 1,
  "mutation": "mutation { insertData(projectId: 1, tableName: \"users\", data: {name: \"John\", email: \"john@example.com\"}) { success data } }",
  "variables": {}
}
```

**Use Cases:**
- Insert, update, or delete data
- Create or modify tables
- Add columns or constraints
- Execute any data modification operation

---

### 3. `graphql_list_tables`
List all tables in a project.

**Parameters:**
- `projectId` (number, required): Project ID

**Example:**
```json
{
  "projectId": 1
}
```

**Response:**
```json
{
  "tables": [
    {
      "table_name": "users",
      "table_schema": "project_1",
      "table_type": "BASE TABLE"
    },
    {
      "table_name": "products",
      "table_schema": "project_1",
      "table_type": "BASE TABLE"
    }
  ]
}
```

---

### 4. `graphql_get_table_schema`
Get detailed schema information for a specific table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users"
}
```

**Response:**
```json
{
  "tableSchema": [
    {
      "column_name": "id",
      "data_type": "integer",
      "is_nullable": false,
      "is_primary_key": true,
      "column_default": "nextval('users_id_seq'::regclass)"
    },
    {
      "column_name": "name",
      "data_type": "character varying",
      "character_maximum_length": 255,
      "is_nullable": false,
      "is_primary_key": false
    }
  ]
}
```

---

### 5. `graphql_query_table`
Query data from a table with filtering, ordering, and pagination.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `columns` (array, optional): Specific columns to select
- `where` (object, optional): WHERE clause as key-value pairs
- `orderBy` (array, optional): Order by clause
- `limit` (number, optional): Maximum rows to return
- `offset` (number, optional): Number of rows to skip

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users",
  "columns": ["id", "name", "email"],
  "where": { "status": "active" },
  "orderBy": [{ "field": "created_at", "direction": "DESC" }],
  "limit": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "queryTable": {
    "rows": [
      { "data": { "id": 1, "name": "John", "email": "john@example.com" } },
      { "data": { "id": 2, "name": "Jane", "email": "jane@example.com" } }
    ],
    "rowCount": 2,
    "executionTime": 15.5
  }
}
```

---

### 6. `graphql_insert_data`
Insert a single row into a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `data` (object, required): Data to insert

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users",
  "data": {
    "name": "Alice",
    "email": "alice@example.com",
    "age": 30
  }
}
```

**Response:**
```json
{
  "insertData": {
    "success": true,
    "message": "Data inserted successfully",
    "data": {
      "id": 3,
      "name": "Alice",
      "email": "alice@example.com",
      "age": 30
    },
    "rowCount": 1
  }
}
```

---

### 7. `graphql_bulk_insert`
Insert multiple rows into a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `dataArray` (array, required): Array of data objects to insert

**Example:**
```json
{
  "projectId": 1,
  "tableName": "products",
  "dataArray": [
    { "name": "Widget A", "price": 19.99 },
    { "name": "Widget B", "price": 29.99 },
    { "name": "Widget C", "price": 39.99 }
  ]
}
```

**Response:**
```json
{
  "bulkInsertData": {
    "success": true,
    "message": "3 rows inserted successfully",
    "rowCount": 3
  }
}
```

---

### 8. `graphql_update_data`
Update data in a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `data` (object, required): Data to update
- `where` (object, required): WHERE condition

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users",
  "data": { "status": "inactive" },
  "where": { "id": 3 }
}
```

**Response:**
```json
{
  "updateData": {
    "success": true,
    "message": "1 row(s) updated successfully",
    "rowCount": 1
  }
}
```

---

### 9. `graphql_delete_data`
Delete data from a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `where` (object, required): WHERE condition

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users",
  "where": { "status": "inactive" }
}
```

**Response:**
```json
{
  "deleteData": {
    "success": true,
    "message": "1 row(s) deleted successfully",
    "rowCount": 1
  }
}
```

---

### 10. `graphql_create_table`
Create a new table with columns.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table to create
- `columns` (array, required): Array of column definitions

**Column Definition:**
- `name` (string, required): Column name
- `type` (string, required): Data type (e.g., "VARCHAR(255)", "INTEGER", "TEXT")
- `nullable` (boolean, optional): Whether column can be NULL
- `defaultValue` (string, optional): Default value
- `primaryKey` (boolean, optional): Whether this is a primary key

**Example:**
```json
{
  "projectId": 1,
  "tableName": "orders",
  "columns": [
    { "name": "id", "type": "SERIAL", "primaryKey": true },
    { "name": "user_id", "type": "INTEGER", "nullable": false },
    { "name": "total", "type": "DECIMAL(10,2)", "nullable": false },
    { "name": "status", "type": "VARCHAR(50)", "defaultValue": "pending" },
    { "name": "created_at", "type": "TIMESTAMP", "defaultValue": "CURRENT_TIMESTAMP" }
  ]
}
```

**Response:**
```json
{
  "createTable": {
    "success": true,
    "message": "Table orders created successfully",
    "data": { "tableName": "orders", "columns": 5 }
  }
}
```

---

### 11. `graphql_drop_table`
Drop a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table to drop

**Example:**
```json
{
  "projectId": 1,
  "tableName": "temporary_table"
}
```

**Response:**
```json
{
  "dropTable": {
    "success": true,
    "message": "Table temporary_table dropped successfully"
  }
}
```

---

### 12. `graphql_add_column`
Add a column to an existing table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `columnName` (string, required): Name of the column to add
- `columnType` (string, required): Data type
- `nullable` (boolean, optional): Whether column can be NULL
- `defaultValue` (string, optional): Default value

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users",
  "columnName": "phone",
  "columnType": "VARCHAR(20)",
  "nullable": true
}
```

**Response:**
```json
{
  "addColumn": {
    "success": true,
    "message": "Column phone added successfully",
    "data": { "columnName": "phone", "columnType": "VARCHAR(20)" }
  }
}
```

---

### 13. `graphql_create_foreign_key`
Create a foreign key constraint.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table
- `columnName` (string, required): Name of the column
- `referencedTable` (string, required): Referenced table name
- `referencedColumn` (string, required): Referenced column name
- `onDelete` (string, optional): ON DELETE action (CASCADE, RESTRICT, etc.)
- `onUpdate` (string, optional): ON UPDATE action

**Example:**
```json
{
  "projectId": 1,
  "tableName": "orders",
  "columnName": "user_id",
  "referencedTable": "users",
  "referencedColumn": "id",
  "onDelete": "CASCADE",
  "onUpdate": "RESTRICT"
}
```

**Response:**
```json
{
  "createForeignKey": {
    "success": true,
    "message": "Foreign key created successfully",
    "data": {
      "constraintName": "fk_orders_user_id_users_id",
      "tableName": "orders",
      "columnName": "user_id",
      "referencedTable": "users",
      "referencedColumn": "id",
      "onDelete": "CASCADE",
      "onUpdate": "RESTRICT"
    }
  }
}
```

---

### 14. `graphql_get_constraints`
Get all constraints for a table.

**Parameters:**
- `projectId` (number, required): Project ID
- `tableName` (string, required): Name of the table

**Example:**
```json
{
  "projectId": 1,
  "tableName": "users"
}
```

**Response:**
```json
{
  "tableConstraints": [
    {
      "constraint_name": "users_pkey",
      "constraint_type": "PRIMARY KEY",
      "column_name": "id"
    },
    {
      "constraint_name": "users_email_unique",
      "constraint_type": "UNIQUE",
      "column_name": "email"
    }
  ]
}
```

---

### 15. `graphql_introspect_schema`
Get the complete GraphQL schema for introspection.

**Parameters:**
- `includeDescriptions` (boolean, optional): Include field descriptions (default: true)

**Example:**
```json
{
  "includeDescriptions": true
}
```

**Response:**
Returns the complete GraphQL schema including all types, queries, and mutations.

---

## Usage with AI Assistants

### Claude Desktop Integration

AI assistants like Claude can use these tools to help you manage your database:

**Example Conversation:**
```
User: "Can you show me all tables in project 1?"

Claude: *Uses graphql_list_tables tool*
"Here are the tables in your project:
- users
- products
- orders
- categories"

User: "Insert a new user named Bob with email bob@example.com"

Claude: *Uses graphql_insert_data tool*
"I've successfully added Bob to the users table with email bob@example.com."

User: "Show me all active users"

Claude: *Uses graphql_query_table tool*
"Here are the active users: ..."
```

### Programmatic Usage

You can also use these tools programmatically through the MCP protocol:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
});

// Call a GraphQL MCP tool
const result = await client.callTool({
  name: 'graphql_list_tables',
  arguments: {
    projectId: 1
  }
});

console.log(result);
```

## Benefits of GraphQL MCP Tools

### 1. **Unified Interface**
- Single set of tools for all database operations
- Consistent response format
- Type-safe queries and mutations

### 2. **Powerful Querying**
- Complex filtering and ordering
- Flexible field selection
- Pagination support
- Raw SQL execution when needed

### 3. **AI-Friendly**
- Descriptive tool names and parameters
- Clear documentation for AI assistants
- Structured error messages
- Easy to compose complex operations

### 4. **Developer Experience**
- Same GraphQL API used by humans and AI
- Comprehensive error handling
- Real-time updates via WebSocket
- Full TypeScript support

## Comparison: Direct GraphQL vs MCP Tools

| Feature | Direct GraphQL API | GraphQL MCP Tools |
|---------|-------------------|-------------------|
| Access | HTTP POST to /api/graphql | MCP protocol |
| Authentication | Headers | MCP session |
| Use by AI | Requires HTTP client | Native MCP support |
| Error handling | GraphQL errors | MCP error format |
| Tool discovery | Schema introspection | MCP tool listing |
| Best for | Frontend apps | AI assistants, automation |

## Example Workflows

### Creating a Complete Database Schema

```json
// 1. Create users table
{
  "tool": "graphql_create_table",
  "args": {
    "projectId": 1,
    "tableName": "users",
    "columns": [
      { "name": "id", "type": "SERIAL", "primaryKey": true },
      { "name": "email", "type": "VARCHAR(255)", "nullable": false }
    ]
  }
}

// 2. Create orders table
{
  "tool": "graphql_create_table",
  "args": {
    "projectId": 1,
    "tableName": "orders",
    "columns": [
      { "name": "id", "type": "SERIAL", "primaryKey": true },
      { "name": "user_id", "type": "INTEGER", "nullable": false }
    ]
  }
}

// 3. Add foreign key
{
  "tool": "graphql_create_foreign_key",
  "args": {
    "projectId": 1,
    "tableName": "orders",
    "columnName": "user_id",
    "referencedTable": "users",
    "referencedColumn": "id",
    "onDelete": "CASCADE"
  }
}
```

### Data Analysis Workflow

```json
// 1. List all tables
{
  "tool": "graphql_list_tables",
  "args": { "projectId": 1 }
}

// 2. Get schema for specific table
{
  "tool": "graphql_get_table_schema",
  "args": { "projectId": 1, "tableName": "users" }
}

// 3. Query data with filters
{
  "tool": "graphql_query_table",
  "args": {
    "projectId": 1,
    "tableName": "users",
    "where": { "status": "active" },
    "orderBy": [{ "field": "created_at", "direction": "DESC" }],
    "limit": 100
  }
}

// 4. Get constraints
{
  "tool": "graphql_get_constraints",
  "args": { "projectId": 1, "tableName": "users" }
}
```

## Error Handling

All GraphQL MCP tools return structured errors:

```json
{
  "error": "Project not found",
  "extensions": {
    "code": "PROJECT_NOT_FOUND"
  }
}
```

Common error codes:
- `PROJECT_NOT_FOUND`: Project doesn't exist
- `TABLE_NOT_FOUND`: Table doesn't exist
- `DATABASE_ERROR`: Database operation failed
- `BAD_USER_INPUT`: Invalid parameters
- `CONFLICT`: Resource conflict

## Performance Considerations

- **Connection Pooling**: Uses existing PostgreSQL connection pool
- **Query Optimization**: Generates efficient SQL queries
- **Pagination**: Always use `limit` for large datasets
- **Caching**: GraphQL responses are not cached by default
- **Batch Operations**: Use bulk insert for multiple rows

## Security

- **Project Isolation**: All operations respect project-level schemas
- **SQL Injection Protection**: Parameterized queries prevent injection
- **Authentication**: Inherits MCP session authentication
- **Validation**: Input validation at GraphQL layer
- **Error Sanitization**: Sensitive data not exposed in errors

## Troubleshooting

### Tool not found
**Issue**: MCP client can't find GraphQL tools

**Solution**: 
- Restart MCP server
- Check that graphqlTools are registered in MCPServer.ts
- Verify tool names match exactly

### Database connection errors
**Issue**: Can't connect to database

**Solution**:
- Check PostgreSQL is running
- Verify project exists
- Check database credentials
- Review connection pool settings

### GraphQL syntax errors
**Issue**: Invalid GraphQL query

**Solution**:
- Use `graphql_introspect_schema` to see available fields
- Check query syntax against GraphQL spec
- Verify field names and types
- Use variables for complex inputs

## Next Steps

1. ✅ **MCP server is running** with GraphQL tools
2. 🤖 **Connect AI assistant** (e.g., Claude Desktop)
3. 🧪 **Test tools** with simple queries
4. 📊 **Build workflows** using multiple tools
5. 🔧 **Customize** tool behavior if needed

## Additional Resources

- **GraphQL API Guide**: `GRAPHQL_API_GUIDE.md`
- **Example Queries**: `graphql-examples.graphql`
- **MCP Protocol**: https://modelcontextprotocol.io/
- **GraphQL Spec**: https://spec.graphql.org/

---

**Status**: ✅ GraphQL MCP Tools Active
**Total Tools**: 15
**Integration**: Complete
**Documentation**: Comprehensive

