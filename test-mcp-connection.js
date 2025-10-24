#!/usr/bin/env node

/**
 * MCP Connection Test Script
 * Tests the MCP server endpoints
 */

const axios = require('axios');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4005/api/mcp';

async function testMCPConnection() {
  try {
    console.log('🤖 Testing MCP server connection...');
    console.log(`📡 MCP Server URL: ${MCP_SERVER_URL}`);

    // Test MCP server info
    console.log('\n1. Testing MCP server info...');
    const infoResponse = await axios.get(`${MCP_SERVER_URL}/info`);
    console.log('✅ MCP server info:', infoResponse.data);

    // Test MCP tools list
    console.log('\n2. Testing MCP tools list...');
    const toolsResponse = await axios.get(`${MCP_SERVER_URL}/tools`);
    console.log('✅ Available tools:', toolsResponse.data.tools.length);
    console.log('📋 Tools:', toolsResponse.data.tools.map(t => t.name).join(', '));

    // Test MCP health
    console.log('\n3. Testing MCP health...');
    const healthResponse = await axios.get(`${MCP_SERVER_URL}/health`);
    console.log('✅ MCP health:', healthResponse.data);

    // Test a simple tool execution (if database is available)
    console.log('\n4. Testing tool execution...');
    try {
      const executeResponse = await axios.post(`${MCP_SERVER_URL}/tools/execute`, {
        tool: 'search_docs',
        parameters: {
          query: 'database operations',
          category: 'general'
        }
      });
      console.log('✅ Tool execution test:', executeResponse.data);
    } catch (error) {
      console.log('⚠️  Tool execution test failed (expected if no projects exist):', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 MCP server connection test completed successfully!');
    console.log('\n📊 Available MCP endpoints:');
    console.log(`   - Info: ${MCP_SERVER_URL}/info`);
    console.log(`   - Tools: ${MCP_SERVER_URL}/tools`);
    console.log(`   - Health: ${MCP_SERVER_URL}/health`);
    console.log(`   - Execute: ${MCP_SERVER_URL}/tools/execute`);

    return true;

  } catch (error) {
    console.error('\n❌ MCP connection test failed:');
    console.error('Error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Make sure the Skaftin backend server is running');
      console.error('   - Check if the server is running on port 4005');
      console.error('   - Try: npm run dev:backend');
    }
    
    return false;
  }
}

// Run the test
testMCPConnection()
  .then(success => {
    if (success) {
      console.log('\n🎉 MCP connection test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 MCP connection test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
