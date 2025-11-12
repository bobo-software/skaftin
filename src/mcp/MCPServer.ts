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
import { createGraphQLTools, handleGraphQLTool } from './tools/graphqlTools';
import { createCommunicationsTools, handleCommunicationsTool } from './tools/communicationsTools';
import { createAuthTools, handleAuthTool } from './tools/authTools';
import { createCredentialsTools, handleCredentialsTool } from './tools/credentialsTools';

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
      const graphqlTools = createGraphQLTools(this.config);
      const communicationsTools = createCommunicationsTools(this.config);
      const authTools = createAuthTools(this.config);
      const credentialsTools = createCredentialsTools(this.config);

      return {
        tools: [
          ...databaseTools,
          ...storageTools,
          ...projectTools,
          ...graphqlTools,
          ...communicationsTools,
          ...authTools,
          ...credentialsTools,
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

        const graphqlToolNames = [
          'graphql_query',
          'graphql_mutation',
          'graphql_list_tables',
          'graphql_get_table_schema',
          'graphql_query_table',
          'graphql_insert_data',
          'graphql_bulk_insert',
          'graphql_update_data',
          'graphql_delete_data',
          'graphql_create_table',
          'graphql_drop_table',
          'graphql_add_column',
          'graphql_create_foreign_key',
          'graphql_get_constraints',
          'graphql_introspect_schema',
        ];

        const communicationsToolNames = [
          'list_email_providers',
          'get_email_provider',
          'create_email_provider',
          'update_email_provider',
          'delete_email_provider',
          'test_email_connection',
          'send_email',
        ];

        const authToolNames = [
          'list_app_users',
          'get_app_user',
          'create_app_user',
          'update_app_user',
          'delete_app_user',
          'assign_user_role',
          'list_app_roles',
          'get_app_role',
          'create_app_role',
          'update_app_role',
          'delete_app_role',
          'list_custom_fields',
          'create_custom_field',
          'apply_custom_field',
          'get_auth_settings',
          'update_auth_settings',
        ];

        const credentialsToolNames = [
          'list_api_credentials',
          'get_api_credential',
          'create_api_credential',
          'update_api_credential',
          'delete_api_credential',
          'get_mcp_key',
          'regenerate_mcp_key',
          'get_credential_permissions',
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
        } else if (graphqlToolNames.includes(name)) {
          const result = await handleGraphQLTool(name, args, this.config);
          return result;
        } else if (communicationsToolNames.includes(name)) {
          const result = await handleCommunicationsTool(name, args, this.config);
          return result;
        } else if (authToolNames.includes(name)) {
          const result = await handleAuthTool(name, args, this.config);
          return result;
        } else if (credentialsToolNames.includes(name)) {
          const result = await handleCredentialsTool(name, args, this.config);
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

