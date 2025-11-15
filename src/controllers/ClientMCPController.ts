import { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createMCPRoutes } from '../mcp/httpServer';
import { transformHTTPToJSONRPC } from '../mcp/transformers/responseTransformers';

class ClientMCPController {
  private static mcpRoutes: any = null;

  /**
   * Initialize client MCP routes with pool and s3Client
   */
  static initialize(pool: Pool, s3Client: S3Client) {
    // Create client endpoint routes (isClientEndpoint: true)
    this.mcpRoutes = createMCPRoutes({ pool, s3Client, isClientEndpoint: true });
  }

  /**
   * List available client MCP tools
   */
  static async listTools(req: Request, res: Response) {
    if (!ClientMCPController.mcpRoutes) {
      return res.status(500).json({
        status: 'error',
        message: 'Client MCP service not initialized',
      });
    }
    return ClientMCPController.mcpRoutes.listTools(req, res);
  }

  /**
   * Call a client MCP tool
   */
  static async callTool(req: Request, res: Response) {
    if (!ClientMCPController.mcpRoutes) {
      return res.status(500).json({
        status: 'error',
        message: 'Client MCP service not initialized',
      });
    }
    return ClientMCPController.mcpRoutes.callTool(req, res);
  }

  /**
   * MCP Protocol endpoint (JSON-RPC 2.0) for client
   */
  static async mcpProtocolHandler(req: Request, res: Response) {
    if (!ClientMCPController.mcpRoutes) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Client MCP service not initialized',
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
      console.log('🔍 [Client MCP Protocol] Incoming request:');
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
              name: 'skaftin-client-mcp-server',
              version: '1.0.0',
            },
          },
          id,
        });
      }

      // Handle tools/list
      if (method === 'tools/list') {
        const mockReq = { 
          ...req, 
          body: {},
          headers: req.headers
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
        return ClientMCPController.mcpRoutes.listTools(mockReq, mockRes);
      }

      // Handle tools/call
      if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        console.log('🔧 [Client MCP Protocol] Tool call:');
        console.log('  └─ Tool:', toolName);
        console.log('  └─ Args:', JSON.stringify(toolArgs, null, 2));

        const mockReq = { 
          ...req, 
          body: { name: toolName, arguments: toolArgs },
          headers: req.headers
        } as Request;
        
        const mockRes: any = {
          json: (data: any) => {
            console.log('  └─ Tool result:', data.status);
            // Use shared transformer for consistency
            const jsonrpcResponse = transformHTTPToJSONRPC(data, id);
            return res.json(jsonrpcResponse);
          },
          status: () => mockRes,
        };
        return ClientMCPController.mcpRoutes.callTool(mockReq, mockRes);
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
      console.error('Client MCP protocol error:', error);
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

export default ClientMCPController;

