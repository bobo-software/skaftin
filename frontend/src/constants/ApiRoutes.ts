const ApiRoutes = {
  // Authentication routes
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  
  // Projects routes
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    GET: (id: string) => `/api/projects/${id}`,
    UPDATE: (id: string) => `/api/projects/${id}`,
    DELETE: (id: string) => `/api/projects/${id}`,
  },
  
  // Files/Storage routes
  FILES: {
    LIST: '/api/files',
    UPLOAD: '/api/files/upload',
    DOWNLOAD: (fileName: string) => `/api/files/${fileName}`,
    DELETE: (fileName: string) => `/api/files/${fileName}`,
  },
  
  // Database routes (via MCP or direct)
  DATABASE: {
    EXECUTE_SQL: '/api/mcp/call',
    LIST_TABLES: '/api/mcp/call',
  },
  
  // MCP routes
  MCP: {
    CALL: '/api/mcp/call',
    TOOLS: '/api/mcp/tools',
    INFO: '/api/mcp/info',
    HEALTH: '/api/mcp/health',
  },
  
  // Health routes
  HEALTH: {
    SERVER: '/api/health',
    DATABASE: '/api/test/db',
    MINIO: '/api/test/minio',
  }
}

export default ApiRoutes;