# Client SDK - GraphQL Integration

## Overview

Alternative to REST services - use GraphQL for flexible, powerful queries with a single service.

## GraphQL Service

Create `src/backend/services/GraphQLService.ts`:

```typescript
import SKAFTIN_CONFIG from '../config/skaftin.config';
import { getAuthHeaders } from '../utils/auth';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

/**
 * GraphQL client for Skaftin
 */
class GraphQLService {
  private endpoint: string;

  constructor() {
    this.endpoint = `${SKAFTIN_CONFIG.apiUrl}/api/graphql`;
  }

  /**
   * Execute GraphQL query
   */
  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await this.request<T>({ query, variables });
    
    if (response.errors) {
      throw new Error(response.errors[0].message);
    }
    
    return response.data;
  }

  /**
   * Execute GraphQL mutation
   */
  async mutate<T>(mutation: string, variables?: Record<string, any>): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  /**
   * Make GraphQL request
   */
  private async request<T>(body: GraphQLRequest): Promise<GraphQLResponse<T>> {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export default new GraphQLService();
```

## Usage Examples

### Query Data

```typescript
import GraphQLService from './backend/services/GraphQLService';
import { Association } from './backend/schemas/Association.schema';

// List all associations
interface TablesResponse {
  tables: Array<{ table_name: string }>;
}

const result = await GraphQLService.query<TablesResponse>(`
  query {
    tables(projectId: 1) {
      table_name
    }
  }
`);

console.log(result.tables);
```

### Select Data with Variables

```typescript
interface SelectDataResponse {
  selectData: {
    rows: Association[];
  };
}

const result = await GraphQLService.query<SelectDataResponse>(
  `
    query SelectAssociations($projectId: Int!, $tableName: String!, $limit: Int) {
      selectData(projectId: $projectId, tableName: $tableName, limit: $limit) {
        rows
      }
    }
  `,
  {
    projectId: 1,
    tableName: 'associations',
    limit: 10,
  }
);

const associations = result.selectData.rows;
```

### Insert Data (Mutation)

```typescript
interface InsertResponse {
  insertData: {
    success: boolean;
    data: Association;
  };
}

const result = await GraphQLService.mutate<InsertResponse>(
  `
    mutation CreateAssociation($projectId: Int!, $tableName: String!, $data: JSON!) {
      insertData(projectId: $projectId, tableName: $tableName, data: $data) {
        success
        data
      }
    }
  `,
  {
    projectId: 1,
    tableName: 'associations',
    data: {
      name: 'New Association',
      location: 'Johannesburg',
      province: 'Gauteng',
      user_id: 'user_123',
    },
  }
);

const newAssociation = result.insertData.data;
```

### Update Data

```typescript
interface UpdateResponse {
  updateData: {
    success: boolean;
    data: Vehicle[];
  };
}

const result = await GraphQLService.mutate<UpdateResponse>(
  `
    mutation UpdateVehicle($projectId: Int!, $tableName: String!, $data: JSON!, $where: JSON!) {
      updateData(projectId: $projectId, tableName: $tableName, data: $data, where: $where) {
        success
        data
      }
    }
  `,
  {
    projectId: 1,
    tableName: 'vehicles',
    data: { status: 'active' },
    where: { id: 123 },
  }
);
```

### Delete Data

```typescript
interface DeleteResponse {
  deleteData: {
    success: boolean;
    deletedCount: number;
  };
}

const result = await GraphQLService.mutate<DeleteResponse>(
  `
    mutation DeleteVehicle($projectId: Int!, $tableName: String!, $where: JSON!) {
      deleteData(projectId: $projectId, tableName: $tableName, where: $where) {
        success
        deletedCount
      }
    }
  `,
  {
    projectId: 1,
    tableName: 'vehicles',
    where: { id: 123 },
  }
);
```

## GraphQL Wrapper Services

Create typed wrappers around GraphQL operations:

```typescript
// services/AssociationGraphQLService.ts
import GraphQLService from './GraphQLService';
import { Association } from '../schemas/Association.schema';

class AssociationGraphQLService {
  async getAll(): Promise<Association[]> {
    const result = await GraphQLService.query(`
      query {
        selectData(projectId: 1, tableName: "associations") {
          rows
        }
      }
    `);
    return result.selectData.rows;
  }

  async create(data: CreateAssociationDto): Promise<Association> {
    const result = await GraphQLService.mutate(`
      mutation($data: JSON!) {
        insertData(projectId: 1, tableName: "associations", data: $data) {
          data
        }
      }
    `, { data });
    return result.insertData.data;
  }
}

export default new AssociationGraphQLService();
```

## Comparison: REST vs GraphQL

### REST Services
**Pros:**
- Simple, predictable
- One method per operation
- Easy to understand

**Cons:**
- Multiple requests for related data
- Fixed response structure

**Use When:**
- Simple CRUD operations
- Standard list/detail views
- Predictable data needs

### GraphQL Service
**Pros:**
- Fetch related data in one request
- Flexible response structure
- Request only what you need

**Cons:**
- More complex queries
- Learning curve

**Use When:**
- Complex data relationships
- Need related data
- Variable field requirements

## Example: Fetch Related Data

### REST (Multiple Requests)

```typescript
// Get association
const association = await AssociationService.findById(1);

// Get vehicles for association
const vehicles = await VehicleService.findByAssociation(1);

// Get drivers for each vehicle
const drivers = await Promise.all(
  vehicles
    .filter(v => v.driver_id)
    .map(v => DriverService.findById(v.driver_id!))
);
```

### GraphQL (Single Request)

```typescript
const result = await GraphQLService.query(`
  query {
    selectData(projectId: 1, tableName: "associations", where: {id: 1}) {
      rows
    }
    vehicles: selectData(projectId: 1, tableName: "vehicles", where: {association_id: 1}) {
      rows
    }
    drivers: selectData(projectId: 1, tableName: "drivers", where: {association_id: 1}) {
      rows
    }
  }
`);

const association = result.selectData.rows[0];
const vehicles = result.vehicles.rows;
const drivers = result.drivers.rows;
```

## React Hook with GraphQL

```typescript
// hooks/useGraphQL.ts
import { useState } from 'react';
import GraphQLService from '../services/GraphQLService';

export function useGraphQL<T>(query: string, variables?: any) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    try {
      setLoading(true);
      const result = await GraphQLService.query<T>(query, variables);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
}

// Usage:
const { data, loading, execute } = useGraphQL<TablesResponse>(`
  query { tables(projectId: 1) { table_name } }
`);

useEffect(() => { execute(); }, []);
```

## Best Practices

1. **Use REST for simple CRUD** - Easier to understand
2. **Use GraphQL for complex queries** - Fetch related data
3. **Type all responses** - Leverage TypeScript
4. **Handle errors gracefully** - User-friendly messages
5. **Cache when possible** - Reduce API calls

## Next Steps

Proceed to:
- `06-USAGE-EXAMPLES.md` - Complete real-world examples

