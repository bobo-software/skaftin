import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import supertokens from "supertokens-node";
import { middleware as supertokensMiddleware, errorHandler as supertokensErrorHandler } from "supertokens-node/framework/express";
import { initSuperTokens } from './config/supertokens';
import { initializeWebSocketService } from './services/WebSocketService';
import { DatabaseInitializer } from './services/DatabaseInitializer';
import { HealthCheckService } from './services/HealthCheckService';

// Load environment variables
dotenv.config();

// Initialize SuperTokens
initSuperTokens();

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);
const port = process.env.BACKEND_PORT || process.env.PORT || 4006;

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Make pool available to routers via app.locals
app.locals.pool = pool;

// Database event handlers
pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// ============================================================================
// MINIO/S3 CONFIGURATION
// ============================================================================

const accessKeyId = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;
const endpoint = process.env.MINIO_SERVER_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  throw new Error('MinIO credentials are not properly configured');
}

// Ensure endpoint has protocol
let minioEndpoint = endpoint;
if (!minioEndpoint.startsWith('http://') && !minioEndpoint.startsWith('https://')) {
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  minioEndpoint = useSSL ? `https://${endpoint}` : `http://${endpoint}`;
}

const s3Client = new S3Client({
  endpoint: minioEndpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
  tls: process.env.MINIO_USE_SSL === 'true' || minioEndpoint.startsWith('https://'),
});


// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// CORS - SuperTokens requires specific CORS configuration
// Support both development and production URLs
const allowedOrigins = [
  process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005",
  process.env.FRONTEND_URL || "http://localhost:3005",
];

// Remove duplicates and filter out empty values
const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];

app.use(
  cors({
    origin: uniqueOrigins,
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
  })
);

// SuperTokens middleware - MUST come before your routes
app.use(supertokensMiddleware());

app.use(bodyParser.json());

// ============================================================================
// ROUTERS
// ============================================================================

import { router as AuthRouter } from './routers/AuthRouter';
import { router as AuthCompatibilityRouter } from './routers/AuthCompatibilityRouter';
import { router as ProjectsRouter } from './routers/ProjectsRouter';
import { router as FilesRouter } from './routers/FilesRouter';
import { router as StorageRouter } from './routers/StorageRouter';
import { router as UsersRouter } from './routers/UsersRouter';
import { router as HealthRouter } from './routers/HealthRouter';
import { router as MCPRouter } from './routers/MCPRouter';
import { router as DatabaseRouter } from './routers/DatabaseRouter';
import MCPController from './controllers/MCPController';
import DatabaseController from './controllers/DatabaseController';
import StorageController from './controllers/StorageController';

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================
// All initialization logic is now in dedicated service classes:
// - DatabaseInitializer: Database table creation
// - MinIOInitializer: MinIO bucket setup
// - HealthCheckService: Health checks

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Skaftin Platform API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      files: '/api/files',
      storage: '/api/storage',
      database: '/api/database',
      users: '/api/users',
      health: '/api/health',
      mcp: '/api/mcp',
    },
  });
});

// Initialize controllers
MCPController.initialize(pool, s3Client);
DatabaseController.initialize(pool);
StorageController.initialize({ pool, s3Client });

// Register routers
// Note: SuperTokens auth routes are automatically registered at /auth by SuperTokens middleware
// Auth compatibility layer for old frontend routes
app.use('/api/auth', AuthCompatibilityRouter);
app.use('/api/projects', ProjectsRouter);
app.use('/api/files', FilesRouter);
app.use('/api/storage', StorageRouter);
app.use('/api/users', UsersRouter);
app.use('/api/database', DatabaseRouter);
app.use('/api/health', HealthRouter);
app.use('/api/mcp', MCPRouter);

// SuperTokens error handler - MUST come after your routes
app.use(supertokensErrorHandler() as ErrorRequestHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀  SKAFTIN PLATFORM - Starting Server');
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Server Port: ${port}`);
  console.log(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
  console.log(`📦 MinIO: ${minioEndpoint}`);
  console.log('='.repeat(60) + '\n');

  // Initialize database tables (only once on startup, in public schema)
  console.log('🗄️  Initializing database tables...');
  const dbInitializer = new DatabaseInitializer(pool);
  await dbInitializer.initializeAllTables();

  // Perform health checks
  const BUCKET_NAME = process.env.MINIO_BUCKET || 'skaftin';
  const healthCheck = new HealthCheckService(pool, s3Client, BUCKET_NAME, minioEndpoint);
  await healthCheck.performHealthChecks();

  // Initialize WebSocket service
  initializeWebSocketService(httpServer);

  // Start server
  httpServer.listen(port, () => {
    console.log('='.repeat(60));
    console.log(`✅ Skaftin Platform server is running!`);
    console.log(`🌐 Server URL: http://localhost:${port}`);
    console.log(`📡 API Base: http://localhost:${port}/api`);
    console.log(`🔐 Auth: http://localhost:${port}/api/auth`);
    console.log(`📁 Projects: http://localhost:${port}/api/projects`);
    console.log(`📄 Files: http://localhost:${port}/api/files`);
    console.log(`🔧 MCP: http://localhost:${port}/api/mcp`);
    console.log(`🔌 WebSocket: ws://localhost:${port}`);
    console.log('='.repeat(60) + '\n');
  });
};

// Start the server
startServer().catch((err) => {
  console.error('\n❌ Failed to start server:', err);
  process.exit(1);
});
