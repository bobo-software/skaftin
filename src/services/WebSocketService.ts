import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export interface DatabaseEvent {
  type: 'insert' | 'update' | 'delete' | 'create_table' | 'rename_table' | 'drop_table' | 'add_column' | 'alter_column' | 'drop_column' | 'create_constraint' | 'drop_constraint' | 'create_cron_job' | 'update_cron_job' | 'delete_cron_job' | 'toggle_cron_job' | 'import_dump';
  projectId: string;
  tableName: string;
  data?: any;
  oldData?: any;
  timestamp?: string;
}

export interface ProjectEvent {
  type: string;
  projectId: string;
  data: any;
  timestamp?: string;
}

export class WebSocketService {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    // Support both development and production URLs
    const allowedOrigins = [
      process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005",
      process.env.FRONTEND_URL || "http://localhost:3005",
    ];
    const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: uniqueOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    console.log('✅ WebSocket service initialized');
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle joining project rooms
      socket.on('join-project', (projectId: string) => {
        const room = `project-${projectId}`;
        socket.join(room);
        console.log(`📁 Client ${socket.id} joined project room: ${room}`);
        
        // Notify the client they've joined
        socket.emit('joined-project', { projectId, room });
      });

      // Handle leaving project rooms
      socket.on('leave-project', (projectId: string) => {
        const room = `project-${projectId}`;
        socket.leave(room);
        console.log(`📁 Client ${socket.id} left project room: ${room}`);
        
        // Notify the client they've left
        socket.emit('left-project', { projectId, room });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`🔌 Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emit a database change event to all clients in a project room
   */
  emitDatabaseChange(event: DatabaseEvent) {
    const room = `project-${event.projectId}`;
    // Ensure timestamp is set
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    this.io.to(room).emit('database-change', eventWithTimestamp);
    console.log(`📊 Database change emitted to ${room}:`, eventWithTimestamp.type, eventWithTimestamp.tableName);
  }

  /**
   * Emit a project event to all clients in a project room
   */
  emitProjectEvent(event: ProjectEvent) {
    const room = `project-${event.projectId}`;
    // Ensure timestamp is set
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    this.io.to(room).emit('project-event', eventWithTimestamp);
    console.log(`📁 Project event emitted to ${room}:`, eventWithTimestamp.type);
  }

  /**
   * Get the Socket.IO server instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get clients in a specific project room
   */
  getProjectRoomSize(projectId: string): number {
    const room = `project-${projectId}`;
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }
}

let webSocketServiceInstance: WebSocketService | null = null;

/**
 * Initialize the WebSocket service
 */
export function initializeWebSocketService(httpServer: HTTPServer): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService(httpServer);
  }
  return webSocketServiceInstance;
}

/**
 * Get the WebSocket service instance
 */
export function getWebSocketService(): WebSocketService {
  if (!webSocketServiceInstance) {
    throw new Error('WebSocket service not initialized. Call initializeWebSocketService first.');
  }
  return webSocketServiceInstance;
}

