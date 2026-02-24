# GraphQL Setup Complete ✅

## Summary

GraphQL support has been successfully added to the Skaftin Platform! You can now query and manipulate your database using GraphQL alongside the existing REST API.

## What Was Added

### 1. **Dependencies**
- `@apollo/server` - Apollo Server v4 for GraphQL
- `graphql` - GraphQL core library
- `graphql-tag` - Template literal tag for GraphQL queries
- `@graphql-tools/schema` - Schema building utilities

### 2. **New Files Created**

#### GraphQL Core
- **`src/graphql/typeDefs.ts`** - GraphQL schema definitions with all types, queries, and mutations
- **`src/graphql/resolvers.ts`** - GraphQL resolvers that interact with PostgreSQL
- **`src/controllers/GraphQLController.ts`** - Controller for initializing and managing Apollo Server

#### MCP Tools (NEW!)
- **`go-services/internal/mcp/tools_graphql.go`** - GraphQL MCP tools for AI assistants

#### Documentation
- **`GRAPHQL_API_GUIDE.md`** - Comprehensive guide with examples for all operations
- **`graphql-examples.graphql`** - Ready-to-use example queries and mutations
- **`MCP_GRAPHQL_TOOLS.md`** - Complete MCP tools reference
- **`MCP_GRAPHQL_SUMMARY.md`** - MCP implementation summary

### 3. **Modified Files**
- **`src/Server.ts`** - Integrated GraphQL server initialization
- **`go-services/internal/mcp/server.go`** - Added GraphQL MCP tools
- **`package.json`** - Added new dependencies

## Features

### Queries
✅ List all tables in a project
✅ Get table schema with column details
✅ Query table data with filtering, ordering, pagination
✅ Execute raw SQL queries
✅ Get table constraints
✅ Get foreign key relationships
✅ GraphQL schema introspection

### Mutations
✅ Create tables
✅ Insert data (single and bulk)
✅ Update data
✅ Delete data
✅ Add/drop columns
✅ Rename tables
✅ Drop tables
✅ Create foreign keys
✅ Create unique constraints
✅ Drop constraints
✅ Execute raw SQL mutations

### Special Features
- **Custom Scalars**: JSON and DateTime types for flexible data handling
- **WebSocket Integration**: All mutations emit real-time events
- **Error Handling**: Comprehensive error codes and messages
- **Type Safety**: Full TypeScript support with proper typing
- **Authentication Ready**: Context includes user session information
- **Introspection Enabled**: Explore the API with GraphQL Playground

## API Endpoint

```
POST http://localhost:4006/api/graphql
```

## Quick Start

### 1. Start the Server

```bash
npm run dev
```

The GraphQL endpoint will be available at: `http://localhost:4006/api/graphql`

### 2. Test with GraphQL Client

**Option A: Apollo Studio Sandbox**
1. Go to https://studio.apollographql.com/sandbox
2. Enter the endpoint: `http://localhost:4006/api/graphql`
3. Start writing queries!

**Option B: Postman**
1. Create a new GraphQL request
2. Set URL to `http://localhost:4006/api/graphql`
3. Use the built-in GraphQL query editor

**Option C: cURL**
```bash
curl -X POST http://localhost:4006/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { tables(projectId: 1) { table_name } }"
  }'
```

### 3. Try Example Queries

Import the `graphql-examples.graphql` file into your GraphQL client, or copy queries from `GRAPHQL_API_GUIDE.md`.

## Example Usage

### Query Tables
```graphql
query {
  tables(projectId: 1) {
    table_name
    table_type
  }
}
```

### Insert Data
```graphql
mutation {
  insertData(
    projectId: 1
    tableName: "users"
    data: {
      name: "John Doe"
      email: "john@example.com"
    }
  ) {
    success
    message
    data
  }
}
```

### Query with Filters
```graphql
query {
  queryTable(
    projectId: 1
    tableName: "users"
    where: { status: "active" }
    limit: 10
    orderBy: [{ field: "created_at", direction: "DESC" }]
  ) {
    rows {
      data
    }
    rowCount
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           Express Application               │
├─────────────────────────────────────────────┤
│                                             │
│  REST API              GraphQL API          │
│  /api/database    →    /api/graphql        │
│                                             │
│  ┌──────────────┐     ┌──────────────┐    │
│  │ Database     │     │ GraphQL      │    │
│  │ Controller   │     │ Controller   │    │
│  └──────┬───────┘     └──────┬───────┘    │
│         │                     │             │
│         │    ┌───────────────┐│            │
│         └────┤   Pool (PG)   ├┘            │
│              └───────┬───────┘             │
│                      │                      │
└──────────────────────┼──────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   PostgreSQL   │
              │   Database     │
              └────────────────┘
```

## Benefits of GraphQL

1. **Flexible Queries**: Request exactly the data you need
2. **Single Endpoint**: All operations through `/api/graphql`
3. **Strong Typing**: Auto-complete and validation in GraphQL clients
4. **Batch Operations**: Combine multiple operations in one request
5. **Real-time Ready**: WebSocket integration for live updates
6. **Self-Documenting**: Built-in schema introspection

## Migration from REST

Both REST and GraphQL APIs are available:

| Feature | REST API | GraphQL API |
|---------|----------|-------------|
| Endpoint | Multiple endpoints | Single endpoint |
| Data fetching | Fixed response structure | Flexible queries |
| Over-fetching | Common | Eliminated |
| Batching | Manual | Built-in |
| Type safety | Manual validation | Built-in |

## MCP Integration (NEW!)

### GraphQL MCP Tools Available

The GraphQL API is now integrated with the MCP (Model Context Protocol) server, allowing AI assistants like Claude to interact with your database!

**15 MCP Tools Available:**
- `graphql_query` - Execute any GraphQL query
- `graphql_mutation` - Execute any GraphQL mutation
- `graphql_list_tables` - List all tables
- `graphql_get_table_schema` - Get table schema
- `graphql_query_table` - Query with filters
- `graphql_insert_data` - Insert data
- `graphql_bulk_insert` - Bulk insert
- `graphql_update_data` - Update data
- `graphql_delete_data` - Delete data
- `graphql_create_table` - Create tables
- `graphql_drop_table` - Drop tables
- `graphql_add_column` - Add columns
- `graphql_create_foreign_key` - Create foreign keys
- `graphql_get_constraints` - Get constraints
- `graphql_introspect_schema` - Schema introspection

**Documentation:**
- Complete guide: `MCP_GRAPHQL_TOOLS.md`
- Quick summary: `MCP_GRAPHQL_SUMMARY.md`

**Usage with Claude:**
```
User: "Show me all tables in project 1"
Claude: *Uses graphql_list_tables tool*
```

## Next Steps

1. ✅ GraphQL is now running!
2. 🤖 **NEW: Connect AI assistant** to use MCP tools
3. 📖 Read the full guide: `GRAPHQL_API_GUIDE.md`
4. 🧪 Try example queries: `graphql-examples.graphql`
5. 🔧 Explore MCP tools: `MCP_GRAPHQL_TOOLS.md`
6. 🔐 Add authentication middleware if needed
7. 📊 Monitor GraphQL queries in production
8. 🚀 Build your frontend with Apollo Client or similar

## Performance Considerations

- GraphQL queries are converted to optimized SQL
- Use `limit` and `offset` for pagination
- Select specific columns instead of `*` when possible
- Raw SQL queries support parameterization
- Connection pooling is handled by PostgreSQL pool

## Security

- All queries respect project-level isolation via schemas
- SQL injection protection through parameterized queries
- GraphQL validation prevents malicious queries
- Same authentication as REST API
- Rate limiting can be added via middleware

## Troubleshooting

### Server won't start
- Check that all dependencies are installed: `npm install`
- Verify PostgreSQL is running and accessible
- Check logs for specific error messages

### GraphQL queries fail
- Verify the projectId exists in the database
- Check that the table name is correct
- Ensure the project schema is set up properly
- Look at the error extensions for details

### Type errors
- Make sure TypeScript is compiled: `npm run dev`
- Check that all imports are correct
- Verify GraphQL schema syntax

## Additional Resources

- Apollo Server Documentation: https://www.apollographql.com/docs/apollo-server/
- GraphQL Learn: https://graphql.org/learn/
- GraphQL Best Practices: https://graphql.org/learn/best-practices/

## Support

For issues or questions:
1. Check the documentation in `GRAPHQL_API_GUIDE.md`
2. Review example queries in `graphql-examples.graphql`
3. Check server logs for error details
4. Use GraphQL Playground for schema exploration

---

**Status**: ✅ GraphQL Integration Complete
**Version**: 1.0.0
**Date**: November 8, 2025
**Endpoint**: `http://localhost:4006/api/graphql`

