import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

class McpService {
  private static getAccessToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  // Execute MCP tool
  static async executeTool(toolName: string, parameters: any): Promise<any> {
    const token = this.getAccessToken() || '';
    return await RequestUtils.post(ApiRoutes.MCP.CALL, token, {
      name: toolName,
      arguments: parameters
    });
  }

  // List all projects for a user
  static async listProjects(userId: string): Promise<any> {
    return await this.executeTool('list_projects', { userId });
  }

  // Create a new project
  static async createProject(userId: string, name: string, description?: string): Promise<any> {
    return await this.executeTool('create_project', { userId, name, description });
  }

  // Get project information
  static async getProjectInfo(projectId: string): Promise<any> {
    return await this.executeTool('get_project_info', { projectId });
  }

  // Delete a project
  static async deleteProject(projectId: string): Promise<any> {
    return await this.executeTool('delete_project', { projectId });
  }

  // Database operations
  static async listTables(projectId: string): Promise<any> {
    return await this.executeTool('list_tables', { projectId });
  }

  static async createTable(projectId: string, tableName: string, columns: any[]): Promise<any> {
    return await this.executeTool('create_table', { projectId, tableName, columns });
  }

  static async getTableSchema(projectId: string, tableName: string): Promise<any> {
    return await this.executeTool('get_table_schema', { projectId, tableName });
  }

  static async executeSql(projectId: string, query: string, parameters?: any[]): Promise<any> {
    return await this.executeTool('execute_sql', { projectId, query, parameters });
  }

  // Alias for executeSql for consistency
  static async executeQuery(projectId: string, query: string, parameters?: any[]): Promise<any> {
    return await this.executeSql(projectId, query, parameters);
  }

  // Additional database operations
  static async insertData(projectId: string, tableName: string, data: any): Promise<any> {
    return await this.executeTool('insert_data', { projectId, tableName, data });
  }

  static async bulkInsertData(projectId: string, tableName: string, dataArray: any[]): Promise<any> {
    return await this.executeTool('bulk_insert_data', { projectId, tableName, dataArray });
  }

  static async listForeignKeys(projectId: string, tableName: string): Promise<any> {
    return await this.executeTool('list_foreign_keys', { projectId, tableName });
  }

  static async updateData(projectId: string, tableName: string, data: any, where: any): Promise<any> {
    return await this.executeTool('update_data', { projectId, tableName, data, where });
  }

  static async deleteData(projectId: string, tableName: string, where: any): Promise<any> {
    return await this.executeTool('delete_data', { projectId, tableName, where });
  }

  static async selectData(projectId: string, tableName: string, options?: any): Promise<any> {
    return await this.executeTool('select_data', { projectId, tableName, ...options });
  }

  static async dropTable(projectId: string, tableName: string): Promise<any> {
    return await this.executeTool('drop_table', { projectId, tableName });
  }

  static async addColumn(projectId: string, tableName: string, columnName: string, columnType: string, nullable?: boolean): Promise<any> {
    return await this.executeTool('add_column', { projectId, tableName, columnName, columnType, nullable });
  }

  static async alterColumn(projectId: string, tableName: string, columnName: string, changes: {
    newName?: string;
    newType?: string;
    nullable?: boolean;
    defaultValue?: string;
  }): Promise<any> {
    return await this.executeTool('alter_column', { 
      projectId, 
      tableName, 
      columnName, 
      ...changes 
    });
  }

  static async dropColumn(projectId: string, tableName: string, columnName: string): Promise<any> {
    return await this.executeTool('drop_column', { projectId, tableName, columnName });
  }

  static async createIndex(projectId: string, tableName: string, indexName: string, columns: string[], unique?: boolean): Promise<any> {
    return await this.executeTool('create_index', { projectId, tableName, indexName, columns, unique });
  }

  static async listIndexes(projectId: string, tableName: string): Promise<any> {
    return await this.executeTool('list_indexes', { projectId, tableName });
  }

  static async createForeignKey(
    projectId: string, 
    tableName: string, 
    columnName: string, 
    referencedTable: string, 
    referencedColumn: string,
    onDelete: string = 'RESTRICT',
    onUpdate: string = 'RESTRICT'
  ): Promise<any> {
    return await this.executeTool('create_foreign_key', { 
      projectId, 
      tableName, 
      columnName, 
      referencedTable, 
      referencedColumn,
      onDelete,
      onUpdate
    });
  }

  static async backupSchema(projectId: string, backupName?: string): Promise<any> {
    return await this.executeTool('backup_schema', { projectId, backupName });
  }

  static async restoreSchema(projectId: string, backupName: string): Promise<any> {
    return await this.executeTool('restore_schema', { projectId, backupName });
  }

  static async getDatabaseStats(projectId: string): Promise<any> {
    return await this.executeTool('get_database_stats', { projectId });
  }

  // Storage operations
  static async listFiles(projectId: string, prefix?: string): Promise<any> {
    return await this.executeTool('list_files', { projectId, prefix });
  }

  static async uploadFile(projectId: string, fileName: string, fileData: string, contentType?: string): Promise<any> {
    return await this.executeTool('upload_file', { projectId, fileName, fileData, contentType });
  }

  static async downloadFile(projectId: string, fileName: string): Promise<any> {
    return await this.executeTool('download_file', { projectId, fileName });
  }

  static async deleteFile(projectId: string, fileName: string): Promise<any> {
    return await this.executeTool('delete_file', { projectId, fileName });
  }

  // Constraint management methods
  static async listAllConstraints(projectId: string, tableName: string): Promise<any> {
    return await this.executeTool('list_all_constraints', { projectId, tableName });
  }

  static async dropForeignKey(projectId: string, tableName: string, constraintName: string): Promise<any> {
    return await this.executeTool('drop_foreign_key', { projectId, tableName, constraintName });
  }

  static async addCheckConstraint(projectId: string, tableName: string, constraintName: string, checkClause: string): Promise<any> {
    return await this.executeTool('add_check_constraint', { projectId, tableName, constraintName, checkClause });
  }

  static async dropConstraint(projectId: string, tableName: string, constraintName: string): Promise<any> {
    return await this.executeTool('drop_constraint', { projectId, tableName, constraintName });
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Create multiple application users in a single operation
   */
  static async bulkCreateAppUsers(
    projectId: string,
    users: Array<{
      name: string;
      email: string;
      phone?: string;
      password: string;
      role_ids?: number[];
      metadata?: Record<string, any>;
    }>,
    options?: {
      continueOnError?: boolean;
      skipDuplicates?: boolean;
      batchSize?: number;
    }
  ): Promise<any> {
    return await this.executeTool('bulk_create_app_users', { projectId, users, options });
  }

  /**
   * Execute multiple operations in a single call, optionally within a transaction
   */
  static async executeBatchOperations(
    projectId: string,
    operations: Array<{
      type: 'create_user' | 'insert_data' | 'update_data' | 'delete_data' | 'execute_sql';
      data: any;
    }>,
    options?: {
      transaction?: boolean;
      continueOnError?: boolean;
      rollbackOnError?: boolean;
    }
  ): Promise<any> {
    return await this.executeTool('execute_batch_operations', { projectId, operations, options });
  }

  /**
   * Migrate any table to app_users system
   */
  static async migrateTableToUsers(
    projectId: string,
    sourceTable: string,
    sourceIdColumn: string,
    mapping: {
      name: string;
      email: string;
      phone?: string;
      role_ids: number[];
      metadata?: Record<string, string>;
    },
    options?: {
      where?: Record<string, any>;
      batchSize?: number;
      continueOnError?: boolean;
      skipDuplicates?: boolean;
    }
  ): Promise<any> {
    return await this.executeTool('migrate_table_to_users', {
      projectId,
      sourceTable,
      sourceIdColumn,
      mapping,
      options,
    });
  }

  /**
   * Create a migration job to track progress
   */
  static async createMigrationJob(
    projectId: string,
    jobName: string,
    jobType: 'table_to_users' | 'bulk_create_users' | 'custom',
    totalRecords: number,
    metadata?: Record<string, any>
  ): Promise<any> {
    return await this.executeTool('create_migration_job', {
      projectId,
      jobName,
      jobType,
      totalRecords,
      metadata,
    });
  }

  /**
   * Update migration job progress and status
   */
  static async updateMigrationJob(
    projectId: string,
    jobId: string,
    processed: number,
    created?: number,
    skipped?: number,
    errors?: number,
    status?: 'running' | 'completed' | 'failed' | 'paused'
  ): Promise<any> {
    return await this.executeTool('update_migration_job', {
      projectId,
      jobId,
      processed,
      created,
      skipped,
      errors,
      status,
    });
  }

  /**
   * Get migration job details and progress
   */
  static async getMigrationJob(projectId: string, jobId: string): Promise<any> {
    return await this.executeTool('get_migration_job', { projectId, jobId });
  }

  /**
   * Validate data before migration
   */
  static async validateMigrationData(
    projectId: string,
    sourceTable: string,
    validation: {
      requiredColumns: string[];
      emailColumns?: string[];
      phoneColumns?: string[];
      uniqueColumns?: string[];
      customRules?: Array<{
        column: string;
        rule: 'not_null' | 'unique' | 'email_format' | 'phone_format' | 'custom';
        expression?: string;
      }>;
    },
    options?: {
      where?: Record<string, any>;
      sampleSize?: number;
    }
  ): Promise<any> {
    return await this.executeTool('validate_migration_data', {
      projectId,
      sourceTable,
      validation,
      options,
    });
  }

  /**
   * Find existing user by email or phone, or create new one if not found
   */
  static async findOrCreateUser(
    projectId: string,
    lookup: {
      email?: string;
      phone?: string;
    },
    createData?: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      role_ids?: number[];
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    return await this.executeTool('find_or_create_user', { projectId, lookup, createData });
  }
}

export default McpService;
