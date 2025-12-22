# Proposed Generic MCP Tools for Migrations

This document proposes generic MCP tools that would make bulk migrations and user management easier across all applications using the Skaftin SDK.

## Current Limitations

Currently, the migration process requires:
- Creating users one-by-one (265 tool calls for 265 users)
- Manual batch processing in application code
- Manual error handling and retry logic
- Manual progress tracking

## Proposed Generic MCP Tools

### 1. Bulk User Creation

**Tool:** `mcp_skaftin_bulk_create_app_users`

**Purpose:** Create multiple app users in a single operation with built-in error handling.

**Signature:**
```typescript
mcp_skaftin_bulk_create_app_users({
  projectId: string;
  users: Array<{
    name: string;
    email: string;
    phone?: string | null;
    password: string;
    role_ids: number[];
    metadata?: Record<string, any>;
  }>;
  options?: {
    continueOnError?: boolean; // Default: true
    skipDuplicates?: boolean; // Default: true
    batchSize?: number; // Default: 50
  };
})
```

**Returns:**
```typescript
{
  success: boolean;
  created: number;
  skipped: number; // Duplicates or already exist
  errors: number;
  results: Array<{
    index: number;
    success: boolean;
    user_id?: number;
    error?: string;
    skipped_reason?: string; // 'duplicate_email' | 'duplicate_phone' | 'already_exists'
  }>;
}
```

**Benefits:**
- Single call for multiple users
- Built-in duplicate detection
- Automatic error handling
- Progress tracking
- Works for any user type (drivers, marshals, owners, etc.)

**Example Usage:**
```typescript
const result = await mcp_skaftin_bulk_create_app_users({
  projectId: "2",
  users: [
    {
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      password: "SecurePass123!",
      role_ids: [8],
      metadata: { association_id: 4, idNum: "123456" }
    },
    // ... 264 more users
  ],
  options: {
    continueOnError: true,
    skipDuplicates: true,
    batchSize: 50
  }
});
```

---

### 2. Batch Operations with Transaction Support

**Tool:** `mcp_skaftin_execute_batch_operations`

**Purpose:** Execute multiple operations in a single call, optionally within a transaction.

**Signature:**
```typescript
mcp_skaftin_execute_batch_operations({
  projectId: string;
  operations: Array<{
    type: 'create_user' | 'insert_data' | 'update_data' | 'delete_data' | 'execute_sql';
    data: any;
  }>;
  options?: {
    transaction?: boolean; // Default: false
    continueOnError?: boolean; // Default: true
    rollbackOnError?: boolean; // Default: false (only if transaction: true)
  };
})
```

**Returns:**
```typescript
{
  success: boolean;
  executed: number;
  failed: number;
  results: Array<{
    index: number;
    type: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}
```

**Benefits:**
- Execute multiple different operations in one call
- Optional transaction support for atomicity
- Generic - works for any operation type
- Useful for complex migrations

**Example Usage:**
```typescript
const result = await mcp_skaftin_execute_batch_operations({
  projectId: "2",
  operations: [
    { type: 'create_user', data: { name: "User 1", email: "user1@example.com", ... } },
    { type: 'insert_data', data: { tableName: 'mapping', data: { user_id: 123, ... } } },
    { type: 'execute_sql', data: { query: 'UPDATE drivers SET user_id = 123 WHERE id = 1' } }
  ],
  options: {
    transaction: true,
    rollbackOnError: true
  }
});
```

---

### 3. Generic Table-to-User Migration Helper

**Tool:** `mcp_skaftin_migrate_table_to_users`

**Purpose:** Generic helper for migrating any table to app_users system.

**Signature:**
```typescript
mcp_skaftin_migrate_table_to_users({
  projectId: string;
  sourceTable: string;
  sourceIdColumn: string; // e.g., 'id', 'driver_id'
  mapping: {
    name: string; // Column or expression for user name
    email: string; // Column or expression for email
    phone?: string; // Column or expression for phone
    role_ids: number[];
    metadata?: Record<string, string>; // Column mappings for metadata
  };
  options?: {
    where?: Record<string, any>; // Filter source records
    emailGenerator?: (record: any) => string; // Custom email generator
    passwordGenerator?: () => string; // Custom password generator
    batchSize?: number;
    continueOnError?: boolean;
    skipDuplicates?: boolean;
  };
})
```

**Returns:**
```typescript
{
  success: boolean;
  totalRecords: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  mappings: Array<{
    source_id: number;
    user_id: number;
    email: string;
  }>;
  errors: Array<{
    source_id: number;
    error: string;
  }>;
}
```

**Benefits:**
- Generic - works for drivers, marshals, owners, any table
- Handles email generation automatically
- Built-in duplicate detection
- Returns mappings for linking

**Example Usage:**
```typescript
const result = await mcp_skaftin_migrate_table_to_users({
  projectId: "2",
  sourceTable: "drivers",
  sourceIdColumn: "id",
  mapping: {
    name: "CONCAT(name, ' ', surname)",
    email: "COALESCE(email, CONCAT('driver_', id, '@taxiadmin.local'))",
    phone: "phone",
    role_ids: [8], // Driver role
    metadata: {
      association_id: "association_id",
      surname: "surname",
      idNum: "idNum"
    }
  },
  options: {
    batchSize: 200,
    continueOnError: true,
    skipDuplicates: true
  }
});
```

---

### 4. Migration Progress Tracking

**Tool:** `mcp_skaftin_create_migration_job`

**Purpose:** Track migration progress with resumable jobs.

**Signature:**
```typescript
mcp_skaftin_create_migration_job({
  projectId: string;
  jobName: string;
  jobType: 'table_to_users' | 'bulk_create_users' | 'custom';
  totalRecords: number;
  metadata?: Record<string, any>;
})

mcp_skaftin_update_migration_job({
  projectId: string;
  jobId: string;
  processed: number;
  created?: number;
  skipped?: number;
  errors?: number;
  status?: 'running' | 'completed' | 'failed' | 'paused';
})

mcp_skaftin_get_migration_job({
  projectId: string;
  jobId: string;
})
```

**Returns:**
```typescript
{
  jobId: string;
  jobName: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  totalRecords: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  progress: number; // Percentage
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

**Benefits:**
- Track migration progress
- Resume interrupted migrations
- Monitor long-running operations
- Generic - works for any migration type

---

### 5. Data Validation Before Migration

**Tool:** `mcp_skaftin_validate_migration_data`

**Purpose:** Validate data before migration to catch issues early.

**Signature:**
```typescript
mcp_skaftin_validate_migration_data({
  projectId: string;
  sourceTable: string;
  validation: {
    requiredColumns: string[];
    emailColumns?: string[];
    phoneColumns?: string[];
    uniqueColumns?: string[];
    customRules?: Array<{
      column: string;
      rule: 'not_null' | 'unique' | 'email_format' | 'phone_format' | 'custom';
      expression?: string; // For custom rules
    }>;
  };
  options?: {
    where?: Record<string, any>;
    sampleSize?: number; // Validate sample or all
  };
})
```

**Returns:**
```typescript
{
  valid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  issues: Array<{
    record_id: number;
    column: string;
    issue: string;
    severity: 'error' | 'warning';
  }>;
  summary: {
    missingRequired: number;
    invalidEmails: number;
    invalidPhones: number;
    duplicates: number;
  };
}
```

**Benefits:**
- Catch data issues before migration
- Prevent failed migrations
- Generic validation rules
- Works for any table

---

### 6. Smart User Lookup

**Tool:** `mcp_skaftin_find_or_create_user`

**Purpose:** Find existing user or create new one in a single call.

**Signature:**
```typescript
mcp_skaftin_find_or_create_user({
  projectId: string;
  lookup: {
    email?: string;
    phone?: string;
  };
  createData?: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role_ids: number[];
    metadata?: Record<string, any>;
  };
})
```

**Returns:**
```typescript
{
  user_id: number;
  created: boolean; // true if created, false if found
  user: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    // ... other user fields
  };
}
```

**Benefits:**
- Simplifies duplicate handling
- Single call for find-or-create pattern
- Common pattern in migrations
- Generic - works for any user type

---

## Implementation Priority

### High Priority (Immediate Value)
1. **Bulk User Creation** - Solves the main pain point (265 individual calls)
2. **Find or Create User** - Simplifies duplicate handling

### Medium Priority (Significant Value)
3. **Generic Table-to-User Migration** - Makes migrations much easier
4. **Migration Progress Tracking** - Enables resumable migrations

### Low Priority (Nice to Have)
5. **Batch Operations** - Useful for complex scenarios
6. **Data Validation** - Helpful but can be done manually

## Example: Simplified Migration with New Tools

### Before (Current):
```typescript
// 265 individual calls
for (const driver of drivers) {
  await mcp_skaftin_create_app_user({ ... });
  // Handle errors, duplicates, etc.
}
```

### After (With Proposed Tools):
```typescript
// Single call for all users
const result = await mcp_skaftin_bulk_create_app_users({
  projectId: "2",
  users: drivers.map(d => ({
    name: d.full_name,
    email: d.email,
    phone: d.phone,
    password: generatePassword(),
    role_ids: [8],
    metadata: { ... }
  })),
  options: {
    batchSize: 200,
    continueOnError: true,
    skipDuplicates: true
  }
});

// Or even simpler with migration helper:
const result = await mcp_skaftin_migrate_table_to_users({
  projectId: "2",
  sourceTable: "drivers",
  sourceIdColumn: "id",
  mapping: { ... },
  options: { ... }
});
```

## Benefits Summary

1. **Reduced API Calls**: 265 calls → 1-2 calls
2. **Built-in Error Handling**: No manual retry logic needed
3. **Automatic Duplicate Detection**: No manual checking required
4. **Progress Tracking**: Built-in job tracking
5. **Generic & Reusable**: Works for any table/user type
6. **Transaction Support**: Atomic operations when needed
7. **Better Performance**: Server-side batching and optimization

## Next Steps

1. **Review & Prioritize**: Determine which tools provide most value
2. **Design Details**: Finalize API signatures and error handling
3. **Implementation**: Add to Skaftin MCP server
4. **Documentation**: Update MCP tool documentation
5. **Testing**: Test with various migration scenarios

These tools would make migrations significantly easier while remaining generic enough to work for any application using the Skaftin SDK.

