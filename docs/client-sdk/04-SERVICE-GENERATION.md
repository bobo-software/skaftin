# Client SDK - Service Generation

## Overview

Create typed API service classes for each database table with methods for common operations (CRUD, querying, etc.).

## Base Service Class

Create `src/backend/services/TableService.ts`:

```typescript
import { get, post, put, del } from '../utils/request';
import { ApiResponse } from '../types/api.types';

export interface QueryOptions<T> {
  where?: Partial<T>;
  limit?: number;
  offset?: number;
  columns?: (keyof T)[];
}

/**
 * Generic table service with CRUD operations
 * Project ID is automatically extracted from API key in headers
 */
export class TableService<T extends { id: number }> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get all records
   */
  async findAll(options?: QueryOptions<T>): Promise<T[]> {
    const response = await post<T[]>(
      `/app-api/database/tables/${this.tableName}/select`,
      {
        columns: options?.columns,
        where: options?.where,
        limit: options?.limit || 100,
        offset: options?.offset || 0,
      }
    );
    return response.data;
  }

  /**
   * Get single record by ID
   */
  async findById(id: number): Promise<T | null> {
    const response = await post<T[]>(
      `/app-api/database/tables/${this.tableName}/select`,
      {
        where: { id },
        limit: 1,
      }
    );
    return response.data[0] || null;
  }

  /**
   * Create new record
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const response = await post<T>(
      `/app-api/database/tables/${this.tableName}/insert`,
      { data }
    );
    return response.data;
  }

  /**
   * Update record by ID
   */
  async update(id: number, data: Partial<Omit<T, 'id'>>): Promise<T> {
    const response = await put<T[]>(
      `/app-api/database/tables/${this.tableName}/update`,
      {
        data,
        where: { id },
      }
    );
    return response.data[0];
  }

  /**
   * Delete record by ID
   */
  async delete(id: number): Promise<void> {
    await del(
      `/app-api/database/tables/${this.tableName}/delete`,
      { where: { id } }
    );
  }

  /**
   * Query with custom SQL
   */
  async query(sql: string): Promise<T[]> {
    const response = await post<any>(
      `/app-api/database/query`,
      { query: sql }
    );
    return response.data.rows;
  }

  /**
   * Count records
   */
  async count(where?: Partial<T>): Promise<number> {
    const sql = where
      ? `SELECT COUNT(*) FROM "${this.tableName}" WHERE ${this.buildWhereClause(where)}`
      : `SELECT COUNT(*) FROM "${this.tableName}"`;
    
    const response = await post<any>(
      `/app-api/database/query`,
      { query: sql }
    );
    return parseInt(response.data.rows[0].count);
  }

  /**
   * Build WHERE clause from object
   */
  protected buildWhereClause(where: Partial<T>): string {
    return Object.entries(where)
      .map(([key, value]) => `"${key}" = '${value}'`)
      .join(' AND ');
  }
}
```

## Per-Table Services

Create one service file per table.

### Example: Association Service

Create `src/backend/services/AssociationService.ts`:

```typescript
import { Association, CreateAssociationDto, UpdateAssociationDto } from '../schemas/Association.schema';
import { TableService } from './TableService';

/**
 * Service for managing taxi associations
 */
class AssociationService extends TableService<Association> {
  constructor() {
    super('associations');
  }

  /**
   * Custom method: Find associations by province
   */
  async findByProvince(province: string): Promise<Association[]> {
    return this.findAll({ where: { province } as Partial<Association> });
  }

  /**
   * Custom method: Find associations by user
   */
  async findByUser(userId: string): Promise<Association[]> {
    return this.findAll({ where: { user_id: userId } as Partial<Association> });
  }

  /**
   * Typed create method
   */
  async createAssociation(data: CreateAssociationDto): Promise<Association> {
    return this.create(data as any);
  }

  /**
   * Typed update method
   */
  async updateAssociation(id: number, data: UpdateAssociationDto): Promise<Association> {
    return this.update(id, data as any);
  }
}

// Export singleton instance
export default new AssociationService();
```

### Example: Vehicle Service

Create `src/backend/services/VehicleService.ts`:

```typescript
import { Vehicle, CreateVehicleDto, UpdateVehicleDto } from '../schemas/Vehicle.schema';
import { TableService } from './TableService';

class VehicleService extends TableService<Vehicle> {
  constructor() {
    super('vehicles');
  }

  /**
   * Get vehicles by association
   */
  async findByAssociation(associationId: number): Promise<Vehicle[]> {
    return this.findAll({ where: { association_id: associationId } as Partial<Vehicle> });
  }

  /**
   * Get vehicles by status
   */
  async findByStatus(status: Vehicle['status']): Promise<Vehicle[]> {
    return this.findAll({ where: { status } as Partial<Vehicle> });
  }

  /**
   * Get active vehicles
   */
  async findActive(): Promise<Vehicle[]> {
    return this.findByStatus('active');
  }

  /**
   * Get vehicles by driver
   */
  async findByDriver(driverId: number): Promise<Vehicle[]> {
    return this.findAll({ where: { driver_id: driverId } as Partial<Vehicle> });
  }

  /**
   * Update vehicle status
   */
  async updateStatus(id: number, status: Vehicle['status']): Promise<Vehicle> {
    return this.update(id, { status } as any);
  }
}

export default new VehicleService();
```

### Example: Driver Service

Create `src/backend/services/DriverService.ts`:

```typescript
import { Driver, CreateDriverDto, UpdateDriverDto } from '../schemas/Driver.schema';
import { TableService } from './TableService';

class DriverService extends TableService<Driver> {
  constructor() {
    super('drivers');
  }

  /**
   * Get drivers by association
   */
  async findByAssociation(associationId: number): Promise<Driver[]> {
    return this.findAll({ where: { association_id: associationId } as Partial<Driver> });
  }

  /**
   * Get drivers by status
   */
  async findByStatus(status: string): Promise<Driver[]> {
    return this.findAll({ where: { status } as Partial<Driver> });
  }

  /**
   * Get driver by user ID
   */
  async findByUser(userId: string): Promise<Driver | null> {
    const drivers = await this.findAll({ where: { user_id: userId } as Partial<Driver>, limit: 1 });
    return drivers[0] || null;
  }
}

export default new DriverService();
```

## Service Index File

Create `src/backend/services/index.ts`:

```typescript
// Export all services
export { default as AssociationService } from './AssociationService';
export { default as VehicleService } from './VehicleService';
export { default as DriverService } from './DriverService';
export { default as UserService } from './UserService';

// Export base service
export { TableService } from './TableService';

// Export types
export type { QueryOptions } from './TableService';
```

## API Types

Create `src/backend/types/api.types.ts`:

```typescript
/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  message: string;
  error: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Query result from raw SQL
 */
export interface QueryResult {
  rows: any[];
  rowCount: number;
  columns: string[];
  executionTime: number;
}
```

## Usage in React Components

```typescript
import { useEffect, useState } from 'react';
import AssociationService from './backend/services/AssociationService';
import { Association } from './backend/schemas/Association.schema';

function AssociationsList() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssociations();
  }, []);

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const data = await AssociationService.findAll();
      setAssociations(data);
    } catch (error) {
      console.error('Failed to load associations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {associations.map((assoc) => (
        <li key={assoc.id}>
          {assoc.name} - {assoc.location}
        </li>
      ))}
    </ul>
  );
}
```

## Advanced Patterns

### Custom Queries

```typescript
// In your service
async findActiveWithDriver(): Promise<Vehicle[]> {
  const sql = `
    SELECT v.*, d.license_number 
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver_id = d.id
    WHERE v.status = 'active'
  `;
  return this.query(sql);
}
```

### Bulk Operations

```typescript
async bulkCreate(items: CreateVehicleDto[]): Promise<Vehicle[]> {
  const response = await post<Vehicle[]>(
    `/app-api/database/tables/${this.tableName}/bulk-insert`,
    { dataArray: items }
  );
  return response.data;
}
```

### Transactions

```typescript
async createWithRelations(vehicleData: CreateVehicleDto, driverData: CreateDriverDto) {
  // Use raw SQL for transaction
  const sql = `
    BEGIN;
    INSERT INTO drivers (...) VALUES (...) RETURNING id;
    INSERT INTO vehicles (driver_id, ...) VALUES ((SELECT id FROM drivers WHERE ...), ...);
    COMMIT;
  `;
  return this.query(sql);
}
```

## React Hooks Pattern

Create `src/backend/hooks/useTable.ts`:

```typescript
import { useState, useEffect } from 'react';
import { TableService } from '../services/TableService';

export function useTable<T extends { id: number }>(service: TableService<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const result = await service.findAll();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return { data, loading, error, refetch: fetchAll };
}

// Usage:
const { data: vehicles, loading } = useTable(VehicleService);
```

## Next Steps

Proceed to:
- `05-GRAPHQL-INTEGRATION.md` - GraphQL alternative
- `06-USAGE-EXAMPLES.md` - Complete examples

