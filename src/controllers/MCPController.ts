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

  /**
   * MCP Protocol endpoint (JSON-RPC 2.0)
   * Handles both initialization and tool operations
   */
  static async mcpProtocolHandler(req: Request, res: Response) {
    if (!MCPController.mcpRoutes) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'MCP service not initialized',
        },
        id: null,
      });
    }

    const { jsonrpc, id, method, params } = req.body;

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"',
        },
        id: id || null,
      });
    }

    try {
      // Log incoming request for debugging
      console.log('🔍 [MCP Protocol] Incoming request:');
      console.log('  └─ Method:', method);
      console.log('  └─ Headers:', JSON.stringify(req.headers, null, 2));
      console.log('  └─ Body:', JSON.stringify(req.body, null, 2));

      // Handle initialization
      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'skaftin-mcp-server',
              version: '1.0.0',
            },
          },
          id,
        });
      }

      // Handle tools/list
      if (method === 'tools/list') {
        // Forward headers to the mock request
        const mockReq = { 
          ...req, 
          body: {},
          headers: req.headers // Ensure headers are forwarded
        } as Request;
        
        const mockRes: any = {
          json: (data: any) => {
            return res.json({
              jsonrpc: '2.0',
              result: {
                tools: data.tools || [],
              },
              id,
            });
          },
          status: () => mockRes,
        };
        return MCPController.mcpRoutes.listTools(mockReq, mockRes);
      }

      // Handle tools/call
      if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        console.log('🔧 [MCP Protocol] Tool call:');
        console.log('  └─ Tool:', toolName);
        console.log('  └─ Args:', JSON.stringify(toolArgs, null, 2));

        // Forward headers to the mock request
        const mockReq = { 
          ...req, 
          body: { name: toolName, arguments: toolArgs },
          headers: req.headers // Ensure headers are forwarded
        } as Request;
        
        const mockRes: any = {
          json: (data: any) => {
            console.log('  └─ Tool result:', data.status);
            if (data.status === 'error') {
              return res.json({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: data.message || 'Tool execution failed',
                  data: data.data,
                },
                id,
              });
            }
            return res.json({
              jsonrpc: '2.0',
              result: {
                content: [
                  {
                    type: 'text',
                    text: typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2),
                  },
                ],
              },
              id,
            });
          },
          status: () => mockRes,
        };
        return MCPController.mcpRoutes.callTool(mockReq, mockRes);
      }

      // Method not found
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
        id,
      });
    } catch (error: any) {
      console.error('MCP protocol error:', error);
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
        id: id || null,
      });
    }
  }
}

export default MCPController;

