import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { getToolRegistry } from './registry/ToolRegistry';
import { ToolRouter } from './router/ToolRouter';

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
    // Initialize registry
    const registry = getToolRegistry();
    registry.initialize(this.config);
    const router = new ToolRouter(registry);

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = registry.getAllTools();
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Extract userId from args if available (for authentication)
        const userId = (args as any)?.userId || (args as any)?.authenticatedUserId;
        const projectId = (args as any)?.projectId;

        const context = {
          userId: userId || undefined,
          authenticatedUserId: userId || undefined,
          projectId: projectId || undefined,
        };

        // Execute tool via router
        const result = await router.routeTool(name, args || {}, context);
        return result;
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

