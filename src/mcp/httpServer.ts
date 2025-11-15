import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { MCPServer } from './MCPServer';
import { handleDatabaseTool } from './tools/databaseTools';
import { handleStorageTool } from './tools/storageTools';
import { handleProjectTool } from './tools/projectTools';
import { handleCredentialsTool } from './tools/credentialsTools';
import { createDatabaseTools } from './tools/databaseTools';
import { createStorageTools } from './tools/storageTools';
import { createProjectTools } from './tools/projectTools';
import { createCredentialsTools } from './tools/credentialsTools';
import CredentialsController from '../controllers/CredentialsController';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface MCPHTTPConfig {
  pool: Pool;
  s3Client: S3Client;
}

/**
 * Get header value with case-insensitive lookup
 */
function getHeader(req: Request, headerName: string): string | undefined {
  if (!req.headers) {
    console.log(`⚠️  No headers object on request`);
    return undefined;
  }

  const lowerName = headerName.toLowerCase();
  
  // Try exact match first
  if (req.headers[headerName]) {
    return req.headers[headerName] as string;
  }
  
  // Try lowercase
  if (req.headers[lowerName]) {
    return req.headers[lowerName] as string;
  }
  
  // Try uppercase
  const upperName = headerName.toUpperCase();
  if (req.headers[upperName]) {
    return req.headers[upperName] as string;
  }
  
  // Try with first letter capitalized
  const capitalName = headerName.charAt(0).toUpperCase() + headerName.slice(1);
  if (req.headers[capitalName]) {
    return req.headers[capitalName] as string;
  }
  
  return undefined;
}

/**
 * Extract user ID from JWT token in request
 * Handles case-insensitive header lookup
 */
function getUserIdFromRequest(req: Request): string | null {
  // Use the helper to get authorization header
  const authHeader = getHeader(req, 'authorization');
  
  if (!authHeader) {
    console.log('⚠️  No authorization header found in request');
    console.log('  └─ Available headers:', Object.keys(req.headers || {}).join(', '));
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('⚠️  Invalid authorization header format');
    return null;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId?.toString() || null;
  } catch (error) {
    console.log('⚠️  Token verification failed:', error);
    return null;
  }
}

/**
 * Extract project ID from MCP key or API key in request
 * Checks x-access-token and x-api-key headers
 */
async function getProjectIdFromRequest(req: Request, pool: Pool): Promise<number | null> {
  // Check for MCP key or API key in headers
  const accessToken = getHeader(req, 'x-access-token');
  const apiKey = getHeader(req, 'x-api-key');
  const credential = accessToken || apiKey;

  if (!credential) {
    return null;
  }

  try {
    const verification = await CredentialsController.verifyCredential(pool, credential);
    
    if (verification.valid && verification.credential) {
      return verification.credential.project_id;
    }
  } catch (error) {
    console.error('Error verifying credential for project ID extraction:', error);
  }

  return null;
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
      const credentialsTools = createCredentialsTools(config);

      res.json({
        tools: [
          ...databaseTools,
          ...storageTools,
          ...projectTools,
          ...credentialsTools,
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

      // Extract projectId from MCP key/API key and add to args if not provided
      const projectIdFromKey = await getProjectIdFromRequest(req, config.pool);
      if (projectIdFromKey && args && !args.projectId) {
        args.projectId = projectIdFromKey.toString();
        console.log(`📍 Auto-detected project ID from MCP key: ${projectIdFromKey}`);
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
        'create_table',
        'get_table_schema',
        'insert_data',
        'bulk_insert_data',
        'update_data',
        'delete_data',
        'select_data',
        'drop_table',
        'create_foreign_key',
        'list_cron_jobs',
        'create_cron_job',
        'update_cron_job',
        'delete_cron_job',
        'toggle_cron_job',
        'get_cron_job_history',
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

      let result;
      if (databaseToolNames.includes(name)) {
        result = await handleDatabaseTool(name, args || {}, config);
      } else if (storageToolNames.includes(name)) {
        result = await handleStorageTool(name, args || {}, config);
      } else if (projectToolNames.includes(name)) {
        result = await handleProjectTool(name, args || {}, config, userId || undefined);
      } else if (credentialsToolNames.includes(name)) {
        result = await handleCredentialsTool(name, args || {}, config);
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

