import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
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
import OrganizationsRouter from './routers/OrganizationsRouter';
import MCPController from './controllers/MCPController';
import ClientMCPController from './controllers/ClientMCPController';
import DatabaseController from './controllers/DatabaseController';
import ProjectsController from './controllers/ProjectsController';
import ProjectBucketsController from './controllers/ProjectBucketsController';
import StorageController from './controllers/StorageController';
import GraphQLController from './controllers/GraphQLController';
import CommunicationsController from './controllers/CommunicationsController';
import { WorkflowScheduler } from './services/WorkflowScheduler';

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
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // 10 seconds default
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds for queries
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
// Skip JSON parsing for multipart/form-data requests (handled by multer)
const jsonParser = express.json({ limit: '10mb' });
const urlencodedParser = express.urlencoded({ limit: '10mb', extended: true });

app.use((req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  // Skip body parsing for multipart/form-data (handled by multer)
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  // Skip JSON for POST /app-api/storage/files so multer can parse form-data
  // (some clients or proxies omit Content-Type for FormData)
  if (req.method === 'POST' && req.path === '/app-api/storage/files') {
    return next();
  }
  // Apply JSON parser for other content types
  jsonParser(req, res, next);
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  // Skip body parsing for multipart/form-data (handled by multer)
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  // Skip urlencoded for POST /app-api/storage/files (same as above)
  if (req.method === 'POST' && req.path === '/app-api/storage/files') {
    return next();
  }
  // Apply urlencoded parser for other content types
  urlencodedParser(req, res, next);
});

// ============================================================================
// ROUTERS
// ============================================================================

import { router as AuthCompatibilityRouter } from './routers/AuthCompatibilityRouter';
import { createAdminRouter } from './routers/AdminRouter';
import { router as ProjectsRouter } from './routers/ProjectsRouter';
import { router as ProjectBucketsRouter } from './routers/ProjectBucketsRouter';
import { router as FilesRouter } from './routers/FilesRouter';
import { createStorageRouter } from './routers/StorageRouter';
import { router as UsersRouter } from './routers/UsersRouter';
import { router as HealthRouter } from './routers/HealthRouter';
import { router as MCPRouter } from './routers/MCPRouter';
import { router as ClientMCPRouter } from './routers/ClientMCPRouter';
import { createDatabaseRouter } from './routers/DatabaseRouter';
import { createAdminDatabaseRouter } from './routers/AdminDatabaseRouter';
import { createAdminStorageRouter } from './routers/AdminStorageRouter';
import { createAdminAuthRouter } from './routers/AdminAuthRouter';
import { createCommunicationsRouter } from './routers/CommunicationsRouter';
import { createClientCommunicationsRouter } from './routers/ClientCommunicationsRouter';
import { createInvitationsRouter } from './routers/InvitationsRouter';
import { createPaymentRouter, createClientPaymentRouter, createPaymentWebhookRouter } from './routers/PaymentRouter';
// Credentials routes are now handled by the Go gateway.
// import { createCredentialsRouter } from './routers/CredentialsRouter';
import { createAuthRouter } from './routers/AuthRouter';
import { createAnalyticsRouter } from './routers/AnalyticsRouter';
import { createWorkflowsRouter } from './routers/WorkflowsRouter';
import { router as BackupRouter } from './routers/BackupRouter';
import { createRequestLogsRouter, createClientRequestLogsRouter } from './routers/RequestLogsRouter';
import { createMigrationsRouter } from './routers/MigrationsRouter';
import MigrationsController from './controllers/MigrationsController';
import RequestLogsController from './controllers/RequestLogsController';
import { initRequestLoggingMiddleware, requestLoggingMiddleware } from './middleware/requestLoggingMiddleware';
import BackupController from './controllers/BackupController';
import { BackupScheduler } from './services/BackupScheduler';
import { AccountDeletionService } from './services/AccountDeletionService';
import { RequestLogsCleanupService } from './services/RequestLogsCleanupService';
import { initializeApiKeyMiddleware } from './middleware/apiKeyMiddleware';
import { AnalyticsService } from './services/AnalyticsService';

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
      // Platform Admin Routes (SuperTokens authentication)
      platform: {
        supertokens_auth: '/auth',
        platform_auth: '/api/auth',
        organizations: '/api/organizations',
        projects: '/api/projects',
        files: '/api/files',
        communications: '/api/communications',
        payments: '/api/payments',
        invitations: '/api/invitations',
        credentials: '/api/credentials',
        analytics: '/api/analytics',
        users: '/api/users',
        health: '/api/health',
        mcp: '/api/mcp',
        graphql: '/api/graphql',
      },
      // Client-Facing Routes (API Key / App User JWT authentication)
      app_api: {
        app_user_auth: '/app-api/auth',
        storage: '/app-api/storage',
        database: '/app-api/database',
        communications: '/app-api/communications',
        payments: '/app-api/payments',
        mcp: '/app-api/mcp',
      },
      // Public API Routes (API Key / Access Token only, GET & POST, no user auth required)
      app_api_2: {
        database: '/app-api-2/database',
        storage: '/app-api-2/storage',
      },
    },
  });
});

// Initialize controllers
MCPController.initialize(pool, s3Client);
ClientMCPController.initialize(pool, s3Client);
DatabaseController.initialize(pool);
ProjectsController.initialize(pool);
ProjectBucketsController.initialize(pool);
StorageController.initialize({ pool, s3Client });
BackupController.initialize(pool, s3Client);
MigrationsController.initialize(pool);
RequestLogsController.initialize(pool);
initRequestLoggingMiddleware(pool);

// Initialize API key middleware
initializeApiKeyMiddleware(pool);

// Initialize hybrid auth middleware (for client apps + Skaftin UI)
import { initializeHybridAuthMiddleware } from './middleware/hybridAuthMiddleware';
initializeHybridAuthMiddleware(pool);

// Initialize API key only middleware (for public endpoints)
import { initializeApiKeyOnlyMiddleware } from './middleware/apiKeyOnlyMiddleware';
initializeApiKeyOnlyMiddleware(pool);

// Initialize Communications Controller and create router
const communicationsController = new CommunicationsController(pool);
const CommunicationsRouter = createCommunicationsRouter(pool);

// Initialize Invitations Router
const InvitationsRouter = createInvitationsRouter(pool);

// Credentials routes are now handled by the Go gateway.
// const CredentialsRouter = createCredentialsRouter(pool);

// Initialize Auth Management Router (for app user management)
const AuthManagementRouter = createAuthRouter(pool);

// Initialize Client Communications Router (for app-api routes)
const ClientCommunicationsRouter = createClientCommunicationsRouter(pool);

// Initialize Payment Routers
const PaymentRouter = createPaymentRouter(pool);
const ClientPaymentRouter = createClientPaymentRouter(pool);
const PaymentWebhookRouter = createPaymentWebhookRouter(pool);

// Initialize Public Routers (for app-api-2 routes - API key only, no user auth)
import { createPublicDatabaseRouter } from './routers/PublicDatabaseRouter';
import { createPublicStorageRouter } from './routers/PublicStorageRouter';
const PublicDatabaseRouter = createPublicDatabaseRouter(pool);
const PublicStorageRouter = createPublicStorageRouter(pool);

// Initialize Admin Router (for managing SuperTokens users)
const AdminRouter = createAdminRouter(pool);

// Initialize Analytics Router
const AnalyticsRouter = createAnalyticsRouter(pool);

// Initialize Analytics Service
AnalyticsService.initialize(pool);

// Register routers
// Note: SuperTokens auth routes are automatically registered at /auth by SuperTokens middleware

// ============================================================================
// PLATFORM ADMIN ROUTES (/api/*) - SuperTokens authentication
// ============================================================================
// Auth compatibility layer for Skaftin platform login (keep this at /api/auth for backward compatibility)
app.use('/api/auth', AuthCompatibilityRouter);
// Admin routes for managing SuperTokens users (development/debugging)
app.use('/api/admin', AdminRouter);
// Platform management routes
app.use('/api/organizations', OrganizationsRouter);
app.use('/api/projects', ProjectsRouter);
app.use('/api/projects', ProjectBucketsRouter);
app.use('/api/files', FilesRouter);
app.use('/api/users', UsersRouter);
app.use('/api/communications', CommunicationsRouter);
app.use('/api/invitations', InvitationsRouter);
// app.use('/api/credentials', CredentialsRouter); // Now handled by Go gateway
app.use('/api/analytics', AnalyticsRouter);
app.use('/api/health', HealthRouter);
app.use('/api/mcp', MCPRouter);
app.use('/api/database', createAdminDatabaseRouter(pool));
app.use('/api/storage', createAdminStorageRouter(pool, s3Client));
app.use('/api/auth', createAdminAuthRouter(pool));
app.use('/api/workflows', createWorkflowsRouter(pool));
app.use('/api/backups', BackupRouter);
app.use('/api/payments', PaymentRouter);
app.use('/api/payments/webhook', PaymentWebhookRouter);
app.use('/api/request-logs', createRequestLogsRouter(pool));
app.use('/api/migrations', createMigrationsRouter());

// ============================================================================
// CLIENT-FACING ROUTES (/app-api/*) - API Key / App User JWT authentication
// ============================================================================
// Apply request logging middleware to all client-facing routes
// This automatically logs requests for projects with logging enabled
app.use('/app-api', requestLoggingMiddleware);

// SuperTokens middleware for app users at /app-api/auth (for session/refresh endpoints)
// This allows SuperTokens SDK to call /app-api/auth/session/refresh
app.use('/app-api/auth', (req, res, next) => {
  // Only handle SuperTokens routes (session, signin, signup, etc.)
  if (req.path.startsWith('/session/') ||
    req.path === '/signin' ||
    req.path === '/signup' ||
    req.path === '/signout' ||
    req.path.startsWith('/user/') ||
    req.path === '/emailpassword/signin' ||
    req.path === '/emailpassword/signup') {
    // Proxy to SuperTokens middleware
    return supertokensMiddleware()(req, res, next);
  }
  // Otherwise, pass to our auth router
  next();
});
// Auth management routes for application users (project-specific)
app.use('/app-api/auth', AuthManagementRouter);
// Storage operations (supports both API key and SuperTokens via hybrid auth)
app.use('/app-api/storage', createStorageRouter(pool));
// Database operations (supports both API key and SuperTokens via hybrid auth)
app.use('/app-api/database', createDatabaseRouter(pool));
// Communications operations (supports both API key and SuperTokens via hybrid auth)
app.use('/app-api/communications', ClientCommunicationsRouter);
// Payment operations (supports both API key and SuperTokens via hybrid auth)
app.use('/app-api/payments', ClientPaymentRouter);
// Request logging operations (supports both API key and SuperTokens via hybrid auth)
app.use('/app-api/request-logs', createClientRequestLogsRouter(pool));
// Client MCP operations (restricted tool set, MCP keys/API keys only)
app.use('/app-api/mcp', ClientMCPRouter);

// ============================================================================
// PUBLIC API ROUTES (/app-api-2/*) - API Key / Access Token only (no user auth)
// ============================================================================
console.log('🔓 [Server] Registering public API routes at /app-api-2');
// Apply request logging middleware to public API routes as well
app.use('/app-api-2', requestLoggingMiddleware);
// Public database operations (GET & POST only, API key/access token required)
app.use('/app-api-2/database', PublicDatabaseRouter);
// Public storage operations (GET & POST only, API key/access token required)
app.use('/app-api-2/storage', PublicStorageRouter);
console.log('✅ [Server] Public API routes registered');

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

  // Initialize Workflow Scheduler (singleton)
  console.log('⏰ Initializing workflow scheduler...');
  const workflowScheduler = WorkflowScheduler.initialize(pool);
  await workflowScheduler.loadScheduledWorkflows();

  // Initialize Backup Scheduler (singleton)
  console.log('📦 Initializing backup scheduler...');
  const backupScheduler = BackupScheduler.initialize(pool, s3Client);
  await backupScheduler.loadScheduledBackups();

  // Initialize Account Deletion Service (runs daily at 2 AM)
  console.log('🗑️  Initializing account deletion service...');
  const accountDeletionService = new AccountDeletionService(pool);
  const cron = require('node-cron');

  // Schedule daily deletion processing at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🗑️  [CRON] Running scheduled account deletion processing...');
    try {
      const result = await accountDeletionService.processPendingDeletions();
      console.log(`✅ [CRON] Account deletion completed: ${result.processed} processed, ${result.errors} errors`);
    } catch (error) {
      console.error('❌ [CRON] Error processing account deletions:', error);
    }
  });
  console.log('✅ Account deletion service scheduled (daily at 2 AM)');

  // Initialize Request Logs Cleanup Service (runs daily at 3 AM)
  console.log('🧹 Initializing request logs cleanup service...');
  const requestLogsCleanupService = new RequestLogsCleanupService(pool);

  // Schedule daily request logs cleanup at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 [CRON] Running scheduled request logs cleanup...');
    try {
      const result = await requestLogsCleanupService.cleanupAllProjects();
      console.log(`✅ [CRON] Request logs cleanup completed: ${result.processed} projects, ${result.deleted} logs deleted, ${result.errors} errors`);
    } catch (error) {
      console.error('❌ [CRON] Error during request logs cleanup:', error);
    }
  });
  console.log('✅ Request logs cleanup service scheduled (daily at 3 AM)');

  // Handle graceful shutdown
  const gracefulShutdown = () => {
    console.log('\n🛑 Shutting down gracefully...');
    workflowScheduler.stopAll();
    backupScheduler.stopAll();
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server
  httpServer.listen(port, () => {
    console.log('='.repeat(60));
    console.log(`✅ Skaftin Platform server is running!`);
    console.log(`🌐 Server URL: http://localhost:${port}`);
    console.log('\n📡 Platform Admin API (SuperTokens):');
    console.log(`   🔐 Auth: http://localhost:${port}/api/auth`);
    console.log(`   📁 Projects: http://localhost:${port}/api/projects`);
    console.log(`   📄 Files: http://localhost:${port}/api/files`);
    console.log(`   🔧 MCP: http://localhost:${port}/api/mcp`);
    console.log(`   🔬 GraphQL: http://localhost:${port}/api/graphql`);
    console.log('\n📱 Client-Facing API (API Key / App User JWT):');
    console.log(`   🔐 App Auth: http://localhost:${port}/app-api/auth`);
    console.log(`   💾 Storage: http://localhost:${port}/app-api/storage`);
    console.log(`   🗄️  Database: http://localhost:${port}/app-api/database`);
    console.log(`   🔧 MCP: http://localhost:${port}/app-api/mcp`);
    console.log('\n🌍 Public API (API Key / Access Token only, GET & POST):');
    console.log(`   💾 Storage: http://localhost:${port}/app-api-2/storage`);
    console.log(`   🗄️  Database: http://localhost:${port}/app-api-2/database`);
    console.log(`\n🔌 WebSocket: ws://localhost:${port}`);
    console.log('='.repeat(60) + '\n');
  });
};

// Start the server
startServer().catch((err) => {
  console.error('\n❌ Failed to start server:', err);
  process.exit(1);
});
