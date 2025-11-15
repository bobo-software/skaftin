# Client SDK - WebSocket Real-Time Updates

## Overview

Skaftin supports real-time database updates via WebSocket using Socket.IO. When database changes occur (insert, update, delete, table creation, etc.), all connected clients in the project room receive instant notifications.

This guide shows you how to integrate WebSocket real-time updates into your external React application.

## Benefits

✅ **Real-Time Updates** - See database changes instantly without polling  
✅ **Automatic Refresh** - Update UI automatically when data changes  
✅ **Multi-User Support** - All users see changes made by others  
✅ **Project Scoped** - Events are scoped to specific projects  
✅ **Type Safe** - Full TypeScript support for events  

## Architecture

```
External React App
├── src/
│   ├── backend/
│   │   ├── services/
│   │   │   └── WebSocketService.ts    ← WebSocket client
│   │   └── hooks/
│   │       └── useWebSocket.ts        ← React hooks
│   └── components/
│       └── RealTimeList.tsx           ← Uses WebSocket
```

## Step 1: Install Dependencies

```bash
npm install socket.io-client
```

## Step 2: Create WebSocket Service

Create `src/backend/services/WebSocketService.ts`:

```typescript
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../config/skaftin.config';

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
    // Convert HTTP URL to WebSocket URL
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    
    this.socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
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
    this.socket.on('joined-project', ({ projectId, room }) => {
      console.log(`📁 Joined project room: ${room}`);
    });

    // Handle project room leave confirmation
    this.socket.on('left-project', ({ projectId, room }) => {
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

## Step 3: Create React Hooks

Create `src/backend/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import webSocketService, { 
  DatabaseEvent, 
  ProjectEvent, 
  ConnectionStatus 
} from '../services/WebSocketService';

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

## Step 4: Usage Examples

### Example 1: Real-Time List with Auto-Refresh

```typescript
// components/AssociationsList.tsx
import { useState, useEffect } from 'react';
import AssociationService from '../backend/services/AssociationService';
import { useAutoRefresh } from '../backend/hooks/useWebSocket';
import { Association } from '../backend/schemas/Association.schema';

export function AssociationsList() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get project ID from your config or context
  const projectId = 'your-project-id'; // Or from config/context

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const data = await AssociationService.findAll();
      setAssociations(data);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssociations();
  }, []);

  // Auto-refresh when associations table changes
  useAutoRefresh(projectId, 'associations', loadAssociations);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Taxi Associations</h1>
      <ul>
        {associations.map((assoc) => (
          <li key={assoc.id}>
            <strong>{assoc.name}</strong> - {assoc.location}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 2: Manual Event Handling

```typescript
// components/VehiclesList.tsx
import { useState, useEffect } from 'react';
import VehicleService from '../backend/services/VehicleService';
import { useDatabaseEvents } from '../backend/hooks/useWebSocket';
import { DatabaseEvent } from '../backend/services/WebSocketService';
import { Vehicle } from '../backend/schemas/Vehicle.schema';

export function VehiclesList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastEvent, setLastEvent] = useState<DatabaseEvent | null>(null);
  const projectId = 'your-project-id';

  const loadVehicles = async () => {
    const data = await VehicleService.findAll();
    setVehicles(data);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Listen to vehicle table changes
  useDatabaseEvents(projectId, 'vehicles', (event) => {
    setLastEvent(event);
    
    // Handle different event types
    switch (event.type) {
      case 'insert':
        // Add new vehicle to list
        if (event.data) {
          setVehicles(prev => [...prev, event.data]);
        }
        break;
      
      case 'update':
        // Update vehicle in list
        if (event.data) {
          setVehicles(prev =>
            prev.map(v => v.id === event.data.id ? event.data : v)
          );
        }
        break;
      
      case 'delete':
        // Remove vehicle from list
        if (event.data?.id) {
          setVehicles(prev => prev.filter(v => v.id !== event.data.id));
        }
        break;
      
      default:
        // Refresh all data for other events
        loadVehicles();
    }
  });

  return (
    <div>
      <h1>Vehicles</h1>
      {lastEvent && (
        <div className="notification">
          Last update: {lastEvent.type} at {new Date(lastEvent.timestamp).toLocaleTimeString()}
        </div>
      )}
      <ul>
        {vehicles.map((vehicle) => (
          <li key={vehicle.id}>
            {vehicle.registration_number} - {vehicle.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 3: Connection Status Indicator

```typescript
// components/ConnectionStatus.tsx
import { useWebSocket } from '../backend/hooks/useWebSocket';

export function ConnectionStatus() {
  const { isConnected, reconnectAttempts, reconnect } = useWebSocket();

  if (isConnected) {
    return (
      <div className="connection-status connected">
        <span className="dot"></span>
        Connected
      </div>
    );
  }

  return (
    <div className="connection-status disconnected">
      <span className="dot"></span>
      Disconnected
      {reconnectAttempts > 0 && (
        <span> (Reconnecting... {reconnectAttempts})</span>
      )}
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### Example 4: Multiple Table Monitoring

```typescript
// components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useDatabaseEvents } from '../backend/hooks/useWebSocket';
import AssociationService from '../backend/services/AssociationService';
import VehicleService from '../backend/services/VehicleService';
import DriverService from '../backend/services/DriverService';

interface DashboardStats {
  totalAssociations: number;
  totalVehicles: number;
  totalDrivers: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const projectId = 'your-project-id';

  const loadStats = async () => {
    const [associations, vehicles, drivers] = await Promise.all([
      AssociationService.findAll(),
      VehicleService.findAll(),
      DriverService.findAll(),
    ]);

    setStats({
      totalAssociations: associations.length,
      totalVehicles: vehicles.length,
      totalDrivers: drivers.length,
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Refresh stats when any table changes
  useDatabaseEvents(projectId, null, () => {
    console.log('🔄 Refreshing dashboard stats');
    loadStats();
  });

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Associations</h3>
          <p>{stats.totalAssociations}</p>
        </div>
        <div className="stat-card">
          <h3>Vehicles</h3>
          <p>{stats.totalVehicles}</p>
        </div>
        <div className="stat-card">
          <h3>Drivers</h3>
          <p>{stats.totalDrivers}</p>
        </div>
      </div>
    </div>
  );
}
```

### Example 5: Optimistic Updates with Rollback

```typescript
// components/OptimisticList.tsx
import { useState, useEffect } from 'react';
import VehicleService from '../backend/services/VehicleService';
import { useDatabaseEvents } from '../backend/hooks/useWebSocket';
import { Vehicle } from '../backend/schemas/Vehicle.schema';

export function OptimisticList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<number, Vehicle>>(new Map());
  const projectId = 'your-project-id';

  const loadVehicles = async () => {
    const data = await VehicleService.findAll();
    setVehicles(data);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Listen for server-confirmed updates
  useDatabaseEvents(projectId, 'vehicles', (event) => {
    if (event.type === 'update' && event.data) {
      // Remove from optimistic updates (server confirmed)
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(event.data.id);
        return next;
      });
      
      // Update with server data
      setVehicles(prev =>
        prev.map(v => v.id === event.data.id ? event.data : v)
      );
    }
  });

  const handleUpdate = async (id: number, data: Partial<Vehicle>) => {
    // Optimistic update
    const optimisticVehicle = { ...vehicles.find(v => v.id === id)!, ...data };
    setOptimisticUpdates(prev => new Map(prev).set(id, optimisticVehicle));
    setVehicles(prev =>
      prev.map(v => v.id === id ? optimisticVehicle : v)
    );

    try {
      // Send to server
      await VehicleService.update(id, data);
    } catch (error) {
      // Rollback on error
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      loadVehicles(); // Reload from server
      alert('Update failed');
    }
  };

  return (
    <div>
      {vehicles.map((vehicle) => (
        <div key={vehicle.id}>
          {vehicle.registration_number}
          {optimisticUpdates.has(vehicle.id) && (
            <span className="optimistic-badge">Updating...</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Event Types

### Database Events

The following database operations trigger events:

- `insert` - New row inserted
- `update` - Row updated
- `delete` - Row deleted
- `create_table` - New table created
- `drop_table` - Table dropped
- `rename_table` - Table renamed
- `add_column` - Column added
- `alter_column` - Column altered
- `drop_column` - Column dropped
- `create_constraint` - Constraint added
- `drop_constraint` - Constraint removed
- `create_cron_job` - Cron job created
- `update_cron_job` - Cron job updated
- `delete_cron_job` - Cron job deleted
- `toggle_cron_job` - Cron job enabled/disabled
- `import_dump` - Database dump imported

### Event Structure

```typescript
interface DatabaseEvent {
  type: DatabaseEventType;
  projectId: string;
  tableName: string;
  data?: any;        // New/updated data
  oldData?: any;     // Previous data (for updates)
  timestamp: string;  // ISO timestamp
}
```

## Configuration

### Environment Variables

The WebSocket service automatically uses the same API URL from your Skaftin config:

```typescript
// src/backend/config/skaftin.config.ts
export function getApiUrl(): string {
  return process.env.REACT_APP_SKAFTIN_API_URL || 'http://localhost:4006';
}
```

### Project ID

The project ID is automatically extracted from your API key/token. You don't need to manually pass it in most cases, but you can specify it when joining project rooms.

## Best Practices

### 1. Cleanup Listeners

Always cleanup event listeners in `useEffect` cleanup:

```typescript
useEffect(() => {
  const handleEvent = (event: DatabaseEvent) => {
    // Handle event
  };

  webSocketService.onDatabaseChange(handleEvent);

  return () => {
    webSocketService.offDatabaseChange(handleEvent);
  };
}, []);
```

### 2. Debounce Rapid Updates

If you receive many events quickly, debounce the refresh:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedRefresh = useDebouncedCallback(() => {
  loadData();
}, 500);

useDatabaseEvents(projectId, 'vehicles', () => {
  debouncedRefresh();
});
```

### 3. Filter Events

Only listen to relevant events:

```typescript
useDatabaseEvents(projectId, 'vehicles', (event) => {
  // Only handle insert/update/delete, ignore schema changes
  if (['insert', 'update', 'delete'].includes(event.type)) {
    handleDataChange(event);
  }
});
```

### 4. Handle Connection Errors

Show user-friendly messages when disconnected:

```typescript
const { isConnected, reconnectAttempts } = useWebSocket();

if (!isConnected && reconnectAttempts > 3) {
  return <div>Connection lost. Please refresh the page.</div>;
}
```

### 5. Optimistic Updates

For better UX, update UI immediately and sync with server:

```typescript
// Update UI immediately
setItems([...items, newItem]);

// Send to server (triggers WebSocket event)
await Service.create(newItem);

// WebSocket event confirms the update
```

## Troubleshooting

### Connection Fails

1. Check API URL in config matches WebSocket server
2. Verify API key/token is valid
3. Check CORS settings on server
4. Inspect browser console for errors

### Events Not Received

1. Verify you've joined the project room
2. Check backend logs for event emission
3. Ensure event listener is registered
4. Verify table name matches exactly

### Reconnection Issues

1. Check network connectivity
2. Increase `maxReconnectAttempts` if needed
3. Verify server is reachable
4. Check firewall/proxy settings

## Next Steps

- Read `06-USAGE-EXAMPLES.md` for more patterns
- Check `04-SERVICE-GENERATION.md` for service patterns
- Review `02-AUTHENTICATION.md` for API credentials

