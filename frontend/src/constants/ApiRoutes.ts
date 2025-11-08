const ApiRoutes = {
  // Authentication routes
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  
  // Organizations routes
  ORGANIZATIONS: {
    LIST: '/api/organizations/list',
    CREATE: '/api/organizations/create',
    GET: (id: number) => `/api/organizations/${id}`,
    UPDATE: (id: number) => `/api/organizations/${id}`,
    DELETE: (id: number) => `/api/organizations/${id}`,
    // Member management
    GET_MEMBERS: (id: number) => `/api/organizations/${id}/members`,
    ADD_MEMBER: (id: number) => `/api/organizations/${id}/members`,
    ADD_MEMBER_BY_ID: (id: number) => `/api/organizations/${id}/members/by-user-id`,
    UPDATE_MEMBER: (id: number, memberId: number) => `/api/organizations/${id}/members/${memberId}`,
    REMOVE_MEMBER: (id: number, memberId: number) => `/api/organizations/${id}/members/${memberId}`,
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
  
  // Files/Storage routes (legacy - use STORAGE for new features)
  FILES: {
    LIST: '/api/files/list',
    UPLOAD: '/api/files/upload',
    DOWNLOAD: (fileName: string) => `/api/files/${fileName}`,
    DELETE: (fileName: string) => `/api/files/${fileName}`,
  },
  
  // Storage routes (project-based bucket isolation)
  STORAGE: {
    // Bucket management
    LIST_BUCKETS: '/api/storage/buckets',
    CREATE_BUCKET: '/api/storage/buckets',
    DELETE_BUCKET: (bucketName: string) => `/api/storage/buckets/${bucketName}`,
    
    // File operations (project-based)
    LIST_FILES: (projectId: string) => `/api/storage/${projectId}/files`,
    SEARCH_FILES: (projectId: string) => `/api/storage/${projectId}/search`,
    UPLOAD_FILE: (projectId: string) => `/api/storage/${projectId}/upload`,
    UPLOAD_FILE_MULTIPART: (projectId: string) => `/api/storage/${projectId}/upload-multipart`,
    DOWNLOAD_FILE: (projectId: string, filePath: string) => `/api/storage/${projectId}/download/${filePath}`,
    DELETE_FILE: (projectId: string, filePath: string) => `/api/storage/${projectId}/files/${filePath}`,
    GET_FILE_METADATA: (projectId: string, filePath: string) => `/api/storage/${projectId}/files/${filePath}/metadata`,
    
    // Folder operations
    RENAME_FOLDER: (projectId: string) => `/api/storage/${projectId}/folders/rename`,
    DELETE_FOLDER: (projectId: string, folderPath: string) => `/api/storage/${projectId}/folders/${folderPath}`,
  },
  
  // Database routes
  DATABASE: {
    LIST_TABLES: (projectId: string) => `/api/database/${projectId}/tables`,
    GET_TABLE_SCHEMA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/schema`,
    CREATE_TABLE: (projectId: string) => `/api/database/${projectId}/tables/create`,
    RENAME_TABLE: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/rename`,
    SELECT_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/select`,
    INSERT_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/insert`,
    BULK_INSERT: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/bulk-insert`,
    UPDATE_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/update`,
    DELETE_DATA: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/delete`,
    DROP_TABLE: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}`,
    EXECUTE_QUERY: (projectId: string) => `/api/database/${projectId}/query`,
    // Constraint routes
    LIST_CONSTRAINTS: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints`,
    LIST_FOREIGN_KEYS: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/foreign-keys`,
    CREATE_FOREIGN_KEY: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/foreign-key`,
    CREATE_UNIQUE_CONSTRAINT: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/unique`,
    CREATE_PRIMARY_KEY: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/primary-key`,
    CREATE_CHECK_CONSTRAINT: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/check`,
    DROP_CONSTRAINT: (projectId: string, tableName: string, constraintName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/${constraintName}`,
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