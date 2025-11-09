# Client SDK - Type Generation

## Overview

Generate TypeScript interfaces from your Skaftin database schema for full type safety in your client application.

## PostgreSQL to TypeScript Type Mapping

### Basic Type Mapping

| PostgreSQL Type | TypeScript Type |
|----------------|-----------------|
| `INTEGER`, `SERIAL`, `BIGINT` | `number` |
| `VARCHAR`, `TEXT`, `CHAR` | `string` |
| `BOOLEAN` | `boolean` |
| `TIMESTAMP`, `DATE`, `TIME` | `Date` |
| `JSONB`, `JSON` | `any` (or specific interface) |
| `UUID` | `string` |
| `NUMERIC`, `DECIMAL`, `REAL`, `DOUBLE` | `number` |
| `ARRAY` | `T[]` |

### Nullable Columns
- `NOT NULL` columns → Required property
- Nullable columns → Optional property (`field?: type`)

## Manual Type Generation

Until auto-generation is built, create types manually from your schema.

### Example: Users Table

**Database Schema:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

**Generated TypeScript:**

Create `src/backend/schemas/User.schema.ts`:

```typescript
/**
 * User entity type
 * Generated from table: users
 */
export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;  // Nullable in DB
  created_at: Date;
  is_active: boolean;
}

/**
 * DTO for creating a new user
 * Excludes auto-generated fields
 */
export interface CreateUserDto {
  email: string;
  username: string;
  full_name?: string;
  is_active?: boolean;
}

/**
 * DTO for updating a user
 * All fields optional
 */
export interface UpdateUserDto {
  email?: string;
  username?: string;
  full_name?: string;
  is_active?: boolean;
}

/**
 * Query options for filtering users
 */
export interface UserQueryOptions {
  where?: Partial<User>;
  limit?: number;
  offset?: number;
  orderBy?: keyof User;
  order?: 'ASC' | 'DESC';
}
```

## Schema File Template

Use this template for each table:

```typescript
/**
 * [TableName] entity type
 * Generated from table: [table_name]
 */
export interface [TableName] {
  // Map each column to TypeScript
  id: number;                    // SERIAL PRIMARY KEY
  [column_name]: [type];         // Each column
  created_at: Date;              // TIMESTAMP
  updated_at: Date;              // TIMESTAMP
}

/**
 * DTO for creating [TableName]
 */
export interface Create[TableName]Dto {
  // Required fields only (exclude id, timestamps)
  [required_field]: [type];
  [optional_field]?: [type];
}

/**
 * DTO for updating [TableName]
 */
export interface Update[TableName]Dto {
  // All fields optional
  [field]?: [type];
}

/**
 * Query options for [TableName]
 */
export interface [TableName]QueryOptions {
  where?: Partial<[TableName]>;
  limit?: number;
  offset?: number;
  orderBy?: keyof [TableName];
  order?: 'ASC' | 'DESC';
}
```

## Example: Your Taxi Admin Tables

### associations Table

```typescript
// schemas/Association.schema.ts
export interface Association {
  id: number;
  name: string;
  location: string;
  province: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAssociationDto {
  name: string;
  location: string;
  province: string;
  user_id: string;
}

export interface UpdateAssociationDto {
  name?: string;
  location?: string;
  province?: string;
}
```

### vehicles Table

```typescript
// schemas/Vehicle.schema.ts
export interface Vehicle {
  id: number;
  association_id: number;
  driver_id?: number;  // Nullable
  registration_number: string;
  status: 'active' | 'onboarding' | 'inactive' | 'breakdown';
  created_at: Date;
  updated_at: Date;
}

export interface CreateVehicleDto {
  association_id: number;
  driver_id?: number;
  registration_number: string;
  status: 'active' | 'onboarding' | 'inactive' | 'breakdown';
}

export interface UpdateVehicleDto {
  driver_id?: number;
  registration_number?: string;
  status?: 'active' | 'onboarding' | 'inactive' | 'breakdown';
}
```

### drivers Table

```typescript
// schemas/Driver.schema.ts
export interface Driver {
  id: number;
  association_id: number;
  user_id: string;
  license_number: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDriverDto {
  association_id: number;
  user_id: string;
  license_number: string;
  status: string;
}

export interface UpdateDriverDto {
  license_number?: string;
  status?: string;
}
```

## Create Index File

Create `src/backend/schemas/index.ts`:

```typescript
// Export all schemas
export * from './User.schema';
export * from './Association.schema';
export * from './Vehicle.schema';
export * from './Driver.schema';

// Add more as you create them
```

## Using Generated Types

```typescript
import { Association, CreateAssociationDto } from './backend/schemas';

// Function with type safety
async function createAssociation(data: CreateAssociationDto): Promise<Association> {
  const response = await post<Association>('/api/associations', data);
  return response.data;
}

// TypeScript will enforce:
const newAssoc: CreateAssociationDto = {
  name: 'Test Association',      // ✅ Required
  location: 'Johannesburg',      // ✅ Required
  province: 'Gauteng',           // ✅ Required
  user_id: 'user_123',           // ✅ Required
  // id: 1                       // ❌ Error: not in DTO
};
```

## Common Patterns

### Enum Types

For columns with limited values:

```typescript
export type VehicleStatus = 'active' | 'onboarding' | 'inactive' | 'breakdown';
export type DriverStatus = 'active' | 'pending' | 'suspended' | 'terminated';
export type MemberRole = 'admin' | 'dev' | 'viewer';
```

### JSON Columns

For JSONB columns:

```typescript
export interface Vehicle {
  id: number;
  metadata: VehicleMetadata;  // Typed JSON
}

export interface VehicleMetadata {
  make: string;
  model: string;
  year: number;
  color: string;
}
```

### Relations

Express relationships in types:

```typescript
export interface Vehicle {
  id: number;
  association_id: number;
  driver_id?: number;
  
  // Optional: Include related data
  association?: Association;
  driver?: Driver;
}
```

## Automated Generation (Future)

When SDK generator is built, it will:

1. Query `information_schema.columns` for table metadata
2. Generate interfaces automatically
3. Create DTOs based on constraints
4. Export all types in index
5. Download as TypeScript files

**Command (planned):**
```typescript
// In Skaftin backend
GET /api/sdk/:projectId/types
// Returns: All TypeScript interface files
```

## Next Steps

After creating types, proceed to:
- `04-SERVICE-GENERATION.md` - Create API service classes

