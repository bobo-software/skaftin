import RequestUtils from '../utils/RequsetUtils';
import ApiRoutes from '../constants/ApiRoutes';

class McpService {
  private static getAccessToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  // Execute MCP tool
  static async executeTool(toolName: string, parameters: any): Promise<any> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No access token found');
    }

    return await RequestUtils.post(ApiRoutes.MCP.EXECUTE, token, {
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
}

export default McpService;
