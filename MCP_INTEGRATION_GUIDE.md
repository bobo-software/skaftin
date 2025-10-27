# Skaftin MCP Integration for Cursor

This guide shows how to connect your Skaftin project to Cursor via MCP (Model Context Protocol).

## Prerequisites

1. A Skaftin project with API keys enabled
2. Cursor IDE
3. Node.js installed

## Setup Steps

### 1. Create an API Key

1. Open your Skaftin project in the browser
2. Go to Settings → API Keys tab
3. Click "Create API Key"
4. Give it a name (e.g., "Cursor Integration")
5. Set appropriate permissions:
   - Database: read, write, schema
   - Storage: read, write
   - Project: read
6. Copy the generated API key (you won't see it again!)

### 2. Configure Cursor

1. Open Cursor settings
2. Go to "Features" → "Model Context Protocol"
3. Add a new MCP server with this configuration:

```json
{
  "mcpServers": {
    "skaftin": {
      "command": "node",
      "args": ["/path/to/your/skaftin/src/backend/mcp-server.js"],
      "env": {
        "SKAFTIN_API_KEY": "your-api-key-here",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_USER": "postgres",
        "DB_PASSWORD": "your-db-password",
        "DB_NAME": "postgres"
      }
    }
  }
}
```

Replace `/path/to/your/skaftin` with your actual Skaftin project path.

### 3. Available MCP Tools

Once connected, you can use these tools in Cursor:

- `execute_sql`: Run SQL queries on your project database
- `list_tables`: List all tables in your project
- `create_table`: Create new tables
- `insert_data`: Insert data into tables
- `select_data`: Query data from tables

### 4. Usage Examples

In Cursor, you can now ask:

```
"Show me all tables in my Skaftin project"
"Create a users table with id, name, and email columns"
"Insert a new user with name 'John Doe' and email 'john@example.com'"
"Select all users from the users table"
"Run this SQL query: SELECT * FROM users WHERE name LIKE '%John%'"
```

### 5. Security Notes

- API keys are scoped to specific projects
- Keys can be revoked at any time
- All database operations are logged
- Keys expire based on your settings

### 6. Troubleshooting

- **Connection failed**: Check that your Skaftin backend is running
- **Invalid API key**: Verify the key is correct and not expired
- **Permission denied**: Check your API key permissions
- **Database error**: Ensure your database is accessible

## Advanced Configuration

For production use, consider:

1. Using environment variables for sensitive data
2. Setting up proper API key rotation
3. Implementing rate limiting
4. Adding audit logging

## Support

If you encounter issues:

1. Check the Cursor MCP logs
2. Verify your Skaftin backend logs
3. Test your API key manually via curl/Postman
4. Ensure all environment variables are set correctly
