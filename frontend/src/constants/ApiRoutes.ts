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
    DASHBOARD_STATS: '/api/projects/dashboard-stats',
  },
  
  // Project Buckets routes
  PROJECT_BUCKETS: {
    LIST: (projectId: string) => `/api/projects/${projectId}/buckets`,
    CREATE: (projectId: string) => `/api/projects/${projectId}/buckets`,
    UPDATE: (projectId: string, bucketId: number) => `/api/projects/${projectId}/buckets/${bucketId}`,
    DELETE: (projectId: string, bucketId: number) => `/api/projects/${projectId}/buckets/${bucketId}`,
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
  
  // Storage routes - Admin API (SuperTokens authentication)
  // Project ID and bucket name are provided in the URL path
  STORAGE: {
    // Bucket operations (list buckets for a project)
    LIST_BUCKETS: (projectId: string) => `/api/storage/${projectId}/buckets`,
    
    // File operations (require bucketName)
    LIST_FILES: (projectId: string, bucketName: string) => `/api/storage/${projectId}/${bucketName}/files`,
    SEARCH_FILES: (projectId: string, bucketName: string) => `/api/storage/${projectId}/${bucketName}/search`,
    UPLOAD_FILE: (projectId: string, bucketName: string) => `/api/storage/${projectId}/${bucketName}/upload`,
    UPLOAD_FILE_MULTIPART: (projectId: string, bucketName: string) => `/api/storage/${projectId}/${bucketName}/upload-multipart`,
    DOWNLOAD_FILE: (projectId: string, bucketName: string, filePath: string) => `/api/storage/${projectId}/${bucketName}/download/${filePath}`,
    DELETE_FILE: (projectId: string, bucketName: string, filePath: string) => `/api/storage/${projectId}/${bucketName}/files/${filePath}`,
    GET_FILE_METADATA: (projectId: string, bucketName: string, filePath: string) => `/api/storage/${projectId}/${bucketName}/files/${filePath}/metadata`,
    
    // Folder operations (require bucketName)
    RENAME_FOLDER: (projectId: string, bucketName: string) => `/api/storage/${projectId}/${bucketName}/folders/rename`,
    DELETE_FOLDER: (projectId: string, bucketName: string, folderPath: string) => `/api/storage/${projectId}/${bucketName}/folders/${folderPath}`,
  },
  
  // Database routes - Admin API (SuperTokens authentication)
  // Project ID is provided in the URL path
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
    IMPORT_DUMP: (projectId: string) => `/api/database/${projectId}/import`,
    // Constraint routes
    LIST_CONSTRAINTS: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints`,
    LIST_FOREIGN_KEYS: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/foreign-keys`,
    CREATE_FOREIGN_KEY: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/foreign-key`,
    CREATE_UNIQUE_CONSTRAINT: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/unique`,
    CREATE_PRIMARY_KEY: (projectId: string, tableName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/primary-key`,
    DROP_CONSTRAINT: (projectId: string, tableName: string, constraintName: string) => `/api/database/${projectId}/tables/${tableName}/constraints/${constraintName}`,
  },
  
  // Workflows routes
  WORKFLOWS: {
    LIST: (projectId: string) => `/api/workflows/${projectId}`,
    GET: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}`,
    CREATE: (projectId: string) => `/api/workflows/${projectId}`,
    UPDATE: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}`,
    DELETE: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}`,
    EXECUTE: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}/execute`,
    GET_EXECUTIONS: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}/executions`,
    GET_EXECUTION_LOGS: (projectId: string, workflowId: number, executionId: number) => `/api/workflows/${projectId}/${workflowId}/executions/${executionId}/logs`,
    SCHEDULE: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}/schedule`,
    UNSCHEDULE: (projectId: string, workflowId: number) => `/api/workflows/${projectId}/${workflowId}/schedule`,
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
    // Email template management
    LIST_EMAIL_TEMPLATES: (projectId: string) => `/api/communications/${projectId}/email/templates`,
    GET_EMAIL_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/email/templates/${templateId}`,
    CREATE_EMAIL_TEMPLATE: (projectId: string) => `/api/communications/${projectId}/email/templates`,
    UPDATE_EMAIL_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/email/templates/${templateId}`,
    DELETE_EMAIL_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/email/templates/${templateId}`,
    // Email sending
    SEND_EMAIL: (projectId: string) => `/api/communications/${projectId}/email/send`,
    // SMS provider management
    LIST_SMS_PROVIDERS: (projectId: string) => `/api/communications/${projectId}/sms/providers`,
    GET_SMS_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/sms/providers/${providerId}`,
    CREATE_SMS_PROVIDER: (projectId: string) => `/api/communications/${projectId}/sms/providers`,
    UPDATE_SMS_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/sms/providers/${providerId}`,
    DELETE_SMS_PROVIDER: (projectId: string, providerId: string) => `/api/communications/${projectId}/sms/providers/${providerId}`,
    // SMS template management
    LIST_SMS_TEMPLATES: (projectId: string) => `/api/communications/${projectId}/sms/templates`,
    GET_SMS_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/sms/templates/${templateId}`,
    CREATE_SMS_TEMPLATE: (projectId: string) => `/api/communications/${projectId}/sms/templates`,
    UPDATE_SMS_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/sms/templates/${templateId}`,
    DELETE_SMS_TEMPLATE: (projectId: string, templateId: string) => `/api/communications/${projectId}/sms/templates/${templateId}`,
    // SMS sending
    SEND_SMS: (projectId: string) => `/api/communications/${projectId}/sms/send`,
    SEND_SMS_BASIC: (projectId: string) => `/api/communications/${projectId}/sms/send-basic`,
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
  
  // MCP routes - Admin API (SuperTokens authentication, all tools)
  MCP: {
    CALL: '/api/mcp/call',
    TOOLS: '/api/mcp/tools',
    PROTOCOL: '/api/mcp/protocol',
    INFO: '/api/mcp/info',
    HEALTH: '/api/mcp/health',
    EXECUTE: '/api/mcp/tools/execute',
  },
  
  // Client MCP routes - Client API (MCP keys/API keys, restricted tools)
  CLIENT_MCP: {
    CALL: '/app-api/mcp/call',
    TOOLS: '/app-api/mcp/tools',
    PROTOCOL: '/app-api/mcp/protocol',
  },
  
  // Health routes
  HEALTH: {
    SERVER: '/api/health',
    DATABASE: '/api/health/db',
    MINIO: '/api/health/minio',
  },
  
  // Analytics routes
  ANALYTICS: {
    OVERVIEW: (projectId: string) => `/api/analytics/${projectId}/overview`,
    API: (projectId: string) => `/api/analytics/${projectId}/api`,
    DATABASE: (projectId: string) => `/api/analytics/${projectId}/database`,
    STORAGE: (projectId: string) => `/api/analytics/${projectId}/storage`,
  },
  
  // Backup routes
  BACKUPS: {
    CREATE: (projectId: string) => `/api/backups/${projectId}/create`,
    LIST: (projectId: string) => `/api/backups/${projectId}/list`,
    DOWNLOAD: (projectId: string, backupId: string) => `/api/backups/${projectId}/${backupId}/download`,
    RESTORE: (projectId: string, backupId: string) => `/api/backups/${projectId}/${backupId}/restore`,
    DELETE: (projectId: string, backupId: string) => `/api/backups/${projectId}/${backupId}`,
    // Backup schedules
    LIST_SCHEDULES: (projectId: string) => `/api/backups/${projectId}/schedules`,
    CREATE_SCHEDULE: (projectId: string) => `/api/backups/${projectId}/schedules`,
    UPDATE_SCHEDULE: (projectId: string, scheduleId: number) => `/api/backups/${projectId}/schedules/${scheduleId}`,
    DELETE_SCHEDULE: (projectId: string, scheduleId: number) => `/api/backups/${projectId}/schedules/${scheduleId}`,
  }
}

export default ApiRoutes;