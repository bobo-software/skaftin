import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createDatabaseTools, handleDatabaseTool } from './tools/databaseTools';
import { createStorageTools, handleStorageTool } from './tools/storageTools';
import { createProjectTools, handleProjectTool } from './tools/projectTools';

export interface MCPServerConfig {
  pool: Pool;
  s3Client: S3Client;
}

export class MCPServer {
  private server: Server;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'skaftin-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const databaseTools = createDatabaseTools(this.config);
      const storageTools = createStorageTools(this.config);
      const projectTools = createProjectTools(this.config);

      return {
        tools: [
          ...databaseTools,
          ...storageTools,
          ...projectTools,
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Determine tool category
        const databaseToolNames = [
          'search_docs',
          'list_tables',
          'list_extensions',
          'list_migrations',
          'apply_migration',
          'execute_sql',
          'get_logs',
          'get_advisors',
          'generate_typescript_types',
          'create_schema',
          'delete_schema',
          'create_table',
          'get_table_schema',
          'insert_data',
          'bulk_insert_data',
          'update_data',
          'delete_data',
          'select_data',
          'drop_table',
        ];

        const storageToolNames = [
          'search_bucket',
          'upload_file',
          'download_file',
          'list_buckets',
          'create_bucket',
          'delete_bucket',
          'list_files',
        ];

        const projectToolNames = [
          'get_project_info',
          'update_project_settings',
          'list_projects',
        ];

        // Extract userId from args if available (for authentication)
        const userId = (args as any)?.userId || (args as any)?.authenticatedUserId;

        if (databaseToolNames.includes(name)) {
          const result = await handleDatabaseTool(name, args, this.config);
          return result;
        } else if (storageToolNames.includes(name)) {
          const result = await handleStorageTool(name, args, this.config);
          return result;
        } else if (projectToolNames.includes(name)) {
          const result = await handleProjectTool(name, args, this.config, userId);
          return result;
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
              },
            ],
            isError: true,
          };
        }
      } catch (error: any) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: error.message || 'Unknown error',
                  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server started on stdio');
  }

  getServer(): Server {
    return this.server;
  }
}

