# GraphQL Database API - Quick Reference

## 🚀 Quick Start

### Start the Server
```bash
npm run dev
```

### GraphQL Endpoint
```
http://localhost:4006/api/graphql
```

### Test with Apollo Studio
1. Go to https://studio.apollographql.com/sandbox
2. Enter: `http://localhost:4006/api/graphql`
3. Start querying!

## 📊 Basic Examples

### Query Tables
```graphql
query {
  tables(projectId: 1) {
    table_name
  }
}
```

### Insert Data
```graphql
mutation {
  insertData(
    projectId: 1
    tableName: "users"
    data: { name: "John", email: "john@example.com" }
  ) {
    success
    data
  }
}
```

### Query Data
```graphql
query {
  queryTable(
    projectId: 1
    tableName: "users"
    limit: 10
  ) {
    rows { data }
    rowCount
  }
}
```

## 📚 Documentation

- **Complete Guide**: See `GRAPHQL_API_GUIDE.md`
- **Example Queries**: See `graphql-examples.graphql`
- **Setup Summary**: See `GRAPHQL_SETUP_COMPLETE.md`

## ✨ Features

✅ Full CRUD operations
✅ Dynamic table queries
✅ Raw SQL execution
✅ Schema management
✅ Constraints & foreign keys
✅ Real-time WebSocket events
✅ Type-safe queries
✅ GraphQL introspection

## 🔧 Files Added

```
src/
├── graphql/
│   ├── typeDefs.ts       # GraphQL schema definitions
│   └── resolvers.ts      # Query/mutation resolvers
└── controllers/
    └── GraphQLController.ts  # Apollo Server setup

GRAPHQL_API_GUIDE.md      # Complete documentation
graphql-examples.graphql  # Example queries
GRAPHQL_SETUP_COMPLETE.md # Setup summary
```

## 🎯 Common Operations

### List Tables
```graphql
query { tables(projectId: 1) { table_name } }
```

### Create Table
```graphql
mutation {
  createTable(projectId: 1, input: {
    tableName: "products"
    columns: [
      { name: "id", type: "SERIAL", primaryKey: true }
      { name: "name", type: "VARCHAR(255)", nullable: false }
    ]
  }) { success }
}
```

### Insert Multiple Rows
```graphql
mutation {
  bulkInsertData(
    projectId: 1
    tableName: "products"
    dataArray: [
      { name: "A", price: 10 }
      { name: "B", price: 20 }
    ]
  ) { success rowCount }
}
```

### Update Data
```graphql
mutation {
  updateData(
    projectId: 1
    tableName: "products"
    data: { price: 15 }
    where: { id: 1 }
  ) { success }
}
```

### Delete Data
```graphql
mutation {
  deleteData(
    projectId: 1
    tableName: "products"
    where: { id: 1 }
  ) { success }
}
```

## 🔍 Advanced Features

### Execute Raw SQL
```graphql
query {
  executeQuery(
    projectId: 1
    query: "SELECT * FROM users WHERE age > $1"
    parameters: [18]
  ) {
    rows { data }
  }
}
```

### Query with Ordering
```graphql
query {
  queryTable(
    projectId: 1
    tableName: "users"
    orderBy: [{ field: "created_at", direction: "DESC" }]
    limit: 20
  ) {
    rows { data }
  }
}
```

### Create Foreign Key
```graphql
mutation {
  createForeignKey(
    projectId: 1
    tableName: "orders"
    input: {
      columnName: "user_id"
      referencedTable: "users"
      referencedColumn: "id"
      onDelete: "CASCADE"
    }
  ) { success }
}
```

## 🛠️ GraphQL Clients

### Apollo Client (React)
```bash
npm install @apollo/client graphql
```

### urql (React)
```bash
npm install urql graphql
```

### graphql-request (Minimal)
```bash
npm install graphql-request graphql
```

## 📡 Real-time Updates

All mutations automatically emit WebSocket events:
```javascript
// WebSocket event format
{
  type: 'database:change',
  projectId: '1',
  tableName: 'users',
  operation: 'insert',
  data: { ... }
}
```

## 🔐 Authentication

GraphQL respects the same authentication middleware as REST API. Include auth headers in requests.

## 💡 Tips

1. Use GraphQL Playground for schema exploration
2. Request only the fields you need
3. Use variables for dynamic queries
4. Batch multiple operations in one request
5. Enable introspection in development

## 🐛 Troubleshooting

**GraphQL endpoint not found?**
- Check server is running: `npm run dev`
- Verify endpoint: `http://localhost:4006/api/graphql`

**Type errors in queries?**
- Use introspection to check available types
- Verify field names match your schema

**Database errors?**
- Check projectId exists
- Verify table name is correct
- Look at error extensions for details

## 📞 Support

- Full Documentation: `GRAPHQL_API_GUIDE.md`
- Example Queries: `graphql-examples.graphql`
- Setup Details: `GRAPHQL_SETUP_COMPLETE.md`

---

**Happy GraphQL Querying! 🎉**

