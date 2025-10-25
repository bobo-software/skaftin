# Backend Development Rules for Skaftin Platform

## 📁 Project Structure Rules

### 1. Service Organization
- **All business logic** must be in `src/backend/services/`
- **Route handlers** go in `src/backend/routes/`
- **Middleware** goes in `src/backend/middleware/`
- **Database operations** are abstracted in services

### 2. TypeScript & Error Handling
- **All functions** must have explicit return types
- **Error handling** must be comprehensive with try-catch blocks
- **Database queries** must handle connection errors
- **API responses** must follow consistent format

### 3. File Structure & Spacing
```typescript
// 1. Imports (grouped by type)
import express, { Request, Response } from 'express';
import { pool } from '../db/connection';
import { AuthService } from '../services/auth.service';

// 2. Two spaces after imports

// 3. Type definitions
interface ServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// 4. Service class
export class ServiceName {
  // Methods here
}
```

## 🗂️ Directory Structure

```
src/backend/
├── config/          # Environment and configuration
├── controllers/     # Request/response handling
├── db/             # Database connection and utilities
├── middleware/      # Authentication, validation, etc.
├── routes/         # API route definitions
├── services/        # Business logic and data operations
└── utils/          # Helper functions and utilities
```

## 📝 Service Categories

### Core Services
- `AuthService` - Authentication and user management
- `DatabaseService` - Database operations and queries
- `StorageService` - File storage operations
- `ProjectService` - Project management
- `McpService` - MCP tool integration

### Route Handlers
- `auth.routes.ts` - Authentication endpoints
- `health.routes.ts` - Health check endpoints
- `mcp.routes.ts` - MCP tool endpoints

### Middleware
- `auth.middleware.ts` - JWT authentication
- `validation.middleware.ts` - Request validation
- `error.middleware.ts` - Error handling

## 🎯 Development Guidelines

### 1. Service Creation Checklist
- [ ] Create service file in `services/` directory
- [ ] Define explicit interfaces for all methods
- [ ] Add comprehensive error handling
- [ ] Include proper TypeScript types
- [ ] Follow spacing rules (2 spaces after imports)
- [ ] Add JSDoc comments for complex methods

### 2. API Response Pattern
```typescript
interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  timestamp: string;
}
```

### 3. Error Handling Pattern
```typescript
try {
  const result = await someOperation();
  return {
    success: true,
    data: result
  };
} catch (error) {
  console.error('Operation error:', error);
  return {
    success: false,
    error: 'Operation failed'
  };
}
```

### 4. Database Query Pattern
```typescript
try {
  const result = await pool.query(query, params);
  return {
    success: true,
    data: result.rows
  };
} catch (error) {
  console.error('Database error:', error);
  return {
    success: false,
    error: 'Database operation failed'
  };
}
```

## 🚀 Best Practices

1. **Always use TypeScript** - No implicit any types
2. **Error handling** - Comprehensive try-catch blocks
3. **Database safety** - Use parameterized queries
4. **Response consistency** - Standardized API responses
5. **Logging** - Console.error for errors, console.log for debugging
6. **Validation** - Validate all inputs
7. **Security** - JWT tokens, password hashing, CORS
8. **Performance** - Connection pooling, efficient queries

## 📋 Code Review Checklist

- [ ] All functions have explicit return types
- [ ] Comprehensive error handling implemented
- [ ] Database queries use parameters
- [ ] API responses follow standard format
- [ ] No TypeScript errors
- [ ] Proper logging for debugging
- [ ] Security considerations addressed
- [ ] Performance optimizations applied

## 🔧 Service Integration

### MCP Service Integration
- All MCP tools must be properly typed
- Tool execution must handle errors gracefully
- Responses must follow MCP protocol standards

### Database Integration
- Use connection pooling
- Handle connection errors
- Implement proper transaction handling
- Use parameterized queries for security

### Authentication Integration
- JWT token validation
- User session management
- Password hashing with bcrypt
- Role-based access control (future)
