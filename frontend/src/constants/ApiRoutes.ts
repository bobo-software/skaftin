const ApiRoutes = {
  // Authentication routes
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  
  // Projects routes
  PROJECTS: {
    LIST: '/api/projects/list',
    CREATE: '/api/projects/create',
    GET: (id: string) => `/api/projects/${id}`,
    UPDATE: (id: string) => `/api/projects/update/${id}`,
    DELETE: (id: string) => `/api/projects/delete/${id}`,
    STATS: (id: string) => `/api/projects/${id}/stats`,
  },
  
  // Users routes
  USERS: {
    LIST: '/api/users/list',
    CREATE: '/api/users/create',
  },
  
  // Files/Storage routes
  FILES: {
    LIST: '/api/files/list',
    UPLOAD: '/api/files/upload',
    DOWNLOAD: (fileName: string) => `/api/files/${fileName}`,
    DELETE: (fileName: string) => `/api/files/${fileName}`,
  },
  
  // Database routes
  DATABASE: {
    LIST_TABLES: (projectId: string) => `/api/database/${projectId}/tables`,
    GET_TABLE_SCHEMA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/schema`,
    CREATE_TABLE: (projectId: string) => `/api/database/${projectId}/tables/create`,
    SELECT_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/select`,
    INSERT_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/insert`,
    BULK_INSERT: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/bulk-insert`,
    UPDATE_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/update`,
    DELETE_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/delete`,
    DROP_TABLE: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}`,
    EXECUTE_QUERY: (projectId: string) => `/api/database/${projectId}/query`,
  },
  
  // MCP routes
  MCP: {
    CALL: '/api/mcp/call',
    TOOLS: '/api/mcp/tools',
    INFO: '/api/mcp/info',
    HEALTH: '/api/mcp/health',
    EXECUTE: '/api/mcp/tools/execute',
  },
  
  // Health routes
  HEALTH: {
    SERVER: '/api/health',
    DATABASE: '/api/health/db',
    MINIO: '/api/health/minio',
  }
}

export default ApiRoutes;