# 🏗️ Backend Architecture - Skaftin Platform

## 📋 Architecture Overview

The Skaftin backend is designed as a modular, scalable system that provides database management, file storage, authentication, and MCP integration capabilities.

## 🎯 Core Principles

- **Modular Design**: Each feature is self-contained and testable
- **Type Safety**: Full TypeScript coverage with strict typing
- **Performance**: Optimized for speed and resource efficiency
- **Security**: Built-in security measures and best practices
- **Extensibility**: Easy to add new features and integrations

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                 API Gateway Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Auth      │ │   Rate      │ │   CORS      │         │
│  │ Middleware  │ │  Limiting   │ │ Middleware  │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Application Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Auth      │ │  Database   │ │  Storage    │         │
│  │  Service    │ │  Service    │ │  Service    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Project   │ │    MCP      │ │  Real-time  │         │
│  │  Service    │ │  Service    │ │  Service    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Data Layer                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ PostgreSQL  │ │   MinIO     │ │   Redis     │         │
│  │  Database   │ │  Storage    │ │   Cache     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/backend/
├── config/
│   ├── database.ts          # Database configuration
│   ├── minio.ts            # MinIO configuration
│   ├── redis.ts            # Redis configuration
│   ├── auth.ts             # JWT configuration
│   └── environment.ts       # Environment variables
├── controllers/
│   ├── auth.controller.ts   # Authentication endpoints
│   ├── project.controller.ts # Project management
│   ├── database.controller.ts # Database operations
│   ├── storage.controller.ts  # File operations
│   └── mcp.controller.ts    # MCP tools
├── middleware/
│   ├── auth.middleware.ts   # JWT validation
│   ├── validation.middleware.ts # Request validation
│   ├── rateLimit.middleware.ts # Rate limiting
│   └── error.middleware.ts  # Error handling
├── routes/
│   ├── auth.routes.ts       # Authentication routes
│   ├── project.routes.ts    # Project routes
│   ├── database.routes.ts   # Database routes
│   ├── storage.routes.ts    # Storage routes
│   └── mcp.routes.ts        # MCP routes
├── services/
│   ├── auth.service.ts      # Authentication logic
│   ├── project.service.ts   # Project management
│   ├── database.service.ts  # Database operations
│   ├── storage.service.ts   # File operations
│   ├── mcp.service.ts       # MCP tools
│   └── realtime.service.ts  # WebSocket management
├── db/
│   ├── connection.ts        # Database connection
│   ├── migrations/         # Database migrations
│   ├── schemas/            # Database schemas
│   └── models/             # Data models
├── utils/
│   ├── logger.ts           # Logging utility
│   ├── validator.ts         # Validation helpers
│   ├── crypto.ts           # Cryptographic utilities
│   └── helpers.ts          # General helpers
└── mcp/
    ├── tools/              # MCP tool implementations
    ├── handlers/           # MCP request handlers
    └── types/             # MCP type definitions
```

## 🔐 Authentication System

### JWT Implementation
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  projectId?: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}
```

### Authentication Flow
1. **Login**: Email/password → JWT token
2. **Token Validation**: Middleware validates JWT on protected routes
3. **Project Access**: Tokens can be scoped to specific projects
4. **Refresh**: Token refresh mechanism for long-lived sessions

### Security Features
- **Password Hashing**: bcrypt with salt rounds
- **Token Expiration**: Configurable token lifetime
- **Rate Limiting**: Login attempt limiting
- **CORS**: Configured for frontend domain

## 🗄️ Database Architecture

### Schema Design
```sql
-- Global schemas
CREATE SCHEMA auth;      -- User authentication
CREATE SCHEMA platform; -- Platform settings
CREATE SCHEMA logs;      -- System logs

-- Project schemas (created dynamically)
CREATE SCHEMA project_myapp;
CREATE SCHEMA project_ecommerce;
```

### Core Tables
```sql
-- Users table
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE platform.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_name VARCHAR(63) NOT NULL,
  bucket_name VARCHAR(63) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Database Service Features
- **Connection Pooling**: Efficient database connections
- **Transaction Management**: ACID compliance
- **Migration System**: Version-controlled schema changes
- **Query Optimization**: Performance monitoring
- **Backup Strategy**: Automated backups

## 📁 Storage Architecture

### MinIO Integration
```typescript
interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketPrefix: string;
  region: string;
}
```

### Storage Features
- **Bucket-per-Project**: Isolated storage spaces
- **File Upload**: Multipart upload support
- **File Management**: CRUD operations
- **Access Control**: Project-scoped permissions
- **CDN Integration**: Optional CDN support

### File Operations
```typescript
interface FileOperation {
  upload: (file: Buffer, path: string) => Promise<string>;
  download: (path: string) => Promise<Buffer>;
  delete: (path: string) => Promise<void>;
  list: (prefix: string) => Promise<FileInfo[]>;
}
```

## 🛠️ MCP Integration

### MCP Tool Categories
1. **Database Tools**: Query execution, schema management
2. **Storage Tools**: File operations, bucket management
3. **Project Tools**: Project creation, configuration
4. **Analytics Tools**: Performance monitoring, logs

### MCP Service Architecture
```typescript
interface MCPTool {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  handler: (params: any) => Promise<any>;
}
```

### Tool Implementation
```typescript
class DatabaseMCPTools {
  async executeSQL(params: ExecuteSQLParams): Promise<QueryResult> {
    // SQL execution logic
  }
  
  async listTables(params: ListTablesParams): Promise<TableInfo[]> {
    // Table listing logic
  }
  
  async createTable(params: CreateTableParams): Promise<void> {
    // Table creation logic
  }
}
```

## 🔄 Real-time Features

### WebSocket Integration
```typescript
interface RealtimeEvent {
  type: 'database_change' | 'file_upload' | 'project_update';
  projectId: string;
  data: any;
  timestamp: Date;
}
```

### Event Types
- **Database Changes**: Table modifications, data updates
- **File Operations**: Uploads, deletions, modifications
- **Project Updates**: Settings changes, schema updates
- **System Events**: Errors, warnings, notifications

## 📊 API Design

### RESTful Endpoints
```typescript
// Authentication
POST /api/auth/login
POST /api/auth/register
POST /api/auth/refresh
POST /api/auth/logout

// Projects
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id

// Database
GET    /api/projects/:id/tables
POST   /api/projects/:id/tables
POST   /api/projects/:id/query
GET    /api/projects/:id/migrations

// Storage
GET    /api/projects/:id/files
POST   /api/projects/:id/files
DELETE /api/projects/:id/files/:path
```

### GraphQL Schema
```graphql
type Query {
  projects: [Project!]!
  project(id: ID!): Project
  tables(projectId: ID!): [Table!]!
  files(projectId: ID!): [File!]!
}

type Mutation {
  createProject(input: CreateProjectInput!): Project!
  executeSQL(projectId: ID!, query: String!): QueryResult!
  uploadFile(projectId: ID!, file: Upload!): File!
}
```

## 🚀 Performance Optimization

### Caching Strategy
- **Redis Cache**: Query results, session data
- **Memory Cache**: Frequently accessed data
- **CDN Cache**: Static assets, file downloads
- **Database Cache**: Connection pooling, query cache

### Optimization Techniques
- **Lazy Loading**: Load data on demand
- **Pagination**: Limit result sets
- **Indexing**: Database performance optimization
- **Compression**: Response compression

## 🔒 Security Implementation

### Input Validation
```typescript
interface ValidationRules {
  email: string;      // Email format validation
  password: string;   // Password strength validation
  projectName: string; // Project name validation
  sqlQuery: string;   // SQL injection prevention
}
```

### Security Measures
- **Input Sanitization**: XSS prevention
- **SQL Injection**: Parameterized queries
- **CSRF Protection**: Token validation
- **Rate Limiting**: API abuse prevention

## 📈 Monitoring & Logging

### Logging System
```typescript
interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}
```

### Monitoring Features
- **Performance Metrics**: Response times, throughput
- **Error Tracking**: Exception monitoring
- **User Analytics**: Usage patterns
- **System Health**: Resource utilization

## 🧪 Testing Strategy

### Test Types
- **Unit Tests**: Individual function testing
- **Integration Tests**: Service interaction testing
- **E2E Tests**: Full workflow testing
- **Performance Tests**: Load and stress testing

### Testing Tools
- **Jest**: Unit and integration testing
- **Supertest**: API endpoint testing
- **Cypress**: E2E testing
- **Artillery**: Performance testing

## 🚀 Deployment Strategy

### Development Environment
```bash
# Local development
npm run dev

# Docker development
docker-compose up -d
```

### Production Deployment
```bash
# Build application
npm run build

# Run migrations
npm run migrate

# Start production server
npm start
```

### Docker Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/Server.js"]
```

## 🔄 Future Enhancements

### Planned Features
- **Microservices**: Service decomposition
- **Event Sourcing**: Event-driven architecture
- **CQRS**: Command Query Responsibility Segregation
- **API Gateway**: Centralized API management

### Scalability Considerations
- **Horizontal Scaling**: Load balancing
- **Database Sharding**: Data distribution
- **Caching Layers**: Multi-level caching
- **CDN Integration**: Global content delivery

---

*This architecture document will be updated as we implement and refine the system.*
