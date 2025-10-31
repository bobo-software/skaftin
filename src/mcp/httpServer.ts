import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { MCPServer } from './MCPServer';
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
          status: 'error',
          message: `Unknown tool: ${name}`,
          data: null,
        });
      }

      // Transform MCP response format to standard format
      if (result.isError) {
        let errorMessage = 'Tool execution failed';
        let errorData = null;

        // Try to extract error message from content
        if (result.content && result.content[0]?.text) {
          try {
            const parsed = JSON.parse(result.content[0].text);
            errorMessage = parsed.error || parsed.message || errorMessage;
            errorData = parsed;
          } catch {
            errorMessage = result.content[0].text;
          }
        }

        return res.status(500).json({
          status: 'error',
          message: errorMessage,
          data: errorData,
        });
      }

      // Extract data from MCP content format
      let responseData = null;
      let responseMessage = 'Operation completed successfully';

      if (result.content && result.content[0]?.text) {
        try {
          responseData = JSON.parse(result.content[0].text);
          
          // Extract message if present in data
          if (responseData.message) {
            responseMessage = responseData.message;
            delete responseData.message;
          }
          
          // Handle different data structures
          if (responseData.error) {
            return res.status(500).json({
              status: 'error',
              message: responseData.error,
              data: responseData,
            });
          }

          // If data contains a single key (like 'projects', 'files', etc.), extract it
          // This handles cases where MCP tools return { projects: [...] } and we want just [...]
          const keys = Object.keys(responseData);
          if (keys.length === 1) {
            const value = responseData[keys[0]];
            // Extract if it's an array or a non-error object
            if (Array.isArray(value) || (typeof value === 'object' && value !== null && !value.error)) {
              responseData = value;
            }
          }
        } catch {
          // If parsing fails, treat as text response
          responseData = result.content[0].text;
          responseMessage = 'Operation completed';
        }
      }

      res.json({
        status: 'success',
        message: responseMessage,
        data: responseData,
      });
    } catch (error: any) {
      console.error('Error executing MCP tool:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to execute tool',
        data: process.env.NODE_ENV === 'development' ? { stack: error.stack } : null,
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

