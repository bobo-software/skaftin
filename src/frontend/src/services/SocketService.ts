import { io, Socket } from 'socket.io-client';

interface DatabaseEvent {
  type: 'insert' | 'update' | 'delete' | 'create_table' | 'drop_table';
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
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect() {
    const serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4005';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.IO server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket.IO connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Reconnected to Socket.IO server after', attemptNumber, 'attempts');
      this.isConnected = true;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 Failed to reconnect to Socket.IO server');
    });
  }

  // Join a project room to receive project-specific updates
  joinProject(projectId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-project', projectId);
      console.log(`📁 Joined project room: ${projectId}`);
    }
  }

  // Leave a project room
  leaveProject(projectId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-project', projectId);
      console.log(`📁 Left project room: ${projectId}`);
    }
  }

  // Listen for database change events
  onDatabaseChange(callback: (event: DatabaseEvent) => void) {
    if (this.socket) {
      this.socket.on('database-change', callback);
    }
  }

  // Listen for project events
  onProjectEvent(callback: (event: ProjectEvent) => void) {
    if (this.socket) {
      this.socket.on('project-event', callback);
    }
  }

  // Remove database change listener
  offDatabaseChange(callback: (event: DatabaseEvent) => void) {
    if (this.socket) {
      this.socket.off('database-change', callback);
    }
  }

  // Remove project event listener
  offProjectEvent(callback: (event: ProjectEvent) => void) {
    if (this.socket) {
      this.socket.off('project-event', callback);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id || null
    };
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Reconnect to server
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
export type { DatabaseEvent, ProjectEvent };
