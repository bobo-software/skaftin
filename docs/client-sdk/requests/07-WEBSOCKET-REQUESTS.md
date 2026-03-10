# 07 - WebSocket Requests

This document covers real-time integration for external/client apps connecting
to the Go service over native WebSocket.

This file is client-focused. If you are integrating the internal admin app,
use the admin websocket endpoint (`/ws`) documentation instead.

Important:
- Client apps must connect to `/app-api/ws`.
- `/ws` is reserved for the internal admin websocket endpoint.

## Base Endpoint (Client Apps Only)

- Development: `ws://localhost:4006/app-api/ws`
- Production: `wss://skaftinplatform.bobosoftware.co.za/app-api/ws`

Use:
- `ws://` when your API URL is `http://`
- `wss://` when your API URL is `https://`

Example:
- API base: `https://skaftinplatform.bobosoftware.co.za`
- WS URL: `wss://skaftinplatform.bobosoftware.co.za/app-api/ws?api_key=YOUR_API_KEY`

## Authentication

WebSocket connections require authentication. For browser clients, include the
API key in the query string:

```text
wss://skaftinplatform.bobosoftware.co.za/app-api/ws?api_key=YOUR_API_KEY
```

Notes:
- The key is project-scoped; you can only subscribe to that project.
- Header auth (`X-API-Key` / `Authorization`) is also supported for non-browser clients.

## Protocol Overview

Transport is native WebSocket (RFC6455), not Socket.IO.

The server expects JSON messages from the client with:
- `type`: message action
- `projectId`: target project as a string

## Client -> Server Messages

### Subscribe

```json
{
  "type": "subscribe",
  "projectId": "6"
}
```

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "projectId": "6"
}
```

## Server -> Client Messages

### Subscription Acknowledgement

```json
{
  "type": "subscribed",
  "projectId": "6"
}
```

### Unsubscribe Acknowledgement

```json
{
  "type": "unsubscribed",
  "projectId": "6"
}
```

### Error

```json
{
  "type": "error",
  "message": "projectId is required"
}
```

```json
{
  "type": "error",
  "message": "not authorized for requested project"
}
```

### Database Change Event

```json
{
  "type": "database-change",
  "projectId": "6",
  "payload": {
    "type": "update",
    "projectId": "6",
    "tableName": "customers",
    "data": {
      "updatedCount": 1
    },
    "timestamp": "2026-03-09T13:45:02.120Z"
  }
}
```

### Project Event

```json
{
  "type": "project-event",
  "projectId": "6",
  "payload": {
    "type": "table_renamed",
    "projectId": "6",
    "data": {
      "oldName": "customers_old",
      "newName": "customers"
    },
    "timestamp": "2026-03-09T13:45:02.120Z"
  }
}
```

## TypeScript Types (Vite React Friendly)

```ts
export type DatabaseEventType =
  | 'insert'
  | 'update'
  | 'delete'
  | 'create_table'
  | 'rename_table'
  | 'drop_table'
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

export type DatabaseEvent = {
  type: DatabaseEventType;
  projectId: string;
  tableName: string;
  data?: unknown;
  oldData?: unknown;
  timestamp: string;
};

export type ProjectEvent = {
  type: string;
  projectId: string;
  data: unknown;
  timestamp: string;
};

export type WsIncomingMessage =
  | { type: 'subscribed'; projectId: string }
  | { type: 'unsubscribed'; projectId: string }
  | { type: 'error'; message: string }
  | { type: 'database-change'; projectId: string; payload: DatabaseEvent }
  | { type: 'project-event'; projectId: string; payload: ProjectEvent };
```

## Vite React Integration Example

```ts
// src/lib/realtime.ts
export function createProjectSocket(apiBaseUrl: string, projectId: string) {
  const wsBase = apiBaseUrl.replace(/^http/, 'ws');
  const apiKey = import.meta.env.VITE_SKAFTIN_API_KEY as string;
  const socket = new WebSocket(`${wsBase}/app-api/ws?api_key=${encodeURIComponent(apiKey)}`);

  const subscribe = () => {
    socket.send(
      JSON.stringify({
        type: 'subscribe',
        projectId,
      }),
    );
  };

  const unsubscribe = () => {
    socket.send(
      JSON.stringify({
        type: 'unsubscribe',
        projectId,
      }),
    );
  };

  return { socket, subscribe, unsubscribe };
}
```

```tsx
// src/hooks/useProjectRealtime.ts
import { useEffect } from 'react';

type Props = {
  apiBaseUrl: string;
  projectId: string;
  onDatabaseChange: (payload: unknown) => void;
  onProjectEvent: (payload: unknown) => void;
};

export function useProjectRealtime({
  apiBaseUrl,
  projectId,
  onDatabaseChange,
  onProjectEvent,
}: Props) {
  useEffect(() => {
    const wsBase = apiBaseUrl.replace(/^http/, 'ws');
    const apiKey = import.meta.env.VITE_SKAFTIN_API_KEY as string;
    const socket = new WebSocket(`${wsBase}/app-api/ws?api_key=${encodeURIComponent(apiKey)}`);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', projectId }));
    });

    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data as string) as
        | { type: 'database-change'; payload: unknown }
        | { type: 'project-event'; payload: unknown }
        | { type: string };

      if (msg.type === 'database-change') onDatabaseChange(msg.payload);
      if (msg.type === 'project-event') onProjectEvent(msg.payload);
    });

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'unsubscribe', projectId }));
      }
      socket.close();
    };
  }, [apiBaseUrl, projectId, onDatabaseChange, onProjectEvent]);
}
```

## Reconnection Recommendation

Native WebSocket does not auto-reconnect. Implement exponential backoff:
- start at `1000ms`
- double each retry
- cap at `10000ms`
- re-send all active `subscribe` messages after reconnect

## Troubleshooting

- If no events arrive, verify you receive a `subscribed` ack first.
- Ensure `projectId` matches the project where changes are occurring.
- Ensure reverse proxy / ingress supports websocket upgrade headers.
