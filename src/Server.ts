import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config, validateConfig } from './backend/config/environment';
import { testConnection } from './backend/db/connection';

// SuperTokens imports
import supertokens from "supertokens-node";
import { middleware, errorHandler } from "supertokens-node/framework/express";
import { SuperTokensConfig } from "./backend/config/supertokens";

// ROUTERS
import healthRoutes from './backend/routes/health.routes';
import mcpRoutes, { initializeMCPService } from './backend/routes/mcp.routes';
import authRoutes from './backend/routes/auth.routes';

// SERVICES
import SocketService from './backend/services/socket.service';

// Validate configuration on startup
validateConfig();

// Initialize SuperTokens
supertokens.init(SuperTokensConfig);

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    credentials: config.cors.credentials,
  },
});
const port = config.backend.port;

// CORS configuration
const corsOptions = {
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Add SuperTokens middleware BEFORE routes
app.use(middleware());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/auth', authRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Join project-specific rooms
  socket.on('join-project', (projectId: string) => {
    socket.join(`project-${projectId}`);
    console.log(`📁 Client ${socket.id} joined project: ${projectId}`);
  });
  
  // Leave project rooms
  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project-${projectId}`);
    console.log(`📁 Client ${socket.id} left project: ${projectId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Initialize Socket.IO service
const socketService = new SocketService(io);

// Initialize MCP service with Socket.IO support
initializeMCPService(socketService);

// Export io instance for use in other modules
export { io };

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Skaftin ⛪, be blessed!');
});

// Special endpoint for large SQL dumps
app.post('/api/parse-sql', (req: Request, res: Response) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: 'SQL content is required' });
    }
    
    // For now, just return success - the parsing will be done on the frontend
    res.json({ 
      success: true, 
      message: 'SQL received successfully',
      length: sql.length 
    });
  } catch (error) {
    console.error('Error parsing SQL:', error);
    res.status(500).json({ error: 'Failed to parse SQL' });
  }
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
    
    server.listen(port, () => {
      console.log(`\n🎉 Skaftin server running on port: ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/api/health`);
      console.log(`🗄️  Database test: http://localhost:${port}/api/health/db`);
      console.log(`🤖 MCP server: http://localhost:${port}/api/mcp`);
      console.log(`🛠️  MCP tools: http://localhost:${port}/api/mcp/tools`);
      console.log(`🔌 WebSocket server: ws://localhost:${port}`);
      console.log(`🔐 SuperTokens: http://localhost:3567`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Error handler (should be last)
app.use(errorHandler());