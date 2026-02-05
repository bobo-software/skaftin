# 🛠️ MCP Features - Skaftin Platform

## 🎯 MCP (Model Context Protocol) Integration

The Skaftin platform provides comprehensive MCP tools for AI-assisted development, enabling seamless integration with AI IDEs like Cursor and Windsurf.

## 🗄️ Database Tools

### Core Database Operations

#### `search_docs`
**Purpose**: Search through database documentation and help content
```typescript
interface SearchDocsParams {
  query: string;
  category?: 'tables' | 'functions' | 'migrations' | 'general';
  limit?: number;
}
```

**Use Cases**:
- Find table schemas
- Search for specific functions
- Look up migration history
- General database help

#### `list_tables`
**Purpose**: List all tables in a project schema
```typescript
interface ListTablesParams {
  projectId: string;
  schema?: string;
  includeMetadata?: boolean;
}
```

**Returns**:
- Table names and descriptions
- Column information
- Index details
- Relationship mappings

#### `list_extensions`
**Purpose**: Show available PostgreSQL extensions
```typescript
interface ListExtensionsParams {
  projectId: string;
  installed?: boolean;
}
```

**Returns**:
- Extension names and versions
- Installation status
- Documentation links

#### `list_migrations`
**Purpose**: Display migration history
```typescript
interface ListMigrationsParams {
  projectId: string;
  limit?: number;
  status?: 'applied' | 'pending' | 'failed';
}
```

**Returns**:
- Migration files and timestamps
- Application status
- Rollback information

#### `apply_migration`
**Purpose**: Execute database migrations
```typescript
interface ApplyMigrationParams {
  projectId: string;
  migrationFile: string;
  rollback?: boolean;
}
```

**Features**:
- Safe migration execution
- Rollback capabilities
- Transaction wrapping
- Error handling

#### `execute_sql`
**Purpose**: Run SQL queries safely
```typescript
interface ExecuteSQLParams {
  projectId: string;
  query: string;
  parameters?: any[];
  readonly?: boolean;
}
```

**Safety Features**:
- Query validation
- Parameter binding
- Result limiting
- Error reporting

#### `get_logs`
**Purpose**: Retrieve database operation logs
```typescript
interface GetLogsParams {
  projectId: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  timeRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
}
```

**Log Types**:
- Query execution logs
- Error logs
- Performance metrics
- Connection logs

#### `get_advisors`
**Purpose**: Get performance and security recommendations
```typescript
interface GetAdvisorsParams {
  projectId: string;
  type?: 'performance' | 'security' | 'maintenance';
}
```

**Recommendations**:
- Missing indexes
- Slow queries
- Security vulnerabilities
- Maintenance tasks

#### `generate_typescript_types`
**Purpose**: Auto-generate TypeScript types from database schema
```typescript
interface GenerateTypesParams {
  projectId: string;
  schema?: string;
  outputFormat?: 'interface' | 'class' | 'type';
}
```

**Features**:
- Complete type definitions
- Relationship types
- Enum support
- Custom naming conventions

#### `create_schema`
**Purpose**: Create new database schema
```typescript
interface CreateSchemaParams {
  projectId: string;
  schemaName: string;
  description?: string;
}
```

**Features**:
- Schema validation
- Permission setup
- Default configurations

#### `delete_schema`
**Purpose**: Remove database schema
```typescript
interface DeleteSchemaParams {
  projectId: string;
  schemaName: string;
  force?: boolean;
}
```

**Safety Features**:
- Dependency checking
- Backup creation
- Confirmation requirements

## 👥 Authentication & User Management Tools

### App User Management

The Auth Tools provide comprehensive MCP integration for managing application users, roles, custom fields, and authentication settings. For detailed documentation, see [Auth Tools Documentation](./mcp/AUTH_TOOLS.md).

#### Available Tools

**User Management:**
- `list_app_users` - List users with filtering and pagination
- `get_app_user` - Get user details by ID
- `create_app_user` - Create new application users
- `update_app_user` - Update user information
- `delete_app_user` - Deactivate or permanently delete users
- `assign_user_role` - Assign roles to users

**Role Management:**
- `list_app_roles` - List all project roles
- `get_app_role` - Get role details
- `create_app_role` - Create custom roles with permissions
- `update_app_role` - Update role configuration
- `delete_app_role` - Delete custom roles

**Custom Fields:**
- `list_custom_fields` - List user custom fields
- `create_custom_field` - Define new custom fields
- `apply_custom_field` - Apply field to database schema

**Auth Settings:**
- `get_auth_settings` - Get project auth configuration
- `update_auth_settings` - Update auth settings

#### Quick Example

```typescript
// Create a user and assign admin role
const user = await mcpClient.callTool('create_app_user', {
  projectId: '1',
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
});

await mcpClient.callTool('assign_user_role', {
  projectId: '1',
  userId: user.user.id.toString(),
  roleId: 1 // Admin role
});
```

## 📁 Storage Tools

### MinIO Integration

#### `search_bucket`
**Purpose**: Search files in MinIO buckets
```typescript
interface SearchBucketParams {
  projectId: string;
  bucketName: string;
  query: string;
  fileType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
```

**Search Features**:
- Filename search
- Content search (text files)
- Metadata filtering
- Date range filtering

#### `upload_file`
**Purpose**: Upload files to MinIO
```typescript
interface UploadFileParams {
  projectId: string;
  bucketName: string;
  file: File;
  path?: string;
  metadata?: Record<string, string>;
}
```

**Features**:
- Progress tracking
- Chunked uploads
- Metadata attachment
- Duplicate handling

#### `download_file`
**Purpose**: Download files from MinIO
```typescript
interface DownloadFileParams {
  projectId: string;
  bucketName: string;
  filePath: string;
  range?: { start: number; end: number };
}
```

**Features**:
- Range requests
- Streaming downloads
- Progress tracking
- Error handling

#### `list_buckets`
**Purpose**: List available MinIO buckets
```typescript
interface ListBucketsParams {
  projectId: string;
  includeStats?: boolean;
}
```

**Returns**:
- Bucket names
- Creation dates
- Size information
- Access permissions

#### `create_bucket`
**Purpose**: Create new MinIO bucket
```typescript
interface CreateBucketParams {
  projectId: string;
  bucketName: string;
  region?: string;
  versioning?: boolean;
}
```

**Features**:
- Name validation
- Permission setup
- Versioning configuration
- Region specification

## 🔧 Advanced MCP Features

### Project Management

#### `get_project_info`
**Purpose**: Retrieve project metadata
```typescript
interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  schemas: string[];
  buckets: string[];
  settings: ProjectSettings;
}
```

#### `update_project_settings`
**Purpose**: Modify project configurations
```typescript
interface ProjectSettings {
  database: DatabaseSettings;
  storage: StorageSettings;
  api: ApiSettings;
  security: SecuritySettings;
}
```

### Real-time Features

#### `subscribe_to_events`
**Purpose**: Subscribe to real-time database/storage events
```typescript
interface EventSubscription {
  projectId: string;
  events: ('table_change' | 'file_upload' | 'migration')[];
  callback: (event: EventData) => void;
}
```

### Analytics & Monitoring

#### `get_analytics`
**Purpose**: Retrieve platform analytics
```typescript
interface AnalyticsData {
  database: {
    queryCount: number;
    averageResponseTime: number;
    errorRate: number;
  };
  storage: {
    totalFiles: number;
    totalSize: number;
    uploadCount: number;
  };
  api: {
    requestCount: number;
    responseTime: number;
    errorRate: number;
  };
}
```

## 🚀 Implementation Strategy

### Phase 1: Core Tools
- [ ] Database CRUD operations
- [ ] Basic storage operations
- [ ] Project management
- [ ] Error handling

### Phase 2: Advanced Features
- [ ] Real-time subscriptions
- [ ] Analytics integration
- [ ] Performance monitoring
- [ ] Security advisors

### Phase 3: AI Integration
- [ ] Natural language query processing
- [ ] Auto-schema generation
- [ ] Intelligent recommendations
- [ ] Code generation

## 🔒 Security Considerations

### Authentication
- JWT token validation for all MCP calls
- Project-level access control
- Role-based permissions
- Rate limiting

### Data Protection
- Input sanitization
- SQL injection prevention
- File upload validation
- Audit logging

### Privacy
- No data collection without consent
- Local processing when possible
- Encrypted data transmission
- Secure token storage

## 📊 Performance Optimization

### Caching Strategy
- Query result caching
- Schema metadata caching
- File metadata caching
- API response caching

### Resource Management
- Connection pooling
- Memory optimization
- Lazy loading
- Background processing

## 🧪 Testing Strategy

### Unit Tests
- Individual MCP tool testing
- Mock database/storage
- Error scenario testing
- Performance benchmarking

### Integration Tests
- End-to-end MCP workflows
- Real database/storage testing
- Cross-tool compatibility
- Load testing

---

*This MCP specification will be updated as we implement and test the features.*
