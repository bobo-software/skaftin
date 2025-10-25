import { Server as SocketIOServer } from 'socket.io';

interface DatabaseEvent {
  type: 'insert' | 'update' | 'delete' | 'create_table' | 'drop_table';
  projectId: string;
  tableName: string;
  data?: any;
  oldData?: any;
  timestamp: string;
}

class SocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // Emit database change events to project-specific rooms
  emitDatabaseChange(event: DatabaseEvent) {
    const room = `project-${event.projectId}`;
    console.log(`📡 Emitting database event to room ${room}:`, event);
    
    this.io.to(room).emit('database-change', event);
  }

  // Emit table creation event
  emitTableCreated(projectId: string, tableName: string, tableData: any) {
    this.emitDatabaseChange({
      type: 'create_table',
      projectId,
      tableName,
      data: tableData,
      timestamp: new Date().toISOString()
    });
  }

  // Emit table deletion event
  emitTableDeleted(projectId: string, tableName: string) {
    this.emitDatabaseChange({
      type: 'drop_table',
      projectId,
      tableName,
      timestamp: new Date().toISOString()
    });
  }

  // Emit row insertion event
  emitRowInserted(projectId: string, tableName: string, rowData: any) {
    this.emitDatabaseChange({
      type: 'insert',
      projectId,
      tableName,
      data: rowData,
      timestamp: new Date().toISOString()
    });
  }

  // Emit row update event
  emitRowUpdated(projectId: string, tableName: string, newData: any, oldData: any) {
    this.emitDatabaseChange({
      type: 'update',
      projectId,
      tableName,
      data: newData,
      oldData: oldData,
      timestamp: new Date().toISOString()
    });
  }

  // Emit row deletion event
  emitRowDeleted(projectId: string, tableName: string, deletedData: any) {
    this.emitDatabaseChange({
      type: 'delete',
      projectId,
      tableName,
      data: deletedData,
      timestamp: new Date().toISOString()
    });
  }

  // Emit project-specific events
  emitProjectEvent(projectId: string, eventType: string, data: any) {
    const room = `project-${projectId}`;
    console.log(`📡 Emitting project event to room ${room}:`, { eventType, data });
    
    this.io.to(room).emit('project-event', {
      type: eventType,
      projectId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Get connected clients for a project
  getProjectClients(projectId: string): string[] {
    const room = `project-${projectId}`;
    const clients = this.io.sockets.adapter.rooms.get(room);
    return clients ? Array.from(clients) : [];
  }

  // Get total connected clients
  getTotalClients(): number {
    return this.io.sockets.sockets.size;
  }
}

export default SocketService;
