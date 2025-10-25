import RequestUtils from '../utils/RequsetUtils';
import ApiRoutes from '../constants/ApiRoutes';

class McpService {
  private static getAccessToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  // Execute MCP tool
  static async executeTool(toolName: string, parameters: any): Promise<any> {
    const token = this.getAccessToken();
    
    // For now, allow execution without token for testing
    // TODO: Add proper authentication when needed
    return await RequestUtils.post(ApiRoutes.MCP.EXECUTE, token || '', {
      tool: toolName,
      parameters
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

  static async createForeignKey(projectId: string, tableName: string, columnName: string, referencedTable: string, referencedColumn: string): Promise<any> {
    return await this.executeTool('create_foreign_key', { projectId, tableName, columnName, referencedTable, referencedColumn });
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
}

export default McpService;
