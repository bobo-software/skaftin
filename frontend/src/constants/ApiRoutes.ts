const ApiRoutes = {
  // Platform Admin Authentication routes (SuperTokens)
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  
  // App User Authentication routes (JWT - client-facing)
  APP_AUTH: {
    REGISTER: '/app-api/auth/auth/register',
    LOGIN: '/app-api/auth/auth/login',
    VERIFY: '/app-api/auth/auth/verify',
    LOGOUT: '/app-api/auth/auth/logout',
    VERIFY_OTP: '/app-api/auth/auth/verify-otp',
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
    RESET: (id: string) => `/api/projects/reset/${id}`,
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
  
  // Storage routes (project-based bucket isolation) - Client-facing API
  // Project ID is extracted from API key automatically
  STORAGE: {
    // Bucket management
    LIST_BUCKETS: '/app-api/storage/buckets',
    CREATE_BUCKET: '/app-api/storage/buckets',
    DELETE_BUCKET: (bucketName: string) => `/app-api/storage/buckets/${bucketName}`,
    
    // File operations (project extracted from API key)
    LIST_FILES: '/app-api/storage/files',
    SEARCH_FILES: '/app-api/storage/search',
    UPLOAD_FILE: '/app-api/storage/upload',
    UPLOAD_FILE_MULTIPART: '/app-api/storage/upload-multipart',
    DOWNLOAD_FILE: (filePath: string) => `/app-api/storage/download/${filePath}`,
    DELETE_FILE: (filePath: string) => `/app-api/storage/files/${filePath}`,
    GET_FILE_METADATA: (filePath: string) => `/app-api/storage/files/${filePath}/metadata`,
    
    // Folder operations
    RENAME_FOLDER: '/app-api/storage/folders/rename',
    DELETE_FOLDER: (folderPath: string) => `/app-api/storage/folders/${folderPath}`,
  },
  
  // Database routes - Client-facing API
  // Project ID is extracted from API key automatically
  DATABASE: {
    LIST_TABLES: '/app-api/database/tables',
    GET_TABLE_SCHEMA: (tableName: string) => `/app-api/database/tables/${tableName}/schema`,
    CREATE_TABLE: '/app-api/database/tables/create',
    RENAME_TABLE: (tableName: string) => `/app-api/database/tables/${tableName}/rename`,
    SELECT_DATA: (tableName: string) => `/app-api/database/tables/${tableName}/select`,
    INSERT_DATA: (tableName: string) => `/app-api/database/tables/${tableName}/insert`,
    BULK_INSERT: (tableName: string) => `/app-api/database/tables/${tableName}/bulk-insert`,
    UPDATE_DATA: (tableName: string) => `/app-api/database/tables/${tableName}/update`,
    DELETE_DATA: (tableName: string) => `/app-api/database/tables/${tableName}/delete`,
    DROP_TABLE: (tableName: string) => `/app-api/database/tables/${tableName}`,
    EXECUTE_QUERY: '/app-api/database/query',
    IMPORT_DUMP: '/app-api/database/import',
    // Constraint routes
    LIST_CONSTRAINTS: (tableName: string) => `/app-api/database/tables/${tableName}/constraints`,
    LIST_FOREIGN_KEYS: (tableName: string) => `/app-api/database/tables/${tableName}/foreign-keys`,
    CREATE_FOREIGN_KEY: (tableName: string) => `/app-api/database/tables/${tableName}/constraints/foreign-key`,
    CREATE_UNIQUE_CONSTRAINT: (tableName: string) => `/app-api/database/tables/${tableName}/constraints/unique`,
    CREATE_PRIMARY_KEY: (tableName: string) => `/app-api/database/tables/${tableName}/constraints/primary-key`,
    CREATE_CHECK_CONSTRAINT: (tableName: string) => `/app-api/database/tables/${tableName}/constraints/check`,
    DROP_CONSTRAINT: (tableName: string, constraintName: string) => `/app-api/database/tables/${tableName}/constraints/${constraintName}`,
  },
  
  // Communications routes
  COMMUNICATIONS: {
    // Email provider management
    LIST_PROVIDERS: (projectId: string) => `/api/communications/${projectId}/email/providers`,
    GET_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/email/providers/${providerId}`,
    CREATE_PROVIDER: (projectId: string) => `/api/communications/${projectId}/email/providers`,
    UPDATE_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/email/providers/${providerId}`,
    DELETE_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/email/providers/${providerId}`,
    TEST_CONNECTION: (projectId: string, providerId: string) => `/api/communications/${projectId}/email/providers/${providerId}/test`,
    // Email sending
    SEND_EMAIL: (projectId: string) => `/api/communications/${projectId}/email/send`,
  },
  
  // Invitations routes
  INVITATIONS: {
    LIST: (projectId: string) => `/api/invitations/${projectId}/invitations`,
    CREATE: (projectId: string) => `/api/invitations/${projectId}/invitations`,
    REVOKE: (projectId: string, invitationId: string) => `/api/invitations/${projectId}/invitations/${invitationId}`,
    GET_BY_CODE: (inviteCode: string) => `/api/invitations/code/${inviteCode}`,
    ACCEPT: (inviteCode: string) => `/api/invitations/accept/${inviteCode}`,
    // Members
    LIST_MEMBERS: (projectId: string) => `/api/invitations/${projectId}/members`,
    REMOVE_MEMBER: (projectId: string, memberId: string) => `/api/invitations/${projectId}/members/${memberId}`,
  },
  
  // API Credentials routes
  CREDENTIALS: {
    LIST: (projectId: string) => `/api/credentials/${projectId}/credentials`,
    CREATE: (projectId: string) => `/api/credentials/${projectId}/credentials`,
    UPDATE: (projectId: string, credentialId: string) => `/api/credentials/${projectId}/credentials/${credentialId}`,
    DELETE: (projectId: string, credentialId: string) => `/api/credentials/${projectId}/credentials/${credentialId}`,
    GET_PERMISSIONS: '/api/credentials/permissions',
    GET_MCP_KEY: (projectId: string) => `/api/credentials/${projectId}/mcp-key`,
    REGENERATE_MCP_KEY: (projectId: string) => `/api/credentials/${projectId}/mcp-key/regenerate`,
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