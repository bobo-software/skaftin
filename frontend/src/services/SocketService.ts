interface DatabaseEvent {
  type:
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
  projectId: string;
  tableName: string;
  data?: any;
  oldData?: any;
  timestamp: string;
}

interface ProjectEvent {
  type: string;
  projectId: string;
  data: any;
  timestamp: string;
}

class SocketService {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer: number | null = null;
  private manualDisconnect = false;
  private activeProjects = new Set<string>();
  private databaseListeners = new Set<(event: DatabaseEvent) => void>();
  private projectListeners = new Set<(event: ProjectEvent) => void>();

  constructor() {
    this.connect();
  }

  private getWebSocketUrl() {
    const serverUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:4006';
    const parsed = new URL(serverUrl);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = '/ws';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }

  private connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    this.socket = new WebSocket(wsUrl);

    this.socket.addEventListener('open', () => {
      console.log('🔌 Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.resubscribeProjects();
    });

    this.socket.addEventListener('close', (event) => {
      console.log('🔌 Disconnected from WebSocket server:', event.reason || `code=${event.code}`);
      this.isConnected = false;
      if (!this.manualDisconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
    });

    this.socket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
  }

  private handleMessage(raw: string) {
    try {
      const message = JSON.parse(raw);

      switch (message.type) {
        case 'database-change': {
          const payload = message.payload as DatabaseEvent;
          if (!payload?.timestamp) {
            payload.timestamp = new Date().toISOString();
          }
          this.databaseListeners.forEach((listener) => listener(payload));
          return;
        }
        case 'project-event': {
          const payload = message.payload as ProjectEvent;
          if (!payload?.timestamp) {
            payload.timestamp = new Date().toISOString();
          }
          this.projectListeners.forEach((listener) => listener(payload));
          return;
        }
        case 'subscribed':
        case 'unsubscribed':
          return;
        case 'error':
          console.warn('🔌 WebSocket server error:', message.message);
          return;
        default:
          return;
      }
    } catch (error) {
      console.warn('🔌 Failed to parse WebSocket message:', error);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔌 Failed to reconnect to WebSocket server');
      return;
    }
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private sendMessage(payload: Record<string, unknown>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private resubscribeProjects() {
    this.activeProjects.forEach((projectId) => {
      this.sendMessage({ type: 'subscribe', projectId });
    });
  }

  // Join a project room to receive project-specific updates
  joinProject(projectId: string) {
    this.activeProjects.add(projectId);
    this.sendMessage({ type: 'subscribe', projectId });
    console.log(`📁 Subscribed project stream: ${projectId}`);
  }

  // Leave a project room
  leaveProject(projectId: string) {
    this.activeProjects.delete(projectId);
    this.sendMessage({ type: 'unsubscribe', projectId });
    console.log(`📁 Unsubscribed project stream: ${projectId}`);
  }

  // Listen for database change events
  onDatabaseChange(callback: (event: DatabaseEvent) => void) {
    this.databaseListeners.add(callback);
  }

  // Listen for project events
  onProjectEvent(callback: (event: ProjectEvent) => void) {
    this.projectListeners.add(callback);
  }

  // Remove database change listener
  offDatabaseChange(callback: (event: DatabaseEvent) => void) {
    this.databaseListeners.delete(callback);
  }

  // Remove project event listener
  offProjectEvent(callback: (event: ProjectEvent) => void) {
    this.projectListeners.delete(callback);
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: null
    };
  }

  // Disconnect from server
  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Reconnect to server
  reconnect() {
    this.manualDisconnect = false;
    this.reconnectAttempts = 0;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connect();
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
export type { DatabaseEvent, ProjectEvent };
