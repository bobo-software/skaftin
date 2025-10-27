#!/usr/bin/env node

// Test script for MCP server
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

// Test MCP server functionality
async function testMCPServer() {
  console.log('🧪 Testing Skaftin MCP Server...\n');
  
  // Test configuration
  const testConfig = {
    mcpServers: {
      skaftin: {
        command: "node",
        args: ["src/backend/mcp-server.js"],
        env: {
          SKAFTIN_API_KEY: process.env.SKAFTIN_API_KEY || "your-api-key-here",
          DB_HOST: process.env.DB_HOST || "localhost",
          DB_PORT: process.env.DB_PORT || "5432",
          DB_USER: process.env.DB_USER || "postgres",
          DB_PASSWORD: process.env.DB_PASSWORD || "BLUcabish#25",
          DB_NAME: process.env.DB_NAME || "postgres"
        }
      }
    }
  };
  
  // Write test config
  writeFileSync('test-mcp-config.json', JSON.stringify(testConfig, null, 2));
  console.log('✅ Test configuration written to test-mcp-config.json');
  
  // Test MCP server startup
  console.log('\n🚀 Starting MCP server test...');
  
  const serverProcess = spawn('node', ['src/backend/mcp-server.js'], {
    env: {
      ...process.env,
      SKAFTIN_API_KEY: process.env.SKAFTIN_API_KEY || "test-key",
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  serverProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  serverProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  // Test MCP protocol
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };
  
  setTimeout(() => {
    console.log('📡 Sending test request...');
    serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  }, 1000);
  
  setTimeout(() => {
    console.log('\n📊 Test Results:');
    console.log('Output:', output);
    console.log('Errors:', errorOutput);
    
    if (errorOutput.includes('Skaftin MCP Server running')) {
      console.log('✅ MCP Server started successfully!');
    } else {
      console.log('❌ MCP Server failed to start');
    }
    
    serverProcess.kill();
    process.exit(0);
  }, 3000);
}

// Run test
testMCPServer().catch(console.error);
