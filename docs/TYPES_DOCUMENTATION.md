# Common Types Documentation

## Overview
This document describes the centralized type definitions added to both the backend and frontend of the Skaftin Platform. These types provide type safety, better IDE support, and consistency across the entire application.

---

## Backend Types (`src/types/Types.ts`)

### API Response Types
Standard response types for all API endpoints:

```typescript
ApiResponse<T>          // Generic API response wrapper
PaginatedResponse<T>    // Paginated data response
ErrorResponse           // Error response structure
```

**Usage Example:**
```typescript
import { ApiResponse, ErrorResponse } from '../types/Types';

const response: ApiResponse<Project[]> = {
  success: true,
  message: 'Projects fetched successfully',
  data: projects
};
```

### User & Authentication Types
User authentication and authorization types:

```typescript
User                    // User entity
AuthTokenPayload        // JWT token payload
LoginCredentials        // Login request
RegisterCredentials     // Registration request
AuthResponse           // Authentication response
```

**Usage Example:**
```typescript
import { User, AuthTokenPayload } from '../types/Types';

const tokenPayload: AuthTokenPayload = {
  userId: user.id,
  email: user.email,
  role: user.role,
  projectIds: user.projectIds
};
```

### Project Types
Project management types:

```typescript
Project                 // Project entity
CreateProjectDto        // Create project request
UpdateProjectDto        // Update project request
ProjectStats           // Project statistics
```

### Database Types
Database and table management types:

```typescript
DatabaseTable          // Table metadata
DatabaseColumn         // Column definition
CreateTableDto         // Create table request
ColumnDefinition       // Column creation spec
TableConstraint        // Table constraint info
ForeignKeyConstraint   // Foreign key definition
SqlQueryRequest        // SQL query request
SqlQueryResult         // SQL query result
```

**Usage Example:**
```typescript
import { CreateTableDto, ColumnDefinition } from '../types/Types';

const createTable: CreateTableDto = {
  tableName: 'users',
  columns: [
    { name: 'id', type: 'SERIAL', primaryKey: true },
    { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
    { name: 'name', type: 'VARCHAR(100)' }
  ]
};
```

### Storage Types
File and storage management types:

```typescript
StorageFile            // File metadata
StorageBucket          // Bucket information
UploadFileDto          // Upload file request
FileMetadata           // Complete file metadata
SearchFilesDto         // Search files request
CreateBucketDto        // Create bucket request
```

**Usage Example:**
```typescript
import { UploadFileDto } from '../types/Types';

const uploadRequest: UploadFileDto = {
  filePath: 'documents/report.pdf',
  fileContent: base64Content,
  contentType: 'application/pdf',
  metadata: { author: 'John Doe' }
};
```

### MCP (Model Context Protocol) Types
MCP tool integration types:

```typescript
MCPTool                // MCP tool definition
MCPToolCall            // Tool invocation
MCPToolResponse        // Tool response
```

### WebSocket Types
Real-time event types:

```typescript
WebSocketEvent         // Event structure
WebSocketMessage       // WebSocket message
```

### Request Types
Express request extensions:

```typescript
AuthenticatedUser      // Authenticated user info
AuthenticatedRequest   // Extended Express Request
```

### Utility Types
Common utility types:

```typescript
Nullable<T>            // T | null
Optional<T>            // T | undefined
ID                     // string | number
Timestamp              // Date | string
JSONValue              // JSON value types
JSONObject             // JSON object type
JSONArray              // JSON array type
```

### Pagination Types
Query pagination types:

```typescript
PaginationParams       // Pagination request
PaginationMeta         // Pagination metadata
```

### Configuration Types
Service configuration types:

```typescript
DatabaseConfig         // Database configuration
StorageConfig          // Storage configuration
ServerConfig           // Server configuration
```

### Health Check Types
System health monitoring:

```typescript
HealthCheckResult      // Single check result
SystemHealth           // Overall system health
```

---

## Frontend Types (`frontend/src/types/Types.ts`)

### API Response Types
Same as backend for consistency:

```typescript
ApiResponse<T>
PaginatedResponse<T>
```

### User & Authentication Types
Frontend user and auth types:

```typescript
User
LoginCredentials
RegisterCredentials
AuthResponse
LoginResult
```

**Usage Example:**
```typescript
import { LoginCredentials, LoginResult } from '../types/Types';

const credentials: LoginCredentials = {
  email: 'user@example.com',
  password: 'password123'
};

const result: LoginResult = await authService.login(credentials);
```

### Project Types
Frontend project types (match backend structure):

```typescript
Project
CreateProjectDto
UpdateProjectDto
ProjectStats
```

### Database Types
Frontend database types:

```typescript
Table                  // Table info
Column                 // Column info
CreateTableDto         // Create table request
ColumnDefinition       // Column spec
TableData              // Table data with rows
SqlQuery               // SQL query history item
TableConstraint        // Constraint info
ForeignKeyConstraint   // Foreign key info
```

### Storage Types
Frontend storage types:

```typescript
StorageFile
StorageBucket
UploadFileDto
FileMetadata
SearchFilesDto
FileUploadProgress     // Upload progress tracking
```

### UI State Types
Frontend-specific UI state types:

```typescript
LoadingState           // Loading indicator state
ErrorState             // Error state
ToastNotification      // Toast/snackbar notification
ModalState             // Modal dialog state
```

**Usage Example:**
```typescript
import { ToastNotification } from '../types/Types';

const notification: ToastNotification = {
  id: crypto.randomUUID(),
  type: 'success',
  message: 'Project created successfully',
  duration: 3000
};
```

### Form Types
Form management types:

```typescript
FormField              // Form field definition
FormError              // Form validation error
FormState              // Complete form state
```

### Navigation Types
Navigation and routing types:

```typescript
NavigationItem         // Navigation menu item
BreadcrumbItem         // Breadcrumb item
```

### Table/Grid Types
Data table/grid component types:

```typescript
DataGridColumn         // Grid column definition
DataGridRow            // Grid row data
SortConfig             // Sort configuration
FilterConfig           // Filter configuration
```

**Usage Example:**
```typescript
import { DataGridColumn } from '../types/Types';

const columns: DataGridColumn[] = [
  { field: 'id', headerName: 'ID', width: 80, sortable: true },
  { field: 'name', headerName: 'Name', width: 200, sortable: true },
  { field: 'email', headerName: 'Email', width: 250 }
];
```

### Theme Types
Theme and styling types:

```typescript
ThemeMode              // 'light' | 'dark' | 'auto'
ThemeColors            // Color palette
ThemeConfig            // Complete theme config
```

### Store Types (Zustand)
State management store types:

```typescript
AppStore               // Global app state
AuthStore              // Authentication state
ProjectStore           // Project management state
DatabaseStore          // Database management state
StorageStore           // Storage management state
```

**Usage Example:**
```typescript
import { ProjectStore } from '../types/Types';
import { create } from 'zustand';

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
  fetchProjects: async () => {
    // Implementation
  },
  // ... other methods
}));
```

### Component Props Types
Reusable component prop types:

```typescript
BaseComponentProps     // Base props for all components
ButtonProps            // Button component props
InputProps             // Input component props
SelectProps            // Select component props
```

---

## Usage Guidelines

### 1. Import Types, Not Interfaces (when appropriate)
```typescript
// Good
import type { User, Project } from '../types/Types';

// Also acceptable
import { User, Project } from '../types/Types';
```

### 2. Use Generic Types for Flexibility
```typescript
import { ApiResponse } from '../types/Types';

// Typed response
const response: ApiResponse<User[]> = await fetchUsers();
```

### 3. Extend Base Types When Needed
```typescript
import { BaseComponentProps } from '../types/Types';

interface CustomButtonProps extends BaseComponentProps {
  customProp: string;
}
```

### 4. Use Utility Types
```typescript
import { Nullable, Optional, ID } from '../types/Types';

function getUser(id: ID): Nullable<User> {
  // Returns User or null
}
```

### 5. DTOs for API Requests
```typescript
import { CreateProjectDto } from '../types/Types';

async function createProject(data: CreateProjectDto) {
  return await api.post('/projects/create', data);
}
```

---

## Benefits

### 1. **Type Safety**
- Catch errors at compile time
- Prevent runtime type errors
- Better refactoring support

### 2. **IDE Support**
- Auto-completion for all types
- Inline documentation
- Go-to-definition support

### 3. **Consistency**
- Shared types between frontend and backend
- Single source of truth
- Easier maintenance

### 4. **Documentation**
- Types serve as documentation
- Self-documenting code
- Easier onboarding for new developers

### 5. **Refactoring**
- Safe refactoring with TypeScript
- Compiler catches breaking changes
- Rename refactoring across files

---

## Migration Guide

### Before (Inline Types)
```typescript
// ❌ Bad: Types defined inline
function getUser(id: string): Promise<{
  id: string;
  email: string;
  name: string;
} | null> {
  // ...
}
```

### After (Centralized Types)
```typescript
// ✅ Good: Using centralized types
import { User, Nullable } from '../types/Types';

function getUser(id: string): Promise<Nullable<User>> {
  // ...
}
```

### Controller Example
```typescript
// Before
static async createProject(req: Request, res: Response) {
  const { name, description }: { name: string; description?: string } = req.body;
  // ...
}

// After
import { CreateProjectDto, ApiResponse, Project } from '../types/Types';

static async createProject(req: Request, res: Response) {
  const projectData: CreateProjectDto = req.body;
  // ...
  const response: ApiResponse<Project> = {
    success: true,
    message: 'Project created',
    data: newProject
  };
  res.json(response);
}
```

---

## Type Organization

### Backend Structure
```
src/types/
└── Types.ts
    ├── API Response Types
    ├── User & Authentication Types
    ├── Project Types
    ├── Database Types
    ├── Storage Types
    ├── MCP Types
    ├── WebSocket Types
    ├── Request Types
    ├── Utility Types
    ├── Pagination Types
    ├── Configuration Types
    └── Health Check Types
```

### Frontend Structure
```
frontend/src/types/
└── Types.ts
    ├── API Response Types
    ├── User & Authentication Types
    ├── Project Types
    ├── Database Types
    ├── Storage Types
    ├── UI State Types
    ├── Form Types
    ├── Navigation Types
    ├── Table/Grid Types
    ├── Pagination Types
    ├── WebSocket Types
    ├── Theme Types
    ├── Store Types
    ├── Utility Types
    └── Component Props Types
```

---

## Next Steps

### Recommended Enhancements:
1. **Add JSDoc comments** to all types for better IDE tooltips
2. **Create domain-specific type files** (e.g., `ProjectTypes.ts`, `DatabaseTypes.ts`)
3. **Add validation schemas** (Zod, Yup) that match these types
4. **Generate OpenAPI spec** from these types
5. **Create type guards** for runtime type checking
6. **Add branded types** for additional type safety
7. **Document type relationships** with diagrams

---

## Conclusion

The centralized type system provides a solid foundation for type-safe development across the entire Skaftin Platform. All types are:

- ✅ Consistent across backend and frontend
- ✅ Well-organized and easy to find
- ✅ Documented and maintainable
- ✅ Type-safe and compile-time checked
- ✅ IDE-friendly with auto-completion

This enables confident development with fewer bugs and better developer experience.

