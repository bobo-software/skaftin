import { Router, Request, Response } from 'express';
import Session from 'supertokens-node/recipe/session';
import { MCPService } from '../services/mcp.service';
import SocketService from '../services/socket.service';

const router = Router();
let mcpService: MCPService;

// Initialize MCP service with Socket.IO support
export const initializeMCPService = (socketService?: SocketService) => {
  try {
    mcpService = new MCPService(socketService);
    console.log('✅ MCP Service initialized successfully with Socket.IO support');
  } catch (error) {
    console.error('❌ Failed to initialize MCP Service:', error);
  }
};

// Initialize without Socket.IO for now (will be updated when Socket.IO is available)
try {
  mcpService = new MCPService();
  console.log('✅ MCP Service initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize MCP Service:', error);
}

// Simple test endpoint
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Skaftin MCP Server is running',
    timestamp: new Date().toISOString()
  });
});

// DEBUG: Development-only endpoint without authentication
// TODO: Remove this in production
router.post('/tools/debug-execute', async (req: Request, res: Response) => {
  try {
    const { tool, parameters, projectId } = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    console.log(`🔧 [DEBUG] Executing MCP tool: ${tool} (NO AUTH)`);
    console.log(`📊 Parameters:`, parameters);

    // Execute without authentication check
    const result = await mcpService.executeTool(tool, parameters, projectId, 'debug-user');

    res.json({
      success: true,
      tool,
      result,
      debug: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MCP tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tool: req.body.tool
    });
  }
});

// MCP Tool execution endpoint
router.post('/tools/execute', async (req: Request, res: Response) => {
  try {
    const { tool, parameters, projectId } = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    // Get user ID from SuperTokens session (skip in development)
    let userId: string | undefined;
    const isDevelopment = process.env.ENVIRONMENT === 'development';
    
    if (!isDevelopment) {
      try {
        const session = await Session.getSession(req, res);
        userId = session.getUserId();
        console.log(`👤 User ID from session: ${userId}`);
      } catch (error) {
        console.error('❌ Failed to get session:', error);
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
    } else {
      // Development mode: use debug user
      userId = 'debug-user';
      console.log(`🔧 [DEV MODE] Skipping authentication check`);
    }

    console.log(`🔧 Executing MCP tool: ${tool} for user: ${userId}`);
    console.log(`📊 Parameters:`, parameters);

    // Pass userId to the MCP service
    const result = await mcpService.executeTool(tool, parameters, projectId, userId);

    res.json({
      success: true,
      tool,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MCP tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tool: req.body.tool
    });
  }
});

// List available MCP tools
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const tools = await mcpService.listTools();
    
    res.json({
      success: true,
      tools,
      count: tools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error listing MCP tools:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get tool documentation
router.get('/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const documentation = await mcpService.getToolDocumentation(toolName);
    
    if (!documentation) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`
      });
    }

    res.json({
      success: true,
      tool: toolName,
      documentation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting tool documentation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// MCP server info
router.get('/info', async (req: Request, res: Response) => {
  try {
    const info = {
      name: 'Skaftin MCP Server',
      version: '1.0.0',
      description: 'MCP server for Skaftin platform database and storage operations',
      capabilities: [
        'database_operations',
        'storage_operations',
        'project_management',
        'sql_execution',
        'schema_management'
      ],
      tools: await mcpService.listTools(),
      endpoints: {
        execute: '/api/mcp/tools/execute',
        list: '/api/mcp/tools',
        info: '/api/mcp/info'
      }
    };

    res.json({
      success: true,
      info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting MCP info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for MCP server
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await mcpService.checkHealth();
    
    res.json({
      success: true,
      status: 'healthy',
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('MCP health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
