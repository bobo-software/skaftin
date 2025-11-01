import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createMCPRoutes } from '../mcp/httpServer';

class MCPController {
  private static mcpRoutes: any = null;

  /**
   * Initialize MCP routes with pool and s3Client
   */
  static initialize(pool: Pool, s3Client: S3Client) {
    this.mcpRoutes = createMCPRoutes({ pool, s3Client });
  }

  /**
   * List available MCP tools
   */
  static async listTools(req: Request, res: Response) {
    if (!MCPController.mcpRoutes) {
      return res.status(500).json({
        status: 'error',
        message: 'MCP service not initialized',
      });
    }
    return MCPController.mcpRoutes.listTools(req, res);
  }

  /**
   * Call an MCP tool
   */
  static async callTool(req: Request, res: Response) {
    if (!MCPController.mcpRoutes) {
      return res.status(500).json({
        status: 'error',
        message: 'MCP service not initialized',
      });
    }
    return MCPController.mcpRoutes.callTool(req, res);
  }

  /**
   * Legacy MCP endpoint handler
   */
  static async legacyHandler(req: Request, res: Response) {
    if (!MCPController.mcpRoutes) {
      return res.status(500).json({
        status: 'error',
        message: 'MCP service not initialized',
      });
    }

    if (req.body.method === 'tools/list') {
      return MCPController.mcpRoutes.listTools(req, res);
    } else if (req.body.method === 'tools/call') {
      return MCPController.mcpRoutes.callTool(req, res);
    } else {
      res.status(400).json({ error: 'Invalid MCP method' });
    }
  }
}

export default MCPController;

