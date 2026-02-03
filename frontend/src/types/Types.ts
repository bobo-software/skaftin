/**
 * Common Types for Skaftin Frontend
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

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role: 'user' | 'admin';
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
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
  message?: string;
  data?: {
    user: User;
    token: string;
    refreshToken?: string;
  };
  error?: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export type OrganizationRole = 'admin' | 'dev' | 'member' | 'viewer';

export interface Organization {
  id: number;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role?: OrganizationRole;
  projectCount?: number;
  memberCount?: number;
  isOwner?: boolean;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  email?: string;
  name?: string;
}

export interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[];
  userRole?: OrganizationRole;
}

export interface CreateOrganizationDto {
  name: string;
  description?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
}

export interface AddMemberDto {
  email: string;
  role: OrganizationRole;
}

export interface AddMemberByIdDto {
  user_id: string;
  role: OrganizationRole;
}

export interface UpdateMemberRoleDto {
  role: OrganizationRole;
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface Project {
  id: number;
  name: string;
  description: string | null;
  organization_id: number;
  user_id: string; // Creator user ID (for audit)
  schema_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectBucket {
  id: number;
  project_id: number;
  bucket_name: string;
  description: string | null;
  access_policy: 'private' | 'public';
  created_at: string;
  updated_at: string;
  fileCount?: number;
  totalSize?: number;
  stats?: {
    fileCount: number;
    totalSize: number;
    largestFile?: { key: string; size: number } | null;
    oldestFile?: { key: string; lastModified: Date } | null;
    newestFile?: { key: string; lastModified: Date } | null;
  };
  actualPolicy?: 'private' | 'public';
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  organization_id: number;
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
  storageUsed: number;
  apiCalls: number;
  createdAt: string;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Table {
  table_name: string;
  table_schema: string;
  table_type: string;
  row_count?: number;
  size?: string;
}

export interface Column {
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

export interface TableData {
  columns: string[];
  rows: any[];
  rowCount: number;
}

export interface SqlQuery {
  id: string;
  query: string;
  timestamp: string;
  executionTime?: number;
  rowCount?: number;
  isFavorite: boolean;
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

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface StorageFile {
  key: string;
  name?: string;
  size: number;
  lastModified: string;
  etag?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageBucket {
  name: string;
  creationDate: string;
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
  lastModified: string;
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

export interface FileUploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  details?: any;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: any;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio';
  value: any;
  placeholder?: string;
  required?: boolean;
  validation?: (_value: any) => string | null;
  options?: { label: string; value: any }[];
}

export interface FormError {
  field: string;
  message: string;
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: any;
  badge?: string | number;
  children?: NavigationItem[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

// ============================================================================
// TABLE/GRID TYPES (for UI components)
// ============================================================================

export interface DataGridColumn {
  field: string;
  headerName: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  renderCell?: (_value: any, _row: any) => React.ReactNode;
}

export interface DataGridRow {
  id: string | number;
  [key: string]: any;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
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
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketEvent {
  type: 'project_created' | 'project_updated' | 'project_deleted' | 'database_change' | 'file_uploaded' | 'file_deleted';
  projectId: string;
  data: any;
  timestamp: string;
}

export interface WebSocketMessage {
  event: string;
  data: any;
}

// ============================================================================
// THEME TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
  fontSize: 'small' | 'medium' | 'large';
  borderRadius: 'none' | 'small' | 'medium' | 'large';
}

// ============================================================================
// STORE TYPES (Zustand)
// ============================================================================

export interface AppStore {
  theme: ThemeMode;
  setTheme: (_theme: ThemeMode) => void;
  isLoading: boolean;
  setLoading: (_loading: boolean) => void;
  notifications: ToastNotification[];
  addNotification: (_notification: Omit<ToastNotification, 'id'>) => void;
  removeNotification: (_id: string) => void;
}

export interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (_credentials: LoginCredentials) => Promise<LoginResult>;
  register: (_credentials: RegisterCredentials) => Promise<LoginResult>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export interface OrganizationStore {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<void>;
  getOrganizationById: (_id: number) => Promise<OrganizationWithMembers | null>;
  setCurrentOrganization: (_org: Organization | null) => void;
  createOrganization: (_data: CreateOrganizationDto) => Promise<Organization | null>;
  updateOrganization: (_id: number, _data: UpdateOrganizationDto) => Promise<void>;
  deleteOrganization: (_id: number) => Promise<void>;
  addMember: (_orgId: number, _data: AddMemberByIdDto) => Promise<void>;
  updateMemberRole: (_orgId: number, _memberId: number, _role: OrganizationRole) => Promise<void>;
  removeMember: (_orgId: number, _memberId: number) => Promise<void>;
}

export interface ProjectStore {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  selectProject: (_projectId: number) => void;
  createProject: (_data: CreateProjectDto) => Promise<void>;
  updateProject: (_projectId: number, _data: UpdateProjectDto) => Promise<void>;
  deleteProject: (_projectId: number) => Promise<void>;
}

export interface DatabaseStore {
  tables: Table[];
  selectedTable: Table | null;
  columns: Column[];
  tableData: TableData | null;
  sqlHistory: SqlQuery[];
  loading: boolean;
  error: string | null;
  fetchTables: (_projectId: string) => Promise<void>;
  selectTable: (_tableName: string) => void;
  fetchTableData: (_projectId: string, _tableName: string) => Promise<void>;
  executeQuery: (_projectId: string, _query: string) => Promise<void>;
}

export interface StorageStore {
  buckets: StorageBucket[];
  files: StorageFile[];
  selectedBucket: StorageBucket | null;
  uploadProgress: Record<string, FileUploadProgress>;
  loading: boolean;
  error: string | null;
  fetchBuckets: () => Promise<void>;
  fetchFiles: (_projectId: string) => Promise<void>;
  uploadFile: (_projectId: string, _file: File) => Promise<void>;
  deleteFile: (_projectId: string, _filePath: string) => Promise<void>;
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
// COMPONENT PROP TYPES
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  id?: string;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (_event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends BaseComponentProps {
  type?: string;
  value?: any;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (_event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (_event: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  label?: string;
}

export interface SelectProps extends BaseComponentProps {
  value?: any;
  options: { label: string; value: any }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (_value: any) => void;
  error?: string;
  label?: string;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  // All types are already exported above
};

