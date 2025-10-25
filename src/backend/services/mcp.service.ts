import { DatabaseService } from './database.service';
import { StorageService } from './storage.service';
import { ProjectService } from './project.service';
import SocketService from './socket.service';

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  category: 'database' | 'storage' | 'project' | 'utility';
}

export interface MCPResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    timestamp: string;
  };
}

export class MCPService {
  private databaseService: DatabaseService;
  private storageService: StorageService;
  private projectService: ProjectService;

  constructor(socketService?: SocketService) {
    this.databaseService = new DatabaseService(socketService);
    this.storageService = new StorageService();
    this.projectService = new ProjectService();
  }

  // List all available MCP tools
  async listTools(): Promise<MCPTool[]> {
    return [
      // Database Tools
      {
        name: 'execute_sql',
        description: 'Execute SQL queries on a project database',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
          { name: 'parameters', type: 'array', required: false, description: 'Query parameters' }
        ],
        category: 'database'
      },
      {
        name: 'list_tables',
        description: 'List all tables in a project schema',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' }
        ],
        category: 'database'
      },
      {
        name: 'create_table',
        description: 'Create a new table in a project schema',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'columns', type: 'array', required: true, description: 'Table column definitions' }
        ],
        category: 'database'
      },
      {
        name: 'get_table_schema',
        description: 'Get the schema definition of a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' }
        ],
        category: 'database'
      },
      {
        name: 'generate_typescript_types',
        description: 'Generate TypeScript types from database schema',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: false, description: 'Specific table name (optional)' }
        ],
        category: 'database'
      },
      {
        name: 'insert_data',
        description: 'Insert data into a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'data', type: 'object', required: true, description: 'Data to insert' }
        ],
        category: 'database'
      },
      {
        name: 'update_data',
        description: 'Update data in a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'data', type: 'object', required: true, description: 'Data to update' },
          { name: 'where', type: 'object', required: true, description: 'WHERE conditions' }
        ],
        category: 'database'
      },
      {
        name: 'delete_data',
        description: 'Delete data from a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'where', type: 'object', required: true, description: 'WHERE conditions' }
        ],
        category: 'database'
      },
      {
        name: 'select_data',
        description: 'Select data from a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'columns', type: 'array', required: false, description: 'Columns to select (default: all)' },
          { name: 'where', type: 'object', required: false, description: 'WHERE conditions' },
          { name: 'limit', type: 'number', required: false, description: 'Limit number of rows' },
          { name: 'offset', type: 'number', required: false, description: 'Offset for pagination' }
        ],
        category: 'database'
      },
      {
        name: 'add_column',
        description: 'Add a column to an existing table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'columnName', type: 'string', required: true, description: 'Name of the column' },
          { name: 'columnType', type: 'string', required: true, description: 'Data type of the column' },
          { name: 'nullable', type: 'boolean', required: false, description: 'Whether column is nullable' }
        ],
        category: 'database'
      },
      {
        name: 'drop_column',
        description: 'Drop a column from a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'columnName', type: 'string', required: true, description: 'Name of the column to drop' }
        ],
        category: 'database'
      },
      {
        name: 'drop_table',
        description: 'Drop a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table to drop' }
        ],
        category: 'database'
      },
      {
        name: 'create_index',
        description: 'Create an index on a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'indexName', type: 'string', required: true, description: 'Name of the index' },
          { name: 'columns', type: 'array', required: true, description: 'Columns to index' },
          { name: 'unique', type: 'boolean', required: false, description: 'Whether index is unique' }
        ],
        category: 'database'
      },
      {
        name: 'list_indexes',
        description: 'List indexes on a table',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' }
        ],
        category: 'database'
      },
      {
        name: 'create_foreign_key',
        description: 'Create a foreign key constraint',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'tableName', type: 'string', required: true, description: 'Name of the table' },
          { name: 'columnName', type: 'string', required: true, description: 'Name of the column' },
          { name: 'referencedTable', type: 'string', required: true, description: 'Referenced table' },
          { name: 'referencedColumn', type: 'string', required: true, description: 'Referenced column' }
        ],
        category: 'database'
      },
      {
        name: 'backup_schema',
        description: 'Create a backup of the project schema',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'backupName', type: 'string', required: false, description: 'Name for the backup' }
        ],
        category: 'database'
      },
      {
        name: 'restore_schema',
        description: 'Restore a schema from backup',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'backupName', type: 'string', required: true, description: 'Name of the backup to restore' }
        ],
        category: 'database'
      },

      // Storage Tools
      {
        name: 'list_files',
        description: 'List files in a project storage bucket',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'prefix', type: 'string', required: false, description: 'File path prefix' }
        ],
        category: 'storage'
      },
      {
        name: 'upload_file',
        description: 'Upload a file to project storage',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'fileName', type: 'string', required: true, description: 'Name of the file' },
          { name: 'fileData', type: 'string', required: true, description: 'Base64 encoded file data' },
          { name: 'contentType', type: 'string', required: false, description: 'MIME type of the file' }
        ],
        category: 'storage'
      },
      {
        name: 'download_file',
        description: 'Download a file from project storage',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'fileName', type: 'string', required: true, description: 'Name of the file' }
        ],
        category: 'storage'
      },
      {
        name: 'delete_file',
        description: 'Delete a file from project storage',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'fileName', type: 'string', required: true, description: 'Name of the file' }
        ],
        category: 'storage'
      },

      // Project Tools
      {
        name: 'list_projects',
        description: 'List all projects for a user',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' }
        ],
        category: 'project'
      },
      {
        name: 'create_project',
        description: 'Create a new project',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' },
          { name: 'name', type: 'string', required: true, description: 'Project name' },
          { name: 'description', type: 'string', required: false, description: 'Project description' }
        ],
        category: 'project'
      },
      {
        name: 'get_project_info',
        description: 'Get project information',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' }
        ],
        category: 'project'
      },
      {
        name: 'delete_project',
        description: 'Delete a project (removes schema and bucket)',
        parameters: [
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' }
        ],
        category: 'project'
      },

      // Utility Tools
      {
        name: 'search_docs',
        description: 'Search through documentation and help content',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'category', type: 'string', required: false, description: 'Documentation category' }
        ],
        category: 'utility'
      },
      {
        name: 'get_logs',
        description: 'Get system logs for debugging',
        parameters: [
          { name: 'projectId', type: 'string', required: false, description: 'Project ID (optional)' },
          { name: 'level', type: 'string', required: false, description: 'Log level filter' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum number of logs' }
        ],
        category: 'utility'
      }
    ];
  }

  // Execute a specific MCP tool
  async executeTool(toolName: string, parameters: any, projectId?: string): Promise<MCPResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Executing MCP tool: ${toolName}`);
      console.log(`📊 Parameters:`, parameters);

      let result: any;

      switch (toolName) {
        // Database Tools
        case 'execute_sql':
          result = await this.databaseService.executeQuery(
            parameters.projectId || projectId,
            parameters.query,
            parameters.parameters || []
          );
          break;

        case 'list_tables':
          result = await this.databaseService.listTables(parameters.projectId || projectId);
          break;

        case 'create_table':
          result = await this.databaseService.createTable(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.columns
          );
          break;

        case 'get_table_schema':
          result = await this.databaseService.getTableSchema(
            parameters.projectId || projectId,
            parameters.tableName
          );
          break;

        case 'generate_typescript_types':
          result = await this.databaseService.generateTypeScriptTypes(
            parameters.projectId || projectId,
            parameters.tableName
          );
          break;

        case 'insert_data':
          result = await this.databaseService.insertData(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.data
          );
          break;

        case 'update_data':
          result = await this.databaseService.updateData(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.data,
            parameters.where
          );
          break;

        case 'delete_data':
          result = await this.databaseService.deleteData(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.where
          );
          break;

        case 'select_data':
          result = await this.databaseService.selectData(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.columns,
            parameters.where,
            parameters.limit,
            parameters.offset
          );
          break;

        case 'add_column':
          result = await this.databaseService.addColumn(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.columnName,
            parameters.columnType,
            parameters.nullable
          );
          break;

        case 'drop_column':
          result = await this.databaseService.dropColumn(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.columnName
          );
          break;

        case 'drop_table':
          result = await this.databaseService.dropTable(
            parameters.projectId || projectId,
            parameters.tableName
          );
          break;

        case 'create_index':
          result = await this.databaseService.createIndex(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.indexName,
            parameters.columns,
            parameters.unique
          );
          break;

        case 'list_indexes':
          result = await this.databaseService.listIndexes(
            parameters.projectId || projectId,
            parameters.tableName
          );
          break;

        case 'create_foreign_key':
          result = await this.databaseService.createForeignKey(
            parameters.projectId || projectId,
            parameters.tableName,
            parameters.columnName,
            parameters.referencedTable,
            parameters.referencedColumn
          );
          break;

        case 'backup_schema':
          result = await this.databaseService.backupSchema(
            parameters.projectId || projectId,
            parameters.backupName
          );
          break;

        case 'restore_schema':
          result = await this.databaseService.restoreSchema(
            parameters.projectId || projectId,
            parameters.backupName
          );
          break;

        // Storage Tools
        case 'list_files':
          result = await this.storageService.listFiles(
            parameters.projectId || projectId,
            parameters.prefix
          );
          break;

        case 'upload_file':
          result = await this.storageService.uploadFile(
            parameters.projectId || projectId,
            parameters.fileName,
            parameters.fileData,
            parameters.contentType
          );
          break;

        case 'download_file':
          result = await this.storageService.downloadFile(
            parameters.projectId || projectId,
            parameters.fileName
          );
          break;

        case 'delete_file':
          result = await this.storageService.deleteFile(
            parameters.projectId || projectId,
            parameters.fileName
          );
          break;

        // Project Tools
        case 'list_projects':
          result = await this.projectService.getUserProjects(parameters.userId);
          break;

        case 'create_project':
          result = await this.projectService.createProject(
            parameters.userId,
            parameters.name,
            parameters.description
          );
          break;

        case 'get_project_info':
          result = await this.projectService.getProject(parameters.projectId || projectId);
          break;

        case 'delete_project':
          await this.projectService.deleteProject(parameters.projectId || projectId);
          result = { success: true, message: 'Project deleted successfully' };
          break;

        // Utility Tools
        case 'search_docs':
          result = await this.searchDocumentation(parameters.query, parameters.category);
          break;

        case 'get_logs':
          result = await this.getSystemLogs(parameters.projectId, parameters.level, parameters.limit);
          break;

        default:
          throw new Error(`Unknown MCP tool: ${toolName}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Get tool documentation
  async getToolDocumentation(toolName: string): Promise<MCPTool | null> {
    const tools = await this.listTools();
    return tools.find(tool => tool.name === toolName) || null;
  }

  // Check MCP service health
  async checkHealth(): Promise<any> {
    try {
      const dbHealth = await this.databaseService.checkConnection();
      const storageHealth = await this.storageService.checkConnection();
      
      return {
        status: 'healthy',
        services: {
          database: dbHealth,
          storage: storageHealth
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Search documentation (placeholder implementation)
  private async searchDocumentation(query: string, category?: string): Promise<any> {
    // This would integrate with your documentation system
    return {
      query,
      category,
      results: [
        {
          title: 'Database Operations',
          content: 'Learn how to perform database operations...',
          url: '/docs/database'
        }
      ]
    };
  }

  // Get system logs (placeholder implementation)
  private async getSystemLogs(projectId?: string, level?: string, limit?: number): Promise<any> {
    // This would integrate with your logging system
    return {
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System running normally',
          projectId
        }
      ],
      total: 1
    };
  }
}
