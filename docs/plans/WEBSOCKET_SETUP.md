# 🔌 WebSocket Real-Time Updates Setup

## Overview

The Skaftin platform uses Socket.IO for real-time updates across the application. When database or project changes occur, all connected clients in the project room receive instant notifications.

## Architecture

### Backend (Server)

**Location**: `src/services/WebSocketService.ts`

- Socket.IO server integrated with HTTP server
- Project-based rooms (`project-{projectId}`)
- Event emission for database and project changes
- Connection management and error handling

### Frontend (Client)

**Location**: `frontend/src/services/SocketService.ts`

- Singleton Socket.IO client
- Auto-reconnection with exponential backoff
- Event listeners for database and project changes
- Room join/leave management

## Event Types

### Database Change Events

```typescript
interface DatabaseEvent {
  type: 'insert' | 'update' | 'delete' | 'create_table' | 'drop_table';
  projectId: string;
  tableName: string;
  data?: any;
  oldData?: any;
  timestamp: string;
}
```

**Example**:
```javascript
{
  type: 'insert',
  projectId: '1',
  tableName: 'users',
  data: { id: 123, name: 'John Doe', email: 'john@example.com' },
  timestamp: '2025-11-01T12:00:00.000Z'
}
```

### Project Events

```typescript
interface ProjectEvent {
  type: string;
  projectId: string;
  data: any;
  timestamp: string;
}
```

## Usage

### Backend: Emitting Events

Database operations automatically emit WebSocket events:

```typescript
import { emitDatabaseChange } from '../../utils/websocketEmitter';

// After inserting data
const result = await client.query('INSERT INTO users ...');
emitDatabaseChange(projectId, 'users', 'insert', result.rows[0]);

// After updating data
const result = await client.query('UPDATE users ...');
emitDatabaseChange(projectId, 'users', 'update', result.rows);

// After deleting data
emitDatabaseChange(projectId, 'users', 'delete', { count: deletedCount });

// After creating a table
emitDatabaseChange(projectId, tableName, 'create_table', { tableName, columns: 5 });

// After dropping a table
emitDatabaseChange(projectId, tableName, 'drop_table', { tableName });
```

### Frontend: Listening for Events

#### In Components

```typescript
import socketService from '../services/SocketService';
import { useEffect } from 'react';

function TableViewer({ projectId }: { projectId: string }) {
  useEffect(() => {
    // Join the project room
    socketService.joinProject(projectId);

    // Listen for database changes
    const handleDatabaseChange = (event: DatabaseEvent) => {
      console.log('Database change:', event);
      
      // Refresh data if relevant
      if (event.tableName === currentTable) {
        fetchTableData();
      }
    };

    socketService.onDatabaseChange(handleDatabaseChange);

    // Cleanup
    return () => {
      socketService.offDatabaseChange(handleDatabaseChange);
      socketService.leaveProject(projectId);
    };
  }, [projectId, currentTable]);

  return <div>...</div>;
}
```

#### In Zustand Stores

```typescript
import socketService from '../../services/SocketService';
import { create } from 'zustand';

interface RealtimeStoreType {
  lastUpdate: DatabaseEvent | null;
  setLastUpdate: (event: DatabaseEvent) => void;
  initialize: () => void;
  cleanup: () => void;
}

const useRealtimeStore = create<RealtimeStoreType>((set) => ({
  lastUpdate: null,
  
  setLastUpdate: (event) => set({ lastUpdate: event }),
  
  initialize: () => {
    const handleDatabaseChange = (event: DatabaseEvent) => {
      set({ lastUpdate: event });
    };
    
    socketService.onDatabaseChange(handleDatabaseChange);
  },
  
  cleanup: () => {
    socketService.offDatabaseChange(() => {});
  },
}));
```

## Configuration

### Environment Variables

**Backend** (`.env`):
```env
PORT=4006
FRONTEND_URL=http://localhost:3006
```

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:4006
```

## Connection Flow

1. Frontend app loads → `SocketService` constructor runs
2. Socket.IO client connects to `http://localhost:4006`
3. User navigates to project → `socketService.joinProject(projectId)`
4. Server adds client to `project-{projectId}` room
5. Database operation occurs → Server emits event to room
6. All clients in room receive event → UI updates

## Debugging

### Check Connection Status

```typescript
const status = socketService.getConnectionStatus();
console.log('Connected:', status.isConnected);
console.log('Socket ID:', status.socketId);
console.log('Reconnect attempts:', status.reconnectAttempts);
```

### Backend Logs

The server logs WebSocket events:
- `🔌 Client connected: <socket-id>`
- `📁 Client <socket-id> joined project room: project-1`
- `📊 Database change emitted to project-1: insert users`
- `🔌 Client disconnected: <socket-id> (reason)`

### Frontend Logs

The client logs connection events:
- `🔌 Connected to Socket.IO server`
- `📁 Joined project room: 1`
- `🔌 Disconnected from Socket.IO server: <reason>`
- `🔌 Reconnected to Socket.IO server after <n> attempts`

## Testing

### Manual Test

1. Start backend: `npm run dev:backend`
2. Start frontend: `npm run dev:frontend`
3. Open browser console
4. Navigate to a project
5. In another tab/browser, make a database change (insert/update/delete)
6. Check console in first tab for real-time event

### Automated Test

```typescript
// Test event emission
import { getWebSocketService } from './services/WebSocketService';

const wsService = getWebSocketService();
wsService.emitDatabaseChange({
  type: 'insert',
  projectId: '1',
  tableName: 'users',
  data: { id: 123, name: 'Test User' },
  timestamp: new Date().toISOString(),
});
```

## Troubleshooting

### Connection Fails

1. Check if backend is running on correct port
2. Verify `VITE_API_URL` in frontend `.env`
3. Check CORS configuration in backend
4. Inspect browser console for errors

### Events Not Received

1. Verify client joined project room
2. Check backend logs for event emission
3. Ensure event listener is properly registered
4. Verify projectId matches

### Reconnection Issues

1. Check network connectivity
2. Increase `maxReconnectAttempts` if needed
3. Verify server is reachable
4. Check firewall/proxy settings

## Future Enhancements

- [ ] JWT authentication for Socket.IO connections
- [ ] Message queuing for offline clients
- [ ] Event history/replay
- [ ] Presence indicators (who's online)
- [ ] Typing indicators for collaborative editing
- [ ] Optimistic UI updates with rollback
- [ ] Rate limiting for events
- [ ] Event compression for large payloads

