import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config, validateConfig } from './backend/config/environment';
import { testConnection } from './backend/db/connection';

// ROUTERS
import healthRoutes from './backend/routes/health.routes';
import mcpRoutes from './backend/routes/mcp.routes';

// Validate configuration on startup
validateConfig();

const app = express();
const port = config.backend.port;

// CORS configuration
const corsOptions = {
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/mcp', mcpRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Skaftin ⛪, be blessed!');
});

// Test database connection on startup
async function startServer() {
  try {
    console.log('🚀 Starting Skaftin server...');
    console.log(`📡 Backend URL: http://localhost:${port}`);
    console.log(`🌐 Frontend URL: http://localhost:${config.frontend.port}`);
    
    // Test database connection
    console.log('\n🔍 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      console.log('✅ Database connection successful!');
    } else {
      console.log('⚠️  Database connection failed - server will start but database features may not work');
    }
    
    app.listen(port, () => {
      console.log(`\n🎉 Skaftin server running on port: ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/api/health`);
      console.log(`🗄️  Database test: http://localhost:${port}/api/health/db`);
      console.log(`🤖 MCP server: http://localhost:${port}/api/mcp`);
      console.log(`🛠️  MCP tools: http://localhost:${port}/api/mcp/tools`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();