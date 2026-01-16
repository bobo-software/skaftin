# Suggestions for Improving the SQL Script MCP Tool

Based on working with the `apply_migration` and `execute_sql` MCP tools, here are suggestions for improvement:

## Current Issues Encountered

1. **File Path Support**: The `apply_migration` tool doesn't support file paths, requiring SQL content to be passed as a string parameter. This limits handling large SQL scripts.

2. **Large Script Handling**: SQL scripts with 240+ INSERT statements (~83KB) are cumbersome to pass directly, requiring manual splitting.

3. **Error Handling**: Primary key violations stop execution without clear indication of which statement failed or how many succeeded.

4. **Transaction Management**: No explicit transaction control or rollback on partial failures.

5. **Batch Execution**: No built-in support for executing large scripts in manageable batches.

## Recommended Improvements

### 1. **File Path Support**
- **Enhancement**: Add support for file paths in `apply_migration`
- **Benefit**: Allows direct execution of large SQL files without loading entire content into memory
- **Example**: `apply_migration(projectId, filePath: "./insert_missing_vehicles.sql")`

### 2. **Automatic Batch Processing**
- **Enhancement**: Automatically split large SQL scripts into batches based on statement count or size
- **Benefit**: Handles large scripts seamlessly without manual intervention
- **Example**: `apply_migration(projectId, migrationFile: sql, options: { batchSize: 50 })`

### 3. **Conflict Handling Options**
- **Enhancement**: Add parameter for conflict resolution strategy
- **Options**: 
  - `skip` (ON CONFLICT DO NOTHING)
  - `update` (ON CONFLICT DO UPDATE)
  - `fail` (default - current behavior)
- **Benefit**: Prevents errors on duplicate inserts and provides more control
- **Example**: `apply_migration(projectId, migrationFile: sql, conflictStrategy: "skip")`

### 4. **Progress Reporting**
- **Enhancement**: Return detailed execution results including:
  - Number of statements executed
  - Number of rows affected
  - List of any errors with statement numbers
  - Execution time
- **Benefit**: Better visibility into what actually happened
- **Example**: 
  ```json
  {
    "success": true,
    "statementsExecuted": 240,
    "rowsAffected": 235,
    "conflicts": 5,
    "executionTime": "2.3s",
    "errors": []
  }
  ```

### 5. **Transaction Options**
- **Enhancement**: Add transaction control options
- **Options**:
  - `transaction: true/false` (default: true)
  - `rollbackOnError: true/false` (default: true)
  - `continueOnError: true/false` (default: false)
- **Benefit**: More control over error handling and atomicity
- **Example**: `apply_migration(projectId, migrationFile: sql, transaction: true, continueOnError: true)`

### 6. **Statement Validation**
- **Enhancement**: Pre-validate SQL before execution
- **Benefit**: Catch syntax errors early without database round-trip
- **Options**: `validate: true/false` (default: false for performance)

### 7. **Dry Run Mode**
- **Enhancement**: Add dry-run option to preview changes without executing
- **Benefit**: Safety check before making changes
- **Example**: `apply_migration(projectId, migrationFile: sql, dryRun: true)`

### 8. **Streaming/Chunked Execution**
- **Enhancement**: For very large scripts, stream execution in chunks with progress callbacks
- **Benefit**: Better memory usage and user feedback for long-running operations

### 9. **SQL Statement Splitting**
- **Enhancement**: Intelligent SQL statement parsing and splitting
- **Benefit**: Properly handles multi-statement scripts with complex syntax (stored procedures, triggers, etc.)
- **Consider**: Handle semicolons within string literals, comments, etc.

### 10. **Return Affected Rows**
- **Enhancement**: For SELECT statements or RETURNING clauses, return the actual data
- **Benefit**: Useful for verifying what was inserted/updated

## Implementation Priority

**High Priority:**
1. File path support
2. Conflict handling options
3. Progress reporting

**Medium Priority:**
4. Batch processing
5. Transaction options
6. Dry run mode

**Low Priority:**
7. Statement validation
8. Streaming execution
9. Advanced statement splitting

## Example Improved API

```typescript
mcp_skaftin_apply_migration({
  projectId: "xxx",
  migrationFile: "./large_script.sql",  // or SQL string
  options: {
    batchSize: 50,              // Auto-split into batches
    conflictStrategy: "skip",   // Handle duplicates
    transaction: true,          // Use transaction
    continueOnError: false,     // Stop on first error
    dryRun: false,              // Actually execute
    validate: true              // Pre-validate syntax
  }
})
```

## Alternative: Separate Tool for Large Scripts

Consider creating a dedicated `execute_large_sql` tool specifically designed for:
- Large file handling
- Automatic batching
- Progress reporting
- Conflict resolution
- Better error messages

This would keep `apply_migration` simple for typical use cases while providing a specialized tool for bulk operations.