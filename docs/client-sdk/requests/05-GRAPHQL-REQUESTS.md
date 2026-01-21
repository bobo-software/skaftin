# GraphQL Requests

GraphQL endpoint is available at `/api/graphql`.

## Endpoint
```
POST /api/graphql
```

## Authentication
GraphQL requests require SuperTokens session authentication (cookies).

## GraphQL Playground
Access the GraphQL Playground for interactive queries:
```
http://localhost:4006/api/graphql
```

---

## Query Structure

All GraphQL requests use POST with a JSON body:

```json
{
  "query": "...",
  "variables": { ... }
}
```

---

## Table Operations

### 1. List Tables

Get all tables for a project.

**Query:**
```graphql
query ListTables($projectId: Int!) {
  tables(projectId: $projectId) {
    table_name
    row_count
  }
}
```

**Variables:**
```json
{
  "projectId": 1
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:4006/api/graphql" \
  -H "Content-Type: application/json" \
  -b "sAccessToken=..." \
  -d '{
    "query": "query { tables(projectId: 1) { table_name row_count } }"
  }'
```

**Response:**
```json
{
  "data": {
    "tables": [
      { "table_name": "customers", "row_count": 150 },
      { "table_name": "orders", "row_count": 500 },
      { "table_name": "products", "row_count": 75 }
    ]
  }
}
```

---

### 2. Get Table Schema

Get column definitions for a table.

**Query:**
```graphql
query GetTableSchema($projectId: Int!, $tableName: String!) {
  tableSchema(projectId: $projectId, tableName: $tableName) {
    column_name
    data_type
    is_nullable
    column_default
    is_primary_key
    character_maximum_length
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers"
}
```

**Response:**
```json
{
  "data": {
    "tableSchema": [
      {
        "column_name": "id",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "nextval('customers_id_seq'::regclass)",
        "is_primary_key": true
      },
      {
        "column_name": "name",
        "data_type": "character varying",
        "is_nullable": "NO",
        "character_maximum_length": 255
      }
    ]
  }
}
```

---

## Data Operations

### 3. Select Data

Query data from a table with filtering, sorting, and pagination.

**Query:**
```graphql
query SelectData(
  $projectId: Int!
  $tableName: String!
  $columns: [String]
  $where: JSON
  $orderBy: [OrderByInput]
  $limit: Int
  $offset: Int
) {
  selectData(
    projectId: $projectId
    tableName: $tableName
    columns: $columns
    where: $where
    orderBy: $orderBy
    limit: $limit
    offset: $offset
  ) {
    rows
    rowCount
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers",
  "columns": ["id", "name", "email", "created_at"],
  "where": { "is_active": true },
  "orderBy": [{ "field": "created_at", "direction": "DESC" }],
  "limit": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "data": {
    "selectData": {
      "rows": [
        { "id": 1, "name": "John Doe", "email": "john@example.com", "created_at": "2024-01-15" },
        { "id": 2, "name": "Jane Smith", "email": "jane@example.com", "created_at": "2024-01-14" }
      ],
      "rowCount": 2
    }
  }
}
```

---

### 4. Insert Data

Insert a new row into a table.

**Mutation:**
```graphql
mutation InsertData($projectId: Int!, $tableName: String!, $data: JSON!) {
  insertData(projectId: $projectId, tableName: $tableName, data: $data) {
    success
    data
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers",
  "data": {
    "name": "New Customer",
    "email": "new@example.com",
    "phone": "+1234567890"
  }
}
```

**Response:**
```json
{
  "data": {
    "insertData": {
      "success": true,
      "data": {
        "id": 151,
        "name": "New Customer",
        "email": "new@example.com",
        "phone": "+1234567890",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    }
  }
}
```

---

### 5. Bulk Insert Data

Insert multiple rows at once.

**Mutation:**
```graphql
mutation BulkInsertData($projectId: Int!, $tableName: String!, $dataArray: [JSON!]!) {
  bulkInsertData(projectId: $projectId, tableName: $tableName, dataArray: $dataArray) {
    success
    insertedCount
    data
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "products",
  "dataArray": [
    { "name": "Product A", "price": 19.99 },
    { "name": "Product B", "price": 29.99 },
    { "name": "Product C", "price": 39.99 }
  ]
}
```

**Response:**
```json
{
  "data": {
    "bulkInsertData": {
      "success": true,
      "insertedCount": 3,
      "data": [...]
    }
  }
}
```

---

### 6. Update Data

Update existing rows in a table.

**Mutation:**
```graphql
mutation UpdateData($projectId: Int!, $tableName: String!, $data: JSON!, $where: JSON!) {
  updateData(projectId: $projectId, tableName: $tableName, data: $data, where: $where) {
    success
    rowCount
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers",
  "data": {
    "name": "John Updated",
    "email": "john.updated@example.com"
  },
  "where": {
    "id": 1
  }
}
```

**Response:**
```json
{
  "data": {
    "updateData": {
      "success": true,
      "rowCount": 1
    }
  }
}
```

---

### 7. Delete Data

Delete rows from a table.

**Mutation:**
```graphql
mutation DeleteData($projectId: Int!, $tableName: String!, $where: JSON!) {
  deleteData(projectId: $projectId, tableName: $tableName, where: $where) {
    success
    rowCount
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers",
  "where": {
    "id": 151
  }
}
```

**Response:**
```json
{
  "data": {
    "deleteData": {
      "success": true,
      "rowCount": 1
    }
  }
}
```

---

## Table Management

### 8. Create Table

Create a new table.

**Mutation:**
```graphql
mutation CreateTable($projectId: Int!, $tableName: String!, $columns: [ColumnInput!]!) {
  createTable(projectId: $projectId, tableName: $tableName, columns: $columns) {
    success
    message
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "orders",
  "columns": [
    { "name": "id", "type": "SERIAL", "primaryKey": true },
    { "name": "customer_id", "type": "INTEGER", "nullable": false },
    { "name": "total", "type": "DECIMAL(10,2)", "nullable": false },
    { "name": "status", "type": "VARCHAR(50)", "defaultValue": "'pending'" },
    { "name": "created_at", "type": "TIMESTAMP", "defaultValue": "NOW()" }
  ]
}
```

---

### 9. Drop Table

Delete a table.

**Mutation:**
```graphql
mutation DropTable($projectId: Int!, $tableName: String!) {
  dropTable(projectId: $projectId, tableName: $tableName) {
    success
    message
  }
}
```

---

### 10. Add Column

Add a column to an existing table.

**Mutation:**
```graphql
mutation AddColumn(
  $projectId: Int!
  $tableName: String!
  $columnName: String!
  $columnType: String!
  $nullable: Boolean
  $defaultValue: String
) {
  addColumn(
    projectId: $projectId
    tableName: $tableName
    columnName: $columnName
    columnType: $columnType
    nullable: $nullable
    defaultValue: $defaultValue
  ) {
    success
    message
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "customers",
  "columnName": "loyalty_points",
  "columnType": "INTEGER",
  "nullable": true,
  "defaultValue": "0"
}
```

---

## Constraints

### 11. Get Constraints

Get all constraints for a table.

**Query:**
```graphql
query GetConstraints($projectId: Int!, $tableName: String!) {
  constraints(projectId: $projectId, tableName: $tableName) {
    constraint_name
    constraint_type
    column_name
    references_table
    references_column
  }
}
```

---

### 12. Create Foreign Key

Add a foreign key constraint.

**Mutation:**
```graphql
mutation CreateForeignKey(
  $projectId: Int!
  $tableName: String!
  $columnName: String!
  $referencedTable: String!
  $referencedColumn: String!
  $onDelete: String
  $onUpdate: String
) {
  createForeignKey(
    projectId: $projectId
    tableName: $tableName
    columnName: $columnName
    referencedTable: $referencedTable
    referencedColumn: $referencedColumn
    onDelete: $onDelete
    onUpdate: $onUpdate
  ) {
    success
    message
  }
}
```

**Variables:**
```json
{
  "projectId": 1,
  "tableName": "orders",
  "columnName": "customer_id",
  "referencedTable": "customers",
  "referencedColumn": "id",
  "onDelete": "CASCADE",
  "onUpdate": "CASCADE"
}
```

---

## Input Types

### ColumnInput
```graphql
input ColumnInput {
  name: String!
  type: String!
  primaryKey: Boolean
  nullable: Boolean
  defaultValue: String
}
```

### OrderByInput
```graphql
input OrderByInput {
  field: String!
  direction: String!  # "ASC" or "DESC"
}
```

---

## Complete Example

Here's a complete example of querying customers with orders:

**Query:**
```graphql
query GetCustomersWithOrders($projectId: Int!) {
  customers: selectData(
    projectId: $projectId
    tableName: "customers"
    columns: ["id", "name", "email"]
    where: { is_active: true }
    orderBy: [{ field: "name", direction: "ASC" }]
    limit: 10
  ) {
    rows
    rowCount
  }
  
  recentOrders: selectData(
    projectId: $projectId
    tableName: "orders"
    columns: ["id", "customer_id", "total", "status", "created_at"]
    orderBy: [{ field: "created_at", direction: "DESC" }]
    limit: 5
  ) {
    rows
    rowCount
  }
}
```

**cURL:**
```bash
curl -X POST "http://localhost:4006/api/graphql" \
  -H "Content-Type: application/json" \
  -b "sAccessToken=your-session-token" \
  -d '{
    "query": "query GetCustomersWithOrders($projectId: Int!) { customers: selectData(projectId: $projectId, tableName: \"customers\", columns: [\"id\", \"name\", \"email\"], limit: 10) { rows rowCount } }",
    "variables": { "projectId": 1 }
  }'
```

---

## Error Handling

GraphQL errors are returned in the `errors` array:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Table 'nonexistent' does not exist",
      "locations": [{ "line": 1, "column": 1 }],
      "path": ["selectData"],
      "extensions": {
        "code": "TABLE_NOT_FOUND"
      }
    }
  ]
}
```
