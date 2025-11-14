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

// CORS Configuration
// For SuperTokens (Skaftin UI) - use specific origins
// For API clients - allow all origins with API key authentication
const allowedOrigins = [
  process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005",
  process.env.FRONTEND_URL || "http://localhost:3005",
];

// Add client app origins from environment (comma-separated)
if (process.env.CLIENT_ALLOWED_ORIGINS) {
  const clientOrigins = process.env.CLIENT_ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...clientOrigins);
}

// Remove duplicates and filter out empty values
const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow Skaftin UI origins (for SuperTokens with credentials)
      if (uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow other origins for API key authenticated requests
      // API key middleware will validate authentication
      return callback(null, true);
    },
    allowedHeaders: [
      "content-type",
      "x-api-key",
      "x-access-token", 
      "x-project-id",
      "authorization",
      ...supertokens.getAllCORSHeaders()
    ],
    credentials: true,
    exposedHeaders: ["content-disposition"], // For file downloads
  })
);

// SuperTokens middleware - MUST come before your routes
app.use(supertokensMiddleware());

// Body parser with increased size limit for file uploads
// Base64 encoding increases file size by ~33%, so 10MB limit allows ~7.5MB original files
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// ============================================================================
// ROUTERS
// ============================================================================

import { router as AuthCompatibilityRouter } from './routers/AuthCompatibilityRouter';
import { createAdminRouter } from './routers/AdminRouter';
import { router as ProjectsRouter } from './routers/ProjectsRouter';
import { router as FilesRouter } from './routers/FilesRouter';
import { router as StorageRouter } from './routers/StorageRouter';
import { router as UsersRouter } from './routers/UsersRouter';
import { router as HealthRouter } from './routers/HealthRouter';
import { router as MCPRouter } from './routers/MCPRouter';
import { router as DatabaseRouter } from './routers/DatabaseRouter';
import { createCommunicationsRouter } from './routers/CommunicationsRouter';
import { createInvitationsRouter } from './routers/InvitationsRouter';
import { createCredentialsRouter } from './routers/CredentialsRouter';
import { createAuthRouter } from './routers/AuthRouter';
import OrganizationsRouter from './routers/OrganizationsRouter';
import MCPController from './controllers/MCPController';
import DatabaseController from './controllers/DatabaseController';
import ProjectsController from './controllers/ProjectsController';
import StorageController from './controllers/StorageController';
import GraphQLController from './controllers/GraphQLController';
import CommunicationsController from './controllers/CommunicationsController';
import { initializeApiKeyMiddleware } from './middleware/apiKeyMiddleware';

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
      supertokens_auth: '/auth',
      platform_auth: '/api/auth',
      app_user_management: '/api/app-auth/:projectId',
      organizations: '/api/organizations',
      projects: '/api/projects',
      files: '/api/files',
      storage: '/api/storage',
      database: '/api/database',
      communications: '/api/communications',
      invitations: '/api/invitations',
      credentials: '/api/credentials',
      users: '/api/users',
      health: '/api/health',
      mcp: '/api/mcp',
      graphql: '/api/graphql',
    },
  });
});

// Initialize controllers
MCPController.initialize(pool, s3Client);
DatabaseController.initialize(pool);
ProjectsController.initialize(pool);
StorageController.initialize({ pool, s3Client });

// Initialize API key middleware
initializeApiKeyMiddleware(pool);

// Initialize hybrid auth middleware (for client apps + Skaftin UI)
import { initializeHybridAuthMiddleware } from './middleware/hybridAuthMiddleware';
initializeHybridAuthMiddleware(pool);

// Initialize Communications Controller and create router
const communicationsController = new CommunicationsController(pool);
const CommunicationsRouter = createCommunicationsRouter(pool);

// Initialize Invitations Router
const InvitationsRouter = createInvitationsRouter(pool);

// Initialize Credentials Router
const CredentialsRouter = createCredentialsRouter(pool);

// Initialize Auth Management Router (for app user management)
const AuthManagementRouter = createAuthRouter(pool);

// Initialize Admin Router (for managing SuperTokens users)
const AdminRouter = createAdminRouter(pool);

// Register routers
// Note: SuperTokens auth routes are automatically registered at /auth by SuperTokens middleware
// Auth compatibility layer for Skaftin platform login (keep this at /api/auth for backward compatibility)
app.use('/api/auth', AuthCompatibilityRouter);
// Admin routes for managing SuperTokens users (development/debugging)
app.use('/api/admin', AdminRouter);
// Auth management routes for application users (project-specific)
app.use('/api/app-auth', AuthManagementRouter);
app.use('/api/organizations', OrganizationsRouter);
app.use('/api/projects', ProjectsRouter);
app.use('/api/files', FilesRouter);
app.use('/api/storage', StorageRouter);
app.use('/api/users', UsersRouter);
app.use('/api/database', DatabaseRouter);
app.use('/api/communications', CommunicationsRouter);
app.use('/api/invitations', InvitationsRouter);
app.use('/api/credentials', CredentialsRouter);
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

  // Initialize GraphQL server
  console.log('🔧 Initializing GraphQL server...');
  await GraphQLController.initialize(pool, app);

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
    console.log(`🔬 GraphQL: http://localhost:${port}/api/graphql`);
    console.log(`🔌 WebSocket: ws://localhost:${port}`);
    console.log('='.repeat(60) + '\n');
  });
};

// Start the server
startServer().catch((err) => {
  console.error('\n❌ Failed to start server:', err);
  process.exit(1);
});
