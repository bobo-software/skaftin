import { getWebSocketService, DatabaseEvent, ProjectEvent } from '../services/WebSocketService';

/**
 * Emit a database change event via WebSocket
 */
export function emitDatabaseChange(
  projectId: string,
  tableName: string,
  type: 'insert' | 'update' | 'delete' | 'create_table' | 'rename_table' | 'drop_table' | 'add_column' | 'alter_column' | 'drop_column',
  data?: any,
  oldData?: any
) {
  try {
    const wsService = getWebSocketService();
    const event: DatabaseEvent = {
      type,
      projectId,
      tableName,
      data,
      oldData,
      timestamp: new Date().toISOString(),
    };
    wsService.emitDatabaseChange(event);
  } catch (error) {
    // WebSocket service might not be initialized yet, silently fail
    console.warn('WebSocket service not available for database change emission:', error);
  }
}

/**
 * Emit a project event via WebSocket
 */
export function emitProjectEvent(
  projectId: string,
  type: string,
  data: any
) {
  try {
    const wsService = getWebSocketService();
    const event: ProjectEvent = {
      type,
      projectId,
      data,
      timestamp: new Date().toISOString(),
    };
    wsService.emitProjectEvent(event);
  } catch (error) {
    // WebSocket service might not be initialized yet, silently fail
    console.warn('WebSocket service not available for project event emission:', error);
  }
}

