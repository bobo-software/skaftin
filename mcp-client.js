#!/usr/bin/env node

/**
 * Skaftin MCP Client
 * This client connects to the Skaftin MCP server and provides tools to AI assistants
 */

const axios = require('axios');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4005/api/mcp';

class SkaftinMCPClient {
  constructor() {
    this.serverUrl = MCP_SERVER_URL;
    this.tools = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🤖 Initializing Skaftin MCP Client...');
      
      // Get available tools
      const response = await axios.get(`${this.serverUrl}/tools`);
      this.tools = response.data.tools;
      this.initialized = true;
      
      console.log(`✅ Connected to Skaftin MCP Server`);
      console.log(`📊 Available tools: ${this.tools.length}`);
      
      // Return tools in MCP format for AI consumption
      return this.tools;
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', error.message);
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

  async getToolDocumentation(toolName) {
    try {
      const response = await axios.get(`${this.serverUrl}/tools/${toolName}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get documentation for ${toolName}:`, error.message);
      return null;
    }
  }

  async getServerInfo() {
    try {
      const response = await axios.get(`${this.serverUrl}/info`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get server info:', error.message);
      return null;
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.serverUrl}/health`);
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Export for use as MCP client
module.exports = SkaftinMCPClient;

// MCP Protocol Handler for Cursor
async function handleMCPRequest(request) {
  const client = new SkaftinMCPClient();
  
  try {
    switch (request.method) {
      case 'tools/list':
        const tools = await client.listTools();
        return {
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
        };
        
      case 'tools/call':
        const result = await client.executeTool(
          request.params.name,
          request.params.arguments,
          request.params.projectId
        );
        return { content: result };
        
      default:
        return { error: `Unknown method: ${request.method}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

// If run directly, show available tools
if (require.main === module) {
  const client = new SkaftinMCPClient();
  
  client.initialize().then(success => {
    if (success) {
      console.log('\n🛠️  Available Skaftin MCP Tools:');
      client.tools.forEach((tool, index) => {
        console.log(`${index + 1}. ${tool.name} (${tool.category})`);
        console.log(`   ${tool.description}`);
        console.log(`   Parameters: ${tool.parameters.map(p => p.name).join(', ')}`);
        console.log('');
      });
      
      console.log('🎉 Skaftin MCP Client is ready for AI integration!');
    } else {
      console.log('💥 Failed to initialize MCP client');
      process.exit(1);
    }
  });
}

