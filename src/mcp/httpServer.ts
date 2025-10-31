import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { MCPServer } from './MCPServer.js'; 
import { handleDatabaseTool } from './tools/databaseTools';
import { handleStorageTool } from './tools/storageTools';
import { handleProjectTool } from './tools/projectTools';
import { createDatabaseTools } from './tools/databaseTools';
import { createStorageTools } from './tools/storageTools';
import { createProjectTools } from './tools/projectTools';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface MCPHTTPConfig {
  pool: Pool;
  s3Client: S3Client;
}

/**
 * Extract user ID from JWT token in request
 */
function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId?.toString() || null;
  } catch (error) {
    return null;
  }
}

/**
 * Create HTTP handler for MCP tools list
 */
export function createMCPListToolsHandler(config: MCPHTTPConfig) {
  return async (req: Request, res: Response) => {
    try {
      const databaseTools = createDatabaseTools(config);
      const storageTools = createStorageTools(config);
      const projectTools = createProjectTools(config);

      res.json({
        tools: [
          ...databaseTools,
          ...storageTools,
          ...projectTools,
        ],
      });
    } catch (error: any) {
      console.error('Error listing MCP tools:', error);
      res.status(500).json({
        error: 'Failed to list tools',
        message: error.message,
      });
    }
  };
}

/**
 * Create HTTP handler for MCP tool calls
 */
export function createMCPCallToolHandler(config: MCPHTTPConfig) {
  return async (req: Request, res: Response) => {
    try {
      const { name, arguments: args } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Tool name is required',
        });
      }

      // Extract userId from token and add to args
      const userId = getUserIdFromRequest(req);
      if (userId && args) {
        args.authenticatedUserId = userId;
        if (!args.userId) {
          args.userId = userId;
        }
      }

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

      let result;
      if (databaseToolNames.includes(name)) {
        result = await handleDatabaseTool(name, args || {}, config);
      } else if (storageToolNames.includes(name)) {
        result = await handleStorageTool(name, args || {}, config);
      } else if (projectToolNames.includes(name)) {
        result = await handleProjectTool(name, args || {}, config, userId || undefined);
      } else {
        return res.status(400).json({
          error: `Unknown tool: ${name}`,
        });
      }

      // Handle MCP response format
      if (result.isError) {
        return res.status(500).json({
          error: 'Tool execution failed',
          content: result.content,
        });
      }

      res.json({
        content: result.content,
      });
    } catch (error: any) {
      console.error('Error executing MCP tool:', error);
      res.status(500).json({
        error: 'Failed to execute tool',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };
}

/**
 * Create Express routes for MCP HTTP endpoint
 */
export function createMCPRoutes(config: MCPHTTPConfig) {
  return {
    listTools: createMCPListToolsHandler(config),
    callTool: createMCPCallToolHandler(config),
  };
}

