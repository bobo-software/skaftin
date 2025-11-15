import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { getToolRegistry } from './registry/ToolRegistry';
import { ToolRouter } from './router/ToolRouter';
import { getAuthContext, getUserIdFromRequest, getProjectIdFromRequest } from './middleware/auth';
import { sendHTTPResponse } from './transformers/responseTransformers';
import { ToolExecutionContext } from './registry/types';

interface MCPHTTPConfig {
  pool: Pool;
  s3Client: S3Client;
  isClientEndpoint?: boolean; // If true, only expose client-safe tools
}


/**
 * Create HTTP handler for MCP tools list
 */
export function createMCPListToolsHandler(config: MCPHTTPConfig) {
  return async (req: Request, res: Response) => {
    try {
      const registry = getToolRegistry();
      registry.initialize({ pool: config.pool, s3Client: config.s3Client });

      // Get tools filtered by client safety if needed
      const tools = registry.getTools(config.isClientEndpoint || false);

      res.json({
        tools,
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
          status: 'error',
          message: 'Tool name is required',
          data: null,
        });
      }

      // Initialize registry
      const registry = getToolRegistry();
      registry.initialize({ pool: config.pool, s3Client: config.s3Client });
      const router = new ToolRouter(registry);

      // Check if tool is allowed for client endpoint
      if (config.isClientEndpoint && !router.isClientSafe(name)) {
        return res.status(403).json({
          status: 'error',
          message: `Tool '${name}' is not available on client endpoint. Use /api/mcp for admin tools.`,
          data: null,
        });
      }

      // Extract authentication context
      const authContext = await getAuthContext(req, config.pool);
      const userId = getUserIdFromRequest(req);
      const projectIdFromKey = await getProjectIdFromRequest(req, config.pool);

      // Build execution context
      const context: ToolExecutionContext = {
        userId: userId || undefined,
        authenticatedUserId: userId || undefined,
        projectId: projectIdFromKey?.toString() || undefined,
      };

      // Add userId and projectId to args if not provided
      if (userId && args) {
        args.authenticatedUserId = userId;
        if (!args.userId) {
          args.userId = userId;
        }
      }

      if (projectIdFromKey && args && !args.projectId) {
        args.projectId = projectIdFromKey.toString();
        console.log(`📍 Auto-detected project ID from MCP key: ${projectIdFromKey}`);
      }

      // Execute tool
      const result = await router.routeTool(name, args || {}, context);

      // Transform and send response
      sendHTTPResponse(res, result);
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

