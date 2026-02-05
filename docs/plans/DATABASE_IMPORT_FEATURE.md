# PostgreSQL Database Dump Import Feature

## Overview

This document describes the PostgreSQL database dump import feature that has been integrated into the Skaftin platform. The feature allows users to import database dumps (SQL files) directly into their project schemas through both the frontend UI and backend API.

## Features Implemented

### 1. Backend Implementation

#### DatabaseController (`src/controllers/DatabaseController.ts`)

Added a new method `importDatabaseDump` that:
- Accepts SQL content as a string
- Optionally drops all existing tables before importing (with `dropExisting` flag)
- Executes SQL statements in a transaction (all-or-nothing approach)
- Parses and executes SQL statements sequentially
- Handles errors gracefully and provides detailed feedback
- Emits WebSocket events for real-time updates
- Returns success/error counts with detailed error messages

**Endpoint Details:**
- **Method:** POST
- **Path:** `/api/database/:projectId/import`
- **Body:**
  ```json
  {
    "sqlContent": "string (required)",
    "dropExisting": "boolean (optional, default: false)"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Database dump imported successfully",
    "data": {
      "successCount": 42,
      "errorCount": 0,
      "message": "Successfully executed 42 SQL statements"
    }
  }
  ```

#### DatabaseRouter (`src/routers/DatabaseRouter.ts`)

Added the import route:
```javascript
router.post('/:projectId/import', authenticateAndVerifyProject, DatabaseController.importDatabaseDump);
```

### 2. Frontend Implementation

#### API Routes (`frontend/src/constants/ApiRoutes.ts`)

Added new route:
```javascript
IMPORT_DUMP: (projectId: string) => `/api/database/${projectId}/import`
```

#### Database Store (`frontend/src/stores/data/useDatabaseStore.ts`)

Added `importDatabaseDump` method:
```typescript
importDatabaseDump: async (projectId: string, sqlContent: string, dropExisting: boolean) => Promise<{success: boolean, result?: any}>
```

This method:
- Sends the SQL content to the backend API
- Handles loading states
- Refreshes the tables list after successful import
- Returns success/failure status with results

#### DatabaseImportModal Component (`frontend/src/components/modals/DatabaseImportModal.tsx`)

A comprehensive modal component that provides:

**Features:**
- Two import methods:
  1. **File Upload**: Upload .sql files via click or drag-and-drop
  2. **Paste Content**: Directly paste SQL content into a textarea
- File validation (ensures .sql files are selected)
- Visual feedback for file selection
- Option to drop existing tables before import (with warning)
- Detailed information about the import process
- Error handling and display
- Loading states during import
- Responsive design with dark mode support

**UI Elements:**
- Upload method selector
- Drag-and-drop file upload area
- SQL content textarea for pasting
- Checkbox for "drop existing tables" option
- Warning messages for destructive operations
- Information box with import guidelines
- Error display area
- Import/Cancel action buttons

#### TableViewer Integration (`frontend/src/components/database/TableViewer.tsx`)

Integrated the import feature into the Table Viewer:
- Added "Import" button in the sidebar header (next to "Create" button)
- Implemented `handleDatabaseImport` function
- Added loading state management
- Integrated with toast notifications for user feedback
- Auto-refreshes tables list after successful import

### 3. User Experience Flow

1. **Access Import Feature:**
   - Navigate to Database → Table Viewer
   - Click the "Import" button in the sidebar

2. **Choose Import Method:**
   - Select either "Upload SQL File" or "Paste SQL Content"

3. **Provide SQL Content:**
   - **File Upload:** Click to browse or drag-and-drop a .sql file
   - **Paste Content:** Paste SQL statements directly into the textarea

4. **Configure Options:**
   - Optionally check "Drop existing tables before importing" (shows warning)
   - Review the information box about the import process

5. **Execute Import:**
   - Click "Import Database Dump"
   - Monitor progress with loading indicator
   - Receive success/error notifications via toast messages

6. **View Results:**
   - Tables list automatically refreshes
   - Success toast shows number of executed statements
   - Any errors are displayed in the modal

## Technical Details

### Transaction Safety

The import process uses PostgreSQL transactions:
```sql
BEGIN;
-- Execute SQL statements
COMMIT; -- or ROLLBACK on error
```

This ensures data integrity - either all statements succeed or none are applied.

### SQL Parsing

The backend splits SQL content by semicolons (`;`) and:
- Filters out empty statements
- Filters out comment-only lines (starting with `--`)
- Executes each statement sequentially
- Collects errors without stopping the process

### Error Handling

**Backend:**
- Catches and logs SQL execution errors
- Returns detailed error messages (first 10 errors)
- Rolls back transaction on critical failures

**Frontend:**
- Validates SQL content before sending
- Displays user-friendly error messages
- Maintains loading states
- Shows detailed feedback via toast notifications

### Security

- All requests require authentication (`authenticateAndVerifyProject` middleware)
- SQL execution is scoped to the project's schema
- No direct database access from frontend
- All operations are logged for audit purposes

## Use Cases

### 1. Initial Database Setup
Import a complete database schema when starting a new project:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Migration from Another System
Import data and schema from `pg_dump` output:
```bash
# Create dump on source system
pg_dump -U username -d source_db > database_dump.sql

# Import via Skaftin UI
# 1. Open Table Viewer
# 2. Click "Import"
# 3. Upload database_dump.sql
# 4. Execute import
```

### 3. Restore from Backup
Restore a previous database state:
- Export existing tables as backup
- Use "Drop existing tables" option
- Import backup SQL file

### 4. Load Sample Data
Import test data for development:
```sql
INSERT INTO users (username, email) VALUES
  ('john_doe', 'john@example.com'),
  ('jane_smith', 'jane@example.com');

INSERT INTO posts (user_id, title, content) VALUES
  (1, 'First Post', 'Hello, World!'),
  (2, 'Second Post', 'This is a test post.');
```

## Limitations and Considerations

### Current Limitations

1. **Large Files:** Very large SQL dumps (>100MB) may take several minutes to process
2. **Syntax:** SQL must be compatible with PostgreSQL syntax
3. **Schema Scope:** All operations are scoped to the project schema
4. **Error Recovery:** Partial imports (some statements fail) may require manual cleanup

### Best Practices

1. **Test First:** Test imports on a development project before production
2. **Backup:** Always backup existing data before using "Drop existing tables"
3. **Review SQL:** Review SQL content for correctness before importing
4. **Monitor Progress:** Watch for success/error messages during import
5. **Small Batches:** For large datasets, consider importing in smaller batches

### Performance Considerations

- Imports run synchronously - UI may be unresponsive during large imports
- Transactions ensure data consistency but may lock tables briefly
- WebSocket events notify all connected clients of changes

## Future Enhancements

Potential improvements for future versions:

1. **Async Processing:** Background job processing for large imports
2. **Progress Tracking:** Real-time progress indicators for long-running imports
3. **Validation:** Pre-import SQL validation and syntax checking
4. **Preview:** Show table/data preview before executing import
5. **Format Support:** Support for other dump formats (CSV, JSON, etc.)
6. **Scheduling:** Schedule imports for specific times
7. **Rollback:** One-click rollback to previous state after import
8. **Compression:** Support for compressed SQL files (.sql.gz)

## API Reference

### Import Database Dump

**Endpoint:** `POST /api/database/:projectId/import`

**Authentication:** Required (JWT token)

**Authorization:** User must have access to the specified project

**Request Body:**
```json
{
  "sqlContent": "CREATE TABLE users (id SERIAL PRIMARY KEY, ...);",
  "dropExisting": false
}
```

**Parameters:**
- `projectId` (path parameter): ID of the project to import into
- `sqlContent` (body, string, required): SQL statements to execute
- `dropExisting` (body, boolean, optional): Drop all existing tables before import (default: false)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Database dump imported successfully",
  "data": {
    "successCount": 42,
    "errorCount": 0,
    "message": "Successfully executed 42 SQL statements"
  }
}
```

**Success Response with Warnings (200):**
```json
{
  "success": true,
  "message": "Database dump imported with warnings",
  "data": {
    "successCount": 40,
    "errorCount": 2,
    "errors": [
      "Failed to execute statement: CREATE TABLE... Error: relation already exists",
      "Failed to execute statement: INSERT INTO... Error: foreign key constraint"
    ],
    "message": "Executed 40 statements, 2 failed"
  }
}
```

**Error Response (400, 404, 500):**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Testing

### Manual Testing Steps

1. **Basic Import:**
   - Create simple SQL file with CREATE TABLE statement
   - Import via UI
   - Verify table appears in Table Viewer

2. **Drop Existing:**
   - Create some tables manually
   - Import with "Drop existing tables" checked
   - Verify old tables are gone, new tables exist

3. **Error Handling:**
   - Import invalid SQL
   - Verify error messages appear
   - Verify transaction rollback (no partial changes)

4. **Large File:**
   - Import file with 1000+ INSERT statements
   - Verify all data is imported correctly
   - Check performance and loading indicators

5. **Paste Content:**
   - Use "Paste SQL Content" method
   - Paste multi-line SQL
   - Verify import works same as file upload

### Example Test SQL

```sql
-- Test Database Import
-- This file creates a simple blog schema

-- Drop existing tables if needed
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (username, email, full_name) VALUES
  ('alice', 'alice@example.com', 'Alice Johnson'),
  ('bob', 'bob@example.com', 'Bob Smith'),
  ('charlie', 'charlie@example.com', 'Charlie Brown');

INSERT INTO posts (user_id, title, content, published) VALUES
  (1, 'Getting Started with PostgreSQL', 'PostgreSQL is a powerful database...', true),
  (2, 'Database Design Best Practices', 'When designing a database schema...', true),
  (1, 'Draft Post', 'This is a draft post...', false);

INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, 'Great tutorial! Very helpful.'),
  (1, 3, 'Thanks for sharing!'),
  (2, 1, 'Excellent advice on normalization.');
```

## Troubleshooting

### Common Issues

**Issue:** "SQL content is required" error
- **Solution:** Ensure you've uploaded a file or pasted SQL content

**Issue:** Import fails with "relation already exists"
- **Solution:** Use "Drop existing tables" option or manually drop conflicting tables

**Issue:** Large file import times out
- **Solution:** Break into smaller batches or contact support for timeout adjustment

**Issue:** Foreign key constraint violations
- **Solution:** Ensure tables are created in correct order (parent tables first)

**Issue:** Syntax errors in SQL
- **Solution:** Validate SQL syntax is PostgreSQL-compatible before importing

## Support

For issues or questions about the database import feature:
1. Check this documentation
2. Review error messages in the UI
3. Check browser console for detailed errors
4. Contact support with error details and SQL file (if possible)

## Changelog

### Version 1.0 (Current)
- Initial implementation of database dump import
- Support for file upload and paste methods
- Transaction-based import with rollback
- Optional "drop existing tables" feature
- Real-time feedback and error reporting
- WebSocket event integration

