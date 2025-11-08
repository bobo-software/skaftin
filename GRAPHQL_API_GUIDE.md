# GraphQL API Guide

## Overview

The Skaftin Platform now includes a powerful GraphQL API that provides comprehensive database querying and manipulation capabilities. The GraphQL endpoint allows you to perform all database operations using a flexible, type-safe query language.

## Endpoint

```
POST http://localhost:4006/api/graphql
```

## Features

- ✅ Query tables dynamically
- ✅ Execute raw SQL queries
- ✅ Create, read, update, and delete data
- ✅ Manage table schemas
- ✅ Handle constraints and foreign keys
- ✅ Type-safe queries with auto-completion
- ✅ Real-time updates via WebSocket events
- ✅ GraphQL introspection enabled

## GraphQL Playground

You can explore the API interactively using any GraphQL client:
- **Apollo Studio**: https://studio.apollographql.com/sandbox
- **GraphQL Playground**: Available as browser extension
- **Postman**: Built-in GraphQL support

Simply point your GraphQL client to: `http://localhost:4006/api/graphql`

## Example Queries

### 1. List All Tables in a Project

```graphql
query GetTables {
  tables(projectId: 1) {
    table_name
    table_schema
    table_type
  }
}
```

### 2. Get Table Schema

```graphql
query GetTableSchema {
  tableSchema(projectId: 1, tableName: "users") {
    column_name
    data_type
    is_nullable
    is_primary_key
    column_default
  }
}
```

### 3. Query Data from a Table

```graphql
query QueryTable {
  queryTable(
    projectId: 1
    tableName: "users"
    columns: ["id", "name", "email"]
    limit: 10
    offset: 0
  ) {
    rows {
      data
    }
    rowCount
    columns
    executionTime
  }
}
```

### 4. Query with WHERE Clause

```graphql
query QueryWithWhere {
  queryTable(
    projectId: 1
    tableName: "users"
    where: { email: "user@example.com" }
  ) {
    rows {
      data
    }
    rowCount
  }
}
```

### 5. Query with Ordering

```graphql
query QueryWithOrdering {
  queryTable(
    projectId: 1
    tableName: "users"
    orderBy: [
      { field: "created_at", direction: "DESC" }
    ]
    limit: 20
  ) {
    rows {
      data
    }
  }
}
```

### 6. Execute Raw SQL Query

```graphql
query ExecuteRawSQL {
  executeQuery(
    projectId: 1
    query: "SELECT * FROM users WHERE age > $1"
    parameters: [18]
  ) {
    rows {
      data
    }
    rowCount
    columns
    executionTime
  }
}
```

### 7. Get Table Constraints

```graphql
query GetConstraints {
  tableConstraints(projectId: 1, tableName: "users") {
    constraint_name
    constraint_type
    column_name
    referenced_table_name
    referenced_column_name
  }
}
```

### 8. Get Foreign Keys

```graphql
query GetForeignKeys {
  tableForeignKeys(projectId: 1, tableName: "orders") {
    constraint_name
    column_name
    referenced_table_name
    referenced_column_name
    update_rule
    delete_rule
  }
}
```

## Example Mutations

### 1. Create a New Table

```graphql
mutation CreateTable {
  createTable(
    projectId: 1
    input: {
      tableName: "products"
      columns: [
        {
          name: "id"
          type: "SERIAL"
          primaryKey: true
        }
        {
          name: "name"
          type: "VARCHAR(255)"
          nullable: false
        }
        {
          name: "price"
          type: "DECIMAL(10,2)"
          nullable: false
        }
        {
          name: "created_at"
          type: "TIMESTAMP"
          defaultValue: "CURRENT_TIMESTAMP"
        }
      ]
    }
  ) {
    success
    message
    data
  }
}
```

### 2. Insert Data

```graphql
mutation InsertData {
  insertData(
    projectId: 1
    tableName: "products"
    data: {
      name: "Widget"
      price: 29.99
    }
  ) {
    success
    message
    data
    rowCount
  }
}
```

### 3. Bulk Insert Data

```graphql
mutation BulkInsert {
  bulkInsertData(
    projectId: 1
    tableName: "products"
    dataArray: [
      { name: "Widget A", price: 19.99 }
      { name: "Widget B", price: 29.99 }
      { name: "Widget C", price: 39.99 }
    ]
  ) {
    success
    message
    rowCount
  }
}
```

### 4. Update Data

```graphql
mutation UpdateData {
  updateData(
    projectId: 1
    tableName: "products"
    data: {
      price: 24.99
    }
    where: {
      id: 1
    }
  ) {
    success
    message
    data
    rowCount
  }
}
```

### 5. Delete Data

```graphql
mutation DeleteData {
  deleteData(
    projectId: 1
    tableName: "products"
    where: {
      id: 1
    }
  ) {
    success
    message
    rowCount
  }
}
```

### 6. Add Column to Table

```graphql
mutation AddColumn {
  addColumn(
    projectId: 1
    tableName: "products"
    input: {
      columnName: "description"
      columnType: "TEXT"
      nullable: true
    }
  ) {
    success
    message
    data
  }
}
```

### 7. Drop Column

```graphql
mutation DropColumn {
  dropColumn(
    projectId: 1
    tableName: "products"
    columnName: "description"
  ) {
    success
    message
  }
}
```

### 8. Create Foreign Key

```graphql
mutation CreateForeignKey {
  createForeignKey(
    projectId: 1
    tableName: "orders"
    input: {
      columnName: "user_id"
      referencedTable: "users"
      referencedColumn: "id"
      onDelete: "CASCADE"
      onUpdate: "RESTRICT"
    }
  ) {
    success
    message
    data
  }
}
```

### 9. Create Unique Constraint

```graphql
mutation CreateUniqueConstraint {
  createUniqueConstraint(
    projectId: 1
    tableName: "users"
    columnName: "email"
    constraintName: "users_email_unique"
  ) {
    success
    message
    data
  }
}
```

### 10. Drop Constraint

```graphql
mutation DropConstraint {
  dropConstraint(
    projectId: 1
    tableName: "users"
    constraintName: "users_email_unique"
  ) {
    success
    message
  }
}
```

### 11. Rename Table

```graphql
mutation RenameTable {
  renameTable(
    projectId: 1
    tableName: "old_table_name"
    newTableName: "new_table_name"
  ) {
    success
    message
    data
  }
}
```

### 12. Drop Table

```graphql
mutation DropTable {
  dropTable(
    projectId: 1
    tableName: "temporary_table"
  ) {
    success
    message
  }
}
```

### 13. Execute Raw SQL Mutation

```graphql
mutation ExecuteRawMutation {
  executeMutation(
    projectId: 1
    query: "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1"
    parameters: [42]
  ) {
    success
    message
    rowCount
  }
}
```

## Complex Query Examples

### Fetching Complete Table Information

```graphql
query GetCompleteTableInfo {
  tables(projectId: 1) {
    table_name
  }
  
  users: tableSchema(projectId: 1, tableName: "users") {
    column_name
    data_type
    is_primary_key
  }
  
  userConstraints: tableConstraints(projectId: 1, tableName: "users") {
    constraint_name
    constraint_type
  }
}
```

### Batch Operations

```graphql
mutation BatchOperations {
  insert1: insertData(
    projectId: 1
    tableName: "products"
    data: { name: "Product A", price: 10.00 }
  ) {
    success
    data
  }
  
  insert2: insertData(
    projectId: 1
    tableName: "products"
    data: { name: "Product B", price: 20.00 }
  ) {
    success
    data
  }
  
  update: updateData(
    projectId: 1
    tableName: "products"
    data: { price: 15.00 }
    where: { name: "Product A" }
  ) {
    success
    rowCount
  }
}
```

## Variables in GraphQL

You can use variables to make your queries more dynamic:

```graphql
query GetTableData($projectId: Int!, $tableName: String!, $limit: Int) {
  queryTable(
    projectId: $projectId
    tableName: $tableName
    limit: $limit
  ) {
    rows {
      data
    }
    rowCount
  }
}
```

Variables:
```json
{
  "projectId": 1,
  "tableName": "users",
  "limit": 50
}
```

## Error Handling

GraphQL returns errors in a structured format:

```json
{
  "errors": [
    {
      "message": "Failed to query table",
      "extensions": {
        "code": "DATABASE_ERROR",
        "originalError": {
          "message": "relation \"invalid_table\" does not exist"
        }
      }
    }
  ]
}
```

Common error codes:
- `PROJECT_NOT_FOUND`: The specified project doesn't exist
- `TABLE_NOT_FOUND`: The specified table doesn't exist
- `DATABASE_ERROR`: Generic database error
- `BAD_USER_INPUT`: Invalid input parameters
- `CONFLICT`: Resource conflict (e.g., table name already exists)

## Authentication

The GraphQL endpoint respects the same authentication middleware as the REST API. Make sure to include authentication headers in your requests.

## WebSocket Integration

All mutations trigger WebSocket events that notify connected clients of database changes. This allows for real-time UI updates.

Event format:
```javascript
{
  type: 'database:change',
  projectId: '1',
  tableName: 'users',
  operation: 'insert',
  data: { ... }
}
```

## Performance Tips

1. **Use specific columns**: Instead of selecting all columns, specify only what you need
2. **Limit results**: Always use `limit` for queries that might return many rows
3. **Use parameters**: For raw SQL queries, use parameterized queries to prevent SQL injection
4. **Batch operations**: Use GraphQL's batching feature to combine multiple operations in one request

## Schema Introspection

You can query the GraphQL schema itself:

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      description
    }
  }
}
```

## Migration from REST API

If you're migrating from the REST API, here's a comparison:

| REST API | GraphQL API |
|----------|-------------|
| `GET /api/database/:projectId/tables` | `query { tables(projectId: 1) { ... } }` |
| `POST /api/database/:projectId/tables/:tableName/select` | `query { queryTable(projectId: 1, tableName: "...") { ... } }` |
| `POST /api/database/:projectId/tables/:tableName/insert` | `mutation { insertData(projectId: 1, tableName: "...", data: {...}) { ... } }` |
| `PUT /api/database/:projectId/tables/:tableName/update` | `mutation { updateData(projectId: 1, tableName: "...", data: {...}, where: {...}) { ... } }` |

## Best Practices

1. **Always specify projectId**: All operations require a project context
2. **Use meaningful query names**: Name your queries and mutations descriptively
3. **Handle errors gracefully**: Always check the `errors` array in the response
4. **Use fragments**: For repeated field selections, use GraphQL fragments
5. **Test with introspection**: Use schema introspection to discover available types and fields

## Conclusion

The GraphQL API provides a powerful, flexible alternative to the REST API for database operations. It allows you to request exactly the data you need, combine multiple operations in a single request, and benefit from strong typing and introspection.

For more information, explore the GraphQL schema using introspection tools or the GraphQL Playground.

