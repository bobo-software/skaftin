const ApiRoutes = {
  // Authentication routes
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  
  // MCP routes
  MCP: {
    EXECUTE: '/api/mcp/tools/execute',
    TOOLS: '/api/mcp/tools',
    INFO: '/api/mcp/info',
    HEALTH: '/api/mcp/health',
  },
  
  // Health routes
  HEALTH: {
    SERVER: '/api/health',
    DATABASE: '/api/health/db',
  }
}

export default ApiRoutes;