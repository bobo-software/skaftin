# Database Requests

All database endpoints are available at `/app-api/database`.

## Base URL
```
/app-api/database
```

## Authentication
All endpoints require either:
- `x-api-key` header with a valid API key
- `Authorization: Bearer <jwt-token>` header

---

## Table Operations

### 1. List Tables

Get all tables in the project schema.

**Endpoint:** `GET /app-api/database/tables`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Tables fetched successfully",
  "data": [
    {
      "table_name": "customers",
      "row_count": 150
    },
    {
      "table_name": "orders",
      "row_count": 500
    },
    {
      "table_name": "products",
      "row_count": 75
    }
  ]
}
```

---

### 2. Get Table Schema

Get the schema (columns) of a specific table.

**Endpoint:** `GET /app-api/database/tables/:tableName/schema`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
GET /app-api/database/tables/customers/schema
```

**Response:**
```json
{
  "success": true,
  "data": {
    "table_name": "customers",
    "columns": [
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
        "character_maximum_length": 255,
        "is_nullable": "NO"
      },
      {
        "column_name": "email",
        "data_type": "character varying",
        "character_maximum_length": 255,
        "is_nullable": "YES"
      },
      {
        "column_name": "created_at",
        "data_type": "timestamp without time zone",
        "is_nullable": "YES",
        "column_default": "now()"
      }
    ]
  }
}
```

---

### 3. Create Table

Create a new table.

**Endpoint:** `POST /app-api/database/tables/create`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "tableName": "products",
  "columns": [
    {
      "name": "id",
      "type": "SERIAL",
      "primaryKey": true
    },
    {
      "name": "name",
      "type": "VARCHAR(255)",
      "nullable": false
    },
    {
      "name": "price",
      "type": "DECIMAL(10,2)",
      "nullable": false
    },
    {
      "name": "description",
      "type": "TEXT",
      "nullable": true
    },
    {
      "name": "stock",
      "type": "INTEGER",
      "defaultValue": "0"
    },
    {
      "name": "created_at",
      "type": "TIMESTAMP",
      "defaultValue": "NOW()"
    }
  ]
}
```

| Column Property | Type | Description |
|-----------------|------|-------------|
| name | string | Column name |
| type | string | PostgreSQL data type |
| primaryKey | boolean | Is primary key |
| nullable | boolean | Allow NULL values |
| defaultValue | string | Default value expression |

**Response:**
```json
{
  "success": true,
  "message": "Table created successfully"
}
```

---

### 4. Rename Table

Rename an existing table.

**Endpoint:** `POST /app-api/database/tables/:tableName/rename`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "newName": "inventory"
}
```

---

### 5. Drop Table

Delete a table.

**Endpoint:** `DELETE /app-api/database/tables/:tableName`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
DELETE /app-api/database/tables/old_products
```

---

## Field encryption

You can encrypt sensitive fields (e.g. card numbers, expiry) at rest. The project must have a **field encryption key** set in the project Settings (Field encryption). Then use `encrypt` on write and `decrypt` on read.

- **Write:** Include `encrypt: ["field_a", "field_b"]` in insert/update payloads. Those fields in `data` are encrypted before being stored.
- **Read:** Include `decrypt: ["field_a", "field_b"]` in select payloads (or `decrypt` query param for GET). Those fields in the returned rows are decrypted.
- **Error:** If you use `encrypt` or `decrypt` and the project has no encryption key set, the API returns **400** with message: `No encryption key / secret found`.

Only fields present in `data` and listed in `encrypt` are encrypted; only fields listed in `decrypt` are decrypted in the response. Applies to **user database** (project tables) only, not system tables.

---

## Data Operations (CRUD)

### 6. Select Data (GET)

Query data from a table using GET parameters.

**Endpoint:** `GET /app-api/database/tables/:tableName/select`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| columns | string | Comma-separated column names (default: *) |
| where | string | JSON object for WHERE clause, e.g. `{"status":"active"}` |
| limit | number | Maximum rows to return |
| offset | number | Number of rows to skip |
| orderBy | string | Column to sort by |
| orderDirection | string | Sort direction: "ASC" or "DESC" |
| decrypt | string | Comma-separated field names to decrypt in the response (requires project field encryption key) |

**Example:**
```
GET /app-api/database/tables/customers/select?columns=id,name,email&limit=10&orderBy=created_at&orderDirection=DESC
```

**Example with decryption:**
```
GET /app-api/database/tables/payments/select?decrypt=user_card_number,user_card_expiry
```
Returns rows with `user_card_number` and `user_card_expiry` decrypted. If no encryption key is set for the project, returns 400 with `No encryption key / secret found`.

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [
      { "id": 1, "name": "John Doe", "email": "john@example.com" },
      { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
    ],
    "rowCount": 2
  }
}
```

---

### 7. Select Data (POST)

Query data with complex WHERE clauses.

**Endpoint:** `POST /app-api/database/tables/:tableName/select`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "columns": ["id", "name", "email", "created_at"],
  "where": {
    "is_active": true,
    "role": "customer"
  },
  "orderBy": "created_at",
  "orderDirection": "DESC",
  "limit": 50,
  "offset": 0,
  "decrypt": ["user_card_number", "user_card_expiry"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| columns | array | Columns to select (default: all) |
| where | object | Key-value pairs for WHERE clause |
| orderBy | string | Column to sort by |
| orderDirection | string | Sort direction: "ASC" or "DESC" |
| limit | number | Maximum rows to return |
| offset | number | Number of rows to skip |
| decrypt | array | Field names to decrypt in each row (requires project field encryption key). If key not set, returns 400 with `No encryption key / secret found`. |

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [...],
    "rowCount": 25,
    "totalCount": 150
  }
}
```

---

### 8. Insert Data

Insert a single row into a table.

**Endpoint:** `POST /app-api/database/tables/:tableName/insert`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "data": {
    "name": "New Product",
    "price": 29.99,
    "description": "A great product",
    "stock": 100,
    "user_card_number": "4111111111111111",
    "user_card_expiry": "12/28"
  },
  "encrypt": ["user_card_number", "user_card_expiry"],
  "decrypt": ["user_card_number", "user_card_expiry"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data | object | Key-value pairs for the row (required) |
| encrypt | array | Field names to encrypt before storing. Those fields in `data` are encrypted at rest. Requires project field encryption key; if not set, returns 400 with `No encryption key / secret found`. |
| decrypt | array | Field names to decrypt in the returned row. Optional; if present and key not set, returns 400. |

**Response:**
```json
{
  "success": true,
  "message": "Data inserted successfully",
  "data": {
    "id": 15,
    "name": "New Product",
    "price": 29.99,
    "description": "A great product",
    "stock": 100,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 9. Bulk Insert Data

Insert multiple rows at once.

**Endpoint:** `POST /app-api/database/tables/:tableName/bulk-insert`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "dataArray": [
    {
      "name": "Product A",
      "price": 19.99,
      "stock": 50
    },
    {
      "name": "Product B",
      "price": 39.99,
      "stock": 30
    },
    {
      "name": "Product C",
      "price": 9.99,
      "stock": 100
    }
  ],
  "encrypt": ["user_card_number", "user_card_expiry"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| dataArray | array | Array of row objects (required) |
| encrypt | array | Field names to encrypt before storing. Applied to each row. Requires project field encryption key; if not set, returns 400 with `No encryption key / secret found`. |

**Response:**
```json
{
  "success": true,
  "message": "3 rows inserted successfully",
  "data": {
    "inserted": 3,
    "rows": [...]
  }
}
```

---

### 10. Update Data

Update rows in a table.

**Endpoint:** `PUT /app-api/database/tables/:tableName/update`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "data": {
    "price": 24.99,
    "stock": 75,
    "user_card_expiry": "06/29"
  },
  "where": {
    "id": 15
  },
  "encrypt": ["user_card_expiry"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data | object | Key-value pairs of columns to update |
| where | object | Conditions to match rows (required) |
| encrypt | array | Field names to encrypt before storing. Those fields in `data` are encrypted at rest. Requires project field encryption key; if not set, returns 400 with `No encryption key / secret found`. |

**Response:**
```json
{
  "success": true,
  "message": "Data updated successfully",
  "data": {
    "rowCount": 1
  }
}
```

---

### 11. Delete Data

Delete rows from a table.

**Endpoint:** `DELETE /app-api/database/tables/:tableName/delete`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "where": {
    "id": 15
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data deleted successfully",
  "data": {
    "rowCount": 1
  }
}
```

---

## Column Operations

### 12. Add Column

Add a new column to a table.

**Endpoint:** `POST /app-api/database/tables/:tableName/columns`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "columnName": "category",
  "columnType": "VARCHAR(100)",
  "nullable": true,
  "defaultValue": "'General'"
}
```

---

### 13. Alter Column

Modify an existing column.

**Endpoint:** `PUT /app-api/database/tables/:tableName/columns/:columnName`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "newType": "VARCHAR(200)",
  "nullable": false,
  "defaultValue": "'Default Category'"
}
```

---

### 14. Drop Column

Remove a column from a table.

**Endpoint:** `DELETE /app-api/database/tables/:tableName/columns/:columnName`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

---

## Constraint Operations

### 15. List Constraints

Get all constraints for a table.

**Endpoint:** `GET /app-api/database/tables/:tableName/constraints`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "constraint_name": "products_pkey",
      "constraint_type": "PRIMARY KEY",
      "column_name": "id"
    },
    {
      "constraint_name": "products_name_unique",
      "constraint_type": "UNIQUE",
      "column_name": "name"
    },
    {
      "constraint_name": "products_category_fkey",
      "constraint_type": "FOREIGN KEY",
      "column_name": "category_id",
      "references_table": "categories",
      "references_column": "id"
    }
  ]
}
```

---

### 16. Create Foreign Key

Add a foreign key constraint.

**Endpoint:** `POST /app-api/database/tables/:tableName/constraints/foreign-key`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "columnName": "category_id",
  "referencesTable": "categories",
  "referencesColumn": "id",
  "onDelete": "CASCADE",
  "onUpdate": "CASCADE"
}
```

| Field | Type | Description |
|-------|------|-------------|
| columnName | string | Column in current table |
| referencesTable | string | Target table name |
| referencesColumn | string | Target column name |
| onDelete | string | CASCADE, RESTRICT, SET NULL, SET DEFAULT, NO ACTION |
| onUpdate | string | CASCADE, RESTRICT, SET NULL, SET DEFAULT, NO ACTION |

---

### 17. Create Unique Constraint

Add a unique constraint.

**Endpoint:** `POST /app-api/database/tables/:tableName/constraints/unique`

**Request Body:**
```json
{
  "columns": ["email"],
  "constraintName": "users_email_unique"
}
```

---

### 18. Create Primary Key

Add a primary key constraint.

**Endpoint:** `POST /app-api/database/tables/:tableName/constraints/primary-key`

**Request Body:**
```json
{
  "columns": ["id"]
}
```

---

### 19. Create Check Constraint

Add a check constraint.

**Endpoint:** `POST /app-api/database/tables/:tableName/constraints/check`

**Request Body:**
```json
{
  "constraintName": "price_positive",
  "expression": "price > 0"
}
```

---

### 20. Drop Constraint

Remove a constraint.

**Endpoint:** `DELETE /app-api/database/tables/:tableName/constraints/:constraintName`

---

## Raw SQL Query

### 21. Execute Query

Execute a raw SQL query.

**Endpoint:** `POST /app-api/database/query`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "query": "SELECT c.name, COUNT(o.id) as order_count FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.name ORDER BY order_count DESC LIMIT 10",
  "readonly": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| query | string | SQL query to execute |
| readonly | boolean | If true, only SELECT queries allowed (default: true) |

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [
      { "name": "John Doe", "order_count": 15 },
      { "name": "Jane Smith", "order_count": 12 }
    ],
    "rowCount": 10,
    "fields": [
      { "name": "name", "dataTypeID": 1043 },
      { "name": "order_count", "dataTypeID": 20 }
    ]
  }
}
```

---

## Import/Export

### 22. Import Database Dump

Import SQL dump into the database.

**Endpoint:** `POST /app-api/database/import`

**Request Body:**
```json
{
  "sql": "CREATE TABLE IF NOT EXISTS ...; INSERT INTO ..."
}
```

---

### 23. Export Database Dump

Export database as SQL dump.

**Endpoint:** `POST /app-api/database/export`

**Request Body:**
```json
{
  "tables": ["customers", "orders"],
  "includeData": true,
  "includeSchema": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sql": "-- PostgreSQL dump\nCREATE TABLE customers ..."
  }
}
```

---

## User Table Operations

Special endpoints for the system users table.

### 24. Select Users

Query users with WHERE clauses.

**Endpoint:** `POST /app-api/database/users/select`

**Request Body:**
```json
{
  "where": {
    "is_active": true
  },
  "columns": ["id", "name", "email"],
  "limit": 50
}
```

---

### 25. Create User via Database

Create a user directly in the database.

**Endpoint:** `POST /app-api/database/users/insert`

**Request Body:**
```json
{
  "data": {
    "name": "New User",
    "email": "newuser@example.com"
  }
}
```

---

### 26. Update User via Database

Update a user directly in the database.

**Endpoint:** `PUT /app-api/database/users/update`

**Request Body:**
```json
{
  "data": {
    "name": "Updated Name"
  },
  "where": {
    "id": 5
  }
}
```

---

### 27. Delete User via Database

Delete a user directly from the database.

**Endpoint:** `DELETE /app-api/database/users/delete`

**Request Body:**
```json
{
  "where": {
    "id": 5
  }
}
```
