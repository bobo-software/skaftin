# Hooks and Services Implementation Guide

Complete implementations for React hooks and service classes used in Skaftin SDK integration.

## Table of Contents

1. [Services](#services)
   - [TableService](#tableservice-base-service)
   - [AppAuthService](#appauthservice-user-management)
   - [WebSocketService](#websocketservice-real-time-updates)
   - [GraphQLService](#graphqlservice-graphql-queries)
   - [BucketService](#bucketservice-storage-management)
2. [Hooks](#hooks)
   - [useWebSocket](#usewebsocket-connection-status)
   - [useDatabaseEvents](#usedatabaseevents-listen-to-changes)
   - [useProjectEvents](#useprojectevents-listen-to-project-events)
   - [useAutoRefresh](#useautorefresh-auto-refresh-data)

---

## Services

### TableService (Base Service)

Base class for all table operations. Extend this to create custom services.

**Location:** `src/backend/services/TableService.ts`

```typescript
/**
 * Base Table Service
 * 
 * Generic service class for table operations using Skaftin REST API
 */

import { get, post, put, del } from '../utils/request';
import ApiRoutes from '../../constants/ApiRoutes';
import type { QueryOptions } from '../types/api.types';

export class TableService<T> {
  protected tableName: string;
  
  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Helper to build endpoint with table name (no project ID needed - auto-extracted from API key)
   */
  private buildEndpoint(route: string, replacements: Record<string, string | number> = {}): string {
    let endpoint = route.replace(':tableName', this.tableName);
    
    Object.entries(replacements).forEach(([key, value]) => {
      endpoint = endpoint.replace(`:${key}`, value.toString());
    });
    
    return endpoint;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(options?: QueryOptions): Promise<T[]> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.GET_DATA);
      
      const response = await get<T[]>(endpoint, {
        columns: options?.columns ? JSON.stringify(options.columns) : undefined,
        where: options?.where ? JSON.stringify(options.where) : undefined,
        limit: options?.limit || 100,
        offset: options?.offset || 0,
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: number): Promise<T | null> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.GET_DATA_BY_ID);
      const response = await get<T[]>(endpoint, {
        where: JSON.stringify({ id }),
        limit: 1,
      });
      
      return response.data[0] || null;
    } catch (error) {
      console.error(`Failed to fetch ${this.tableName} by ID:`, error);
      return null;
    }
  }

  /**
   * Find records matching a condition
   */
  async findWhere(where: Record<string, any>, options?: QueryOptions): Promise<T[]> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.GET_DATA);
      
      const response = await get<T[]>(endpoint, {
        where: JSON.stringify(where),
        columns: options?.columns ? JSON.stringify(options.columns) : undefined,
        limit: options?.limit || 100,
        offset: options?.offset || 0,
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to query ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.CREATE_DATA);
      const response = await post<T>(endpoint, { data });
      return response.data;
    } catch (error) {
      console.error(`Failed to create ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: number, data: Partial<T>): Promise<T> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.UPDATE_DATA);
      const response = await put<T[]>(endpoint, {
        data,
        where: { id },
      });
      return response.data[0];
    } catch (error) {
      console.error(`Failed to update ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number): Promise<boolean> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.DELETE_DATA);
      await del(endpoint, { where: { id } });
      return true;
    } catch (error) {
      console.error(`Failed to delete ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Bulk insert multiple records
   */
  async bulkInsert(dataArray: Partial<T>[]): Promise<void> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.BULK_INSERT);
      await post(endpoint, { dataArray });
    } catch (error) {
      console.error(`Failed to bulk insert ${this.tableName}:`, error);
      throw error;
    }
  }
}

export default TableService;
```

**Usage Example:**
```typescript
import TableService from './TableService';

interface Shop {
  id: number;
  name: string;
  address?: string;
}

class ShopService extends TableService<Shop> {
  constructor() {
    super('shops');
  }

  // Add custom methods
  async findActive(): Promise<Shop[]> {
    return this.findWhere({ is_active: true });
  }
}

export default new ShopService();
```

---

### AppAuthService (User Management)

Service for managing application users, roles, and authentication.

**Location:** `src/backend/services/AppAuthService.ts`

```typescript
/**
 * App User Authentication Service
 * 
 * Service for managing application users, roles, and authentication
 */

import { post, put, del, get } from '../utils/request';
import ApiRoutes from '../../constants/ApiRoutes';
import type {
  AppUser,
  AppRole,
  CreateUserDto,
  UpdateUserDto,
  UserListFilters,
  PaginatedResponse,
} from '../types/api.types';

export class AppAuthService {
  /**
   * Helper to build endpoint with replacements (no project ID needed - auto-extracted from API key)
   */
  private static buildEndpoint(route: string, replacements: Record<string, string | number> = {}): string {
    let endpoint = route;
    Object.entries(replacements).forEach(([key, value]) => {
      endpoint = endpoint.replace(`:${key}`, value.toString());
    });
    
    return endpoint;
  }

  /**
   * List users with optional filters
   */
  static async listUsers(filters?: UserListFilters): Promise<PaginatedResponse<AppUser>> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.search) params.append('search', filters.search);
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.role_id) params.append('role_id', filters.role_id.toString());
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const queryString = params.toString();
      const endpoint = this.buildEndpoint(ApiRoutes.GET_USERS);
      const fullEndpoint = `${endpoint}${queryString ? '?' + queryString : ''}`;
      
      const response = await post<PaginatedResponse<AppUser>>(fullEndpoint, {});
      return response.data;
    } catch (error) {
      console.error('Failed to list users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<AppUser> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.GET_USER, { userId });
      const response = await post<AppUser>(endpoint, {});
      return response.data;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  static async createUser(data: CreateUserDto): Promise<AppUser> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.CREATE_USER);
      const response = await post<AppUser>(endpoint, data);
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: UpdateUserDto): Promise<AppUser> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.UPDATE_USER, { userId });
      const response = await put<AppUser>(endpoint, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete user (deactivate or permanently remove)
   */
  static async deleteUser(userId: string, permanent: boolean = false): Promise<void> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.DELETE_USER, { userId });
      await post(endpoint, { permanent });
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * List all roles
   */
  static async listRoles(): Promise<AppRole[]> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.GET_ROLES);
      const response = await post<AppRole[]>(endpoint, {});
      return response.data;
    } catch (error) {
      console.error('Failed to list roles:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  static async assignRole(userId: string, roleId: number): Promise<void> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.ASSIGN_ROLE, { userId });
      await post(endpoint, { role_id: roleId });
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  static async removeRole(userId: string, roleId: number): Promise<void> {
    try {
      const endpoint = this.buildEndpoint(ApiRoutes.REMOVE_ROLE, { userId, roleId });
      await del(endpoint);
    } catch (error) {
      console.error('Failed to remove role:', error);
      throw error;
    }
  }
}

// Export singleton instance
const appAuthService = new AppAuthService();
export default appAuthService;
```

**Usage Example:**
```typescript
import { appAuthService } from './backend/services';

// List users
const { rows: users } = await appAuthService.listUsers({
  search: 'john',
  is_active: true,
  page: 1,
  limit: 10
});

// Create user
const newUser = await appAuthService.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secure123'
});
```

---

### WebSocketService (Real-Time Updates)

Service for WebSocket connections and real-time database change notifications.

**Location:** `src/backend/services/WebSocketService.ts`

**Dependencies:** Install `socket.io-client`:
```bash
npm install socket.io-client
```

**Complete Implementation:**

```typescript
import { io, Socket } from 'socket.io-client';
import { getApiUrl, getAuthHeaders } from '../utils/auth';

/**
 * Database change event types
 */
export type DatabaseEventType = 
  | 'insert' 
  | 'update' 
  | 'delete' 
  | 'create_table' 
  | 'drop_table'
  | 'rename_table'
  | 'add_column'
  | 'alter_column'
  | 'drop_column'
  | 'create_constraint'
  | 'drop_constraint'
  | 'create_cron_job'
  | 'update_cron_job'
  | 'delete_cron_job'
  | 'toggle_cron_job'
  | 'import_dump';

/**
 * Database change event
 */
export interface DatabaseEvent {
  type: DatabaseEventType;
  projectId: string;
  tableName: string;
  data?: any;
  oldData?: any;
  timestamp: string;
}

/**
 * Project-level event
 */
export interface ProjectEvent {
  type: string;
  projectId: string;
  data: any;
  timestamp: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  isConnected: boolean;
  reconnectAttempts: number;
  socketId: string | null;
}

/**
 * WebSocket service for real-time updates
 * 
 * Automatically connects to Skaftin WebSocket server using API URL from config.
 * Project ID is automatically extracted from API key/token.
 */
class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentProjectId: string | null = null;

  constructor() {
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  private connect() {
    const apiUrl = getApiUrl();
    
    // Get auth headers to include API key/token
    const authHeaders = getAuthHeaders();
    const extraHeaders: Record<string, string> = {};
    
    // Extract API key or access token from headers
    if ('x-api-key' in authHeaders) {
      extraHeaders['x-api-key'] = authHeaders['x-api-key'] as string;
    } else if ('x-access-token' in authHeaders) {
      extraHeaders['x-access-token'] = authHeaders['x-access-token'] as string;
    }
    
    this.socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      extraHeaders,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Skaftin WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin project room if we were in one
      if (this.currentProjectId) {
        this.joinProject(this.currentProjectId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 Failed to reconnect to WebSocket server');
    });

    // Handle project room join confirmation
    this.socket.on('joined-project', ({ projectId, room }: { projectId: string; room: string }) => {
      console.log(`📁 Joined project room: ${room}`);
    });

    // Handle project room leave confirmation
    this.socket.on('left-project', ({ projectId, room }: { projectId: string; room: string }) => {
      console.log(`📁 Left project room: ${room}`);
    });
  }

  /**
   * Join a project room to receive project-specific updates
   * Project ID is automatically extracted from your API key/token
   */
  joinProject(projectId: string) {
    if (this.socket && this.isConnected) {
      this.currentProjectId = projectId;
      this.socket.emit('join-project', projectId);
      console.log(`📁 Joining project room: ${projectId}`);
    } else {
      // Store project ID to join when connected
      this.currentProjectId = projectId;
    }
  }

  /**
   * Leave a project room
   */
  leaveProject(projectId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-project', projectId);
      if (this.currentProjectId === projectId) {
        this.currentProjectId = null;
      }
      console.log(`📁 Leaving project room: ${projectId}`);
    }
  }

  /**
   * Listen for database change events
   */
  onDatabaseChange(callback: (event: DatabaseEvent) => void) {
    if (this.socket) {
      this.socket.on('database-change', callback);
    }
  }

  /**
   * Remove database change listener
   */
  offDatabaseChange(callback: (event: DatabaseEvent) => void) {
    if (this.socket) {
      this.socket.off('database-change', callback);
    }
  }

  /**
   * Listen for project events
   */
  onProjectEvent(callback: (event: ProjectEvent) => void) {
    if (this.socket) {
      this.socket.on('project-event', callback);
    }
  }

  /**
   * Remove project event listener
   */
  offProjectEvent(callback: (event: ProjectEvent) => void) {
    if (this.socket) {
      this.socket.off('project-event', callback);
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id || null,
    };
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentProjectId = null;
    }
  }

  /**
   * Reconnect to server
   */
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

// Export singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;
export type { DatabaseEvent, ProjectEvent, ConnectionStatus, DatabaseEventType };
```

**Usage:**
```typescript
import webSocketService from './backend/services/WebSocketService';
import { getProjectId } from './backend/utils/auth';

// Join project room
const projectId = getProjectId();
webSocketService.joinProject(projectId);

// Listen to database changes
webSocketService.onDatabaseChange((event) => {
  console.log('Database changed:', event);
  // Handle the change
});

// Get connection status
const status = webSocketService.getConnectionStatus();
console.log('Connected:', status.isConnected);
```

---

### GraphQLService (GraphQL Queries)

Service for executing GraphQL queries and mutations.

**Location:** `src/backend/services/GraphQLService.ts`

```typescript
/**
 * GraphQL Service
 * 
 * Service for executing GraphQL queries and mutations
 */

import { post } from '../utils/request';
import ApiRoutes from '../../constants/ApiRoutes';
import type { GraphQLResponse } from '../types/api.types';

export class GraphQLService {
  /**
   * Execute a GraphQL query
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse<T>> {
    try {
      const response = await post<GraphQLResponse<T>>(ApiRoutes.GRAPHQL, {
        query,
        variables,
      });
      return response.data;
    } catch (error) {
      console.error('GraphQL query failed:', error);
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse<T>> {
    return this.query<T>(mutation, variables);
  }
}

// Export singleton instance
const graphQLService = new GraphQLService();
export default graphQLService;
```

**Usage Example:**
```typescript
import { graphQLService } from './backend/services';

// Query
const response = await graphQLService.query(`
  query {
    shops {
      id
      name
      address
    }
  }
`);

// Mutation
const result = await graphQLService.mutate(`
  mutation CreateShop($name: String!) {
    createShop(name: $name) {
      id
      name
    }
  }
`, { name: 'My Shop' });
```

---

### BucketService (Storage Management)

Service for managing storage buckets and files.

**Location:** `src/backend/services/BucketService.ts`

**Note:** See storage documentation for complete implementation. Basic structure:

```typescript
export class BucketService {
  async listBuckets(): Promise<Bucket[]>
  async createBucket(name: string): Promise<Bucket>
  async deleteBucket(name: string): Promise<void>
  async uploadFile(bucketName: string, file: File, path?: string): Promise<void>
  async downloadFile(bucketName: string, filePath: string): Promise<Blob>
  async deleteFile(bucketName: string, filePath: string): Promise<void>
}
```

---

## Hooks

### useWebSocket (Connection Status)

Hook for WebSocket connection status.

**Location:** `src/backend/hooks/useWebSocket.ts`

```typescript
import { useEffect, useState } from 'react';
import webSocketService, { ConnectionStatus } from '../services/WebSocketService';

/**
 * Hook for WebSocket connection status
 */
export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>(
    webSocketService.getConnectionStatus()
  );

  useEffect(() => {
    const updateStatus = () => {
      setStatus(webSocketService.getConnectionStatus());
    };

    // Update status periodically
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...status,
    reconnect: () => webSocketService.reconnect(),
    disconnect: () => webSocketService.disconnect(),
  };
}
```

**Usage Example:**
```typescript
import { useWebSocket } from './backend/hooks/useWebSocket';

function MyComponent() {
  const { isConnected, reconnectAttempts, reconnect } = useWebSocket();

  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {reconnectAttempts > 0 && (
        <button onClick={reconnect}>Reconnect</button>
      )}
    </div>
  );
}
```

---

### useDatabaseEvents (Listen to Changes)

Hook for listening to database change events.

**Location:** `src/backend/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef } from 'react';
import webSocketService, { DatabaseEvent } from '../services/WebSocketService';

/**
 * Hook for listening to database events
 * 
 * @param projectId - Project ID (optional, uses current project from API key)
 * @param tableName - Specific table to listen to (optional, listens to all if not provided)
 * @param onEvent - Callback when event is received
 */
export function useDatabaseEvents(
  projectId: string | null,
  tableName: string | null,
  onEvent: (event: DatabaseEvent) => void
) {
  const callbackRef = useRef(onEvent);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId) return;

    // Join project room
    webSocketService.joinProject(projectId);

    // Create stable callback
    const handleEvent = (event: DatabaseEvent) => {
      // Filter by table name if provided
      if (tableName && event.tableName !== tableName) {
        return;
      }
      callbackRef.current(event);
    };

    // Register listener
    webSocketService.onDatabaseChange(handleEvent);

    // Cleanup
    return () => {
      webSocketService.offDatabaseChange(handleEvent);
      webSocketService.leaveProject(projectId);
    };
  }, [projectId, tableName]);
}
```

**Usage Example:**
```typescript
import { useDatabaseEvents } from './backend/hooks/useWebSocket';
import { getProjectId } from './backend/utils/auth';

function ShopsList() {
  const projectId = getProjectId();

  useDatabaseEvents(projectId, 'shops', (event) => {
    console.log('Shop changed:', event);
    // Refresh your data here
  });

  // ... rest of component
}
```

---

### useProjectEvents (Listen to Project Events)

Hook for listening to project-level events.

**Location:** `src/backend/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef } from 'react';
import webSocketService, { ProjectEvent } from '../services/WebSocketService';

/**
 * Hook for listening to project events
 * 
 * @param projectId - Project ID
 * @param onEvent - Callback when event is received
 */
export function useProjectEvents(
  projectId: string | null,
  onEvent: (event: ProjectEvent) => void
) {
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId) return;

    webSocketService.joinProject(projectId);

    const handleEvent = (event: ProjectEvent) => {
      callbackRef.current(event);
    };

    webSocketService.onProjectEvent(handleEvent);

    return () => {
      webSocketService.offProjectEvent(handleEvent);
      webSocketService.leaveProject(projectId);
    };
  }, [projectId]);
}
```

---

### useAutoRefresh (Auto-Refresh Data)

Hook for automatically refreshing data when database changes occur.

**Location:** `src/backend/hooks/useWebSocket.ts`

```typescript
import { useDatabaseEvents } from './useDatabaseEvents';

/**
 * Hook for automatic data refresh on database changes
 * 
 * @param projectId - Project ID
 * @param tableName - Table to watch
 * @param refetch - Function to refetch data
 */
export function useAutoRefresh(
  projectId: string | null,
  tableName: string | null,
  refetch: () => void | Promise<void>
) {
  useDatabaseEvents(projectId, tableName, (event) => {
    console.log('🔄 Auto-refreshing due to:', event.type, event.tableName);
    refetch();
  });
}
```

**Usage Example:**
```typescript
import { useAutoRefresh } from './backend/hooks/useWebSocket';
import { getProjectId } from './backend/utils/auth';
import { useState, useEffect } from 'react';
import { shopService } from './backend/services';

function ShopsList() {
  const [shops, setShops] = useState([]);
  const projectId = getProjectId();

  const loadShops = async () => {
    const data = await shopService.findAll();
    setShops(data);
  };

  useEffect(() => {
    loadShops();
  }, []);

  // Auto-refresh when shops table changes
  useAutoRefresh(projectId, 'shops', loadShops);

  return (
    <div>
      {shops.map(shop => (
        <div key={shop.id}>{shop.name}</div>
      ))}
    </div>
  );
}
```

---

## Services Index File

Create `src/backend/services/index.ts` to export all services:

```typescript
/**
 * Services Index
 * 
 * Central export point for all services
 */

export { TableService } from './TableService';
export { GraphQLService } from './GraphQLService';
export { AppAuthService } from './AppAuthService';
export { WebSocketService } from './WebSocketService';

export { default as dataService } from './DataService';
export { default as graphQLService } from './GraphQLService';
export { default as appAuthService } from './AppAuthService';
export { default as webSocketService } from './WebSocketService';

export type { DatabaseEvent, ProjectEvent, ConnectionStatus } from './WebSocketService';
```

---

## Next Steps

- **Create custom services:** Extend `TableService` for your tables
- **Use hooks in components:** Import hooks and use in React components
- **Real-time updates:** See `08-WEBSOCKET-INTEGRATION.md` for complete WebSocket setup
- **User management:** See `07-APP-USER-AUTHENTICATION.md` for complete auth setup

---

**Note:** These implementations are based on the actual code in this project. Copy-paste ready!

