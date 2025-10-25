#!/usr/bin/env node

/**
 * Skaftin MCP Server for Cursor
 * Implements the Model Context Protocol for Cursor integration
 */

const axios = require('axios');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4005/api/mcp';

// MCP Protocol Implementation
class SkaftinMCPServer {
  constructor() {
    this.serverUrl = MCP_SERVER_URL;
    this.tools = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      console.error('🤖 Initializing Skaftin MCP Server...');
      
      // Get available tools from the server
      const response = await axios.get(`${this.serverUrl}/tools`);
      this.tools = response.data.tools;
      this.initialized = true;
      
      console.error(`✅ Connected to Skaftin MCP Server`);
      console.error(`📊 Available tools: ${this.tools.length}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MCP server:', error.message);
      return false;
    }
  }

  async listTools() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.tools;
  }

  async executeTool(toolName, parameters, projectId) {
    try {
      const response = await axios.post(`${this.serverUrl}/tools/execute`, {
        tool: toolName,
        parameters,
        projectId
      });
      
      return response.data;
    } catch (error) {
      console.error(`❌ Tool execution failed for ${toolName}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

// Create MCP server instance
const mcpServer = new SkaftinMCPServer();

// Handle MCP protocol messages
process.stdin.on('data', async (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    switch (message.method) {
      case 'initialize':
        await mcpServer.initialize();
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'skaftin',
              version: '1.0.0'
            }
          }
        }) + '\n');
        break;
        
      case 'tools/list':
        const tools = await mcpServer.listTools();
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: {
                type: 'object',
                properties: tool.parameters.reduce((props, param) => {
                  props[param.name] = {
                    type: param.type,
                    description: param.description
                  };
                  return props;
                }, {}),
                required: tool.parameters.filter(p => p.required).map(p => p.name)
              }
            }))
          }
        }) + '\n');
        break;
        
      case 'tools/call':
        const result = await mcpServer.executeTool(
          message.params.name,
          message.params.arguments,
          message.params.projectId
        );
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        }) + '\n');
        break;
        
      default:
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`
          }
        }) + '\n');
    }
  } catch (error) {
    console.error('MCP Server Error:', error);
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    }) + '\n');
  }
});

// Initialize the server
mcpServer.initialize().then(success => {
  if (success) {
    console.error('🎉 Skaftin MCP Server is ready for Cursor!');
  } else {
    console.error('💥 Failed to initialize MCP server');
    process.exit(1);
  }
});
