/**
 * Common Types for Skaftin Backend
 * Centralized type definitions used throughout the application
 */

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string | object;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: string | object;
  statusCode?: number;
}

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string; // SuperTokens user ID
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin';
  projectIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  projectIds: string[];
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
    refreshToken?: string;
  };
  error?: string;
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface Project {
  id: number;
  name: string;
  description: string | null;
  user_id: string;
  schema_name: string;
  bucket_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export interface ProjectStats {
  projectId: number;
  projectName: string;
  tableCount: number;
  fileCount: number;
  storageUsed: number; // in bytes
  apiCalls: number;
  createdAt: Date;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DatabaseTable {
  table_name: string;
  table_schema: string;
  table_type: string;
  row_count?: number;
  size?: string;
}

export interface DatabaseColumn {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position: number;
  is_primary_key?: boolean;
}

export interface CreateTableDto {
  tableName: string;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: any;
  primaryKey?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
}

export interface TableConstraint {
  constraint_name: string;
  constraint_type: string;
  table_name: string;
  column_name?: string;
  foreign_table_name?: string;
  foreign_column_name?: string;
}

export interface ForeignKeyConstraint {
  constraint_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  on_delete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
  on_update?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
}

export interface SqlQueryRequest {
  query: string;
  parameters?: any[];
  readonly?: boolean;
}

export interface SqlQueryResult {
  rows: any[];
  rowCount: number;
  fields?: any[];
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageBucket {
  name: string;
  creationDate: Date;
  fileCount?: number;
  totalSize?: number;
}

export interface UploadFileDto {
  filePath: string;
  fileContent: string; // base64 encoded
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FileMetadata {
  filePath: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
  bucket: string;
}

export interface SearchFilesDto {
  query: string;
  fileType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface CreateBucketDto {
  projectId: string;
  bucketName: string;
  region?: string;
  versioning?: boolean;
}

// ============================================================================
// MCP (Model Context Protocol) TYPES
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'resource' | 'image';
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketEvent {
  type: 'project_created' | 'project_updated' | 'project_deleted' | 'database_change' | 'file_uploaded' | 'file_deleted';
  projectId: string;
  data: any;
  timestamp: Date;
}

export interface WebSocketMessage {
  event: string;
  data: any;
}

// ============================================================================
// REQUEST TYPES (Express Extensions)
// ============================================================================

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  projectIds: string[];
}

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// ============================================================================
// VALIDATION & ERROR TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// COMMON UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = string | number;

export type Timestamp = Date | string;

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type JSONArray = Array<JSONValue>;

// ============================================================================
// QUERY FILTER TYPES
// ============================================================================

export interface WhereCondition {
  [key: string]: any;
}

export interface SelectOptions {
  columns?: string[];
  where?: WhereCondition;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface UpdateOptions {
  where: WhereCondition;
  data: Record<string, any>;
}

export interface DeleteOptions {
  where: WhereCondition;
}

// ============================================================================
// SERVICE CONFIGURATION TYPES
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  useSSL?: boolean;
}

export interface ServerConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  corsOrigins: string[];
  jwtSecret: string;
  jwtExpiresIn: string;
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  database: HealthCheckResult;
  storage: HealthCheckResult;
  server: HealthCheckResult;
  timestamp: Date;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  // Response types are already exported above
};

