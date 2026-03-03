import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { DatabaseInitializer } from './services/DatabaseInitializer';
import { HealthCheckService } from './services/HealthCheckService';
import { WorkflowScheduler } from './services/WorkflowScheduler';

// Load environment variables
dotenv.config();

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
      "rid",
      "fdi-version",
      "st-auth-mode",
      "anti-csrf",
    ],
    credentials: true,
    exposedHeaders: ["content-disposition"], // For file downloads
  })
);

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
  // Apply JSON parser for other content types
  jsonParser(req, res, next);
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  // Skip body parsing for multipart/form-data (handled by multer)
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  // Apply urlencoded parser for other content types
  urlencodedParser(req, res, next);
});

// Platform API routing is handled by the Go gateway.
// Backups are now handled by the Go gateway.

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
        supertokens_auth: '/auth (Go gateway)',
        platform_auth: '/api/auth (Go gateway)',
        organizations: '/api/organizations (Go gateway)',
        projects: '/api/projects (Go gateway)',
        files: '/api/files (Go gateway)',
        communications: '/api/communications (Go gateway)',
        payments: '/api/payments (Go gateway)',
        invitations: '/api/invitations (Go gateway)',
        credentials: '/api/credentials (Go gateway)',
        analytics: '/api/analytics (Go gateway)',
        users: '/api/users (Go gateway)',
        health: '/api/health (Go gateway)',
        graphql: '/api/graphql',
      },
      // Client-Facing Routes (API Key / App User JWT authentication)
      app_api: {
        app_user_auth: '/app-api/auth',
        storage: '/app-api/storage (Go gateway)',
        database: '/app-api/database (Go gateway)',
        communications: '/app-api/communications (Go gateway)',
        payments: '/app-api/payments (Go gateway)',
      },
      // Public API Routes (API Key / Access Token only, GET & POST, no user auth required)
      app_api_2: {
        database: '/app-api-2/database (Go gateway)',
        storage: '/app-api-2/storage (Go gateway)',
      },
    },
  });
});

// Platform and client API routes are handled by the Go gateway.

// Client-facing app-api and app-api-2 routes are handled by the Go gateway.

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

  // Initialize Workflow Scheduler (singleton)
  console.log('⏰ Initializing workflow scheduler...');
  const workflowScheduler = WorkflowScheduler.initialize(pool);
  await workflowScheduler.loadScheduledWorkflows();

  // Account deletion and request-log cleanup schedulers are now handled by the Go gateway.

  // Handle graceful shutdown
  const gracefulShutdown = () => {
    console.log('\n🛑 Shutting down gracefully...');
    workflowScheduler.stopAll();
    // backupScheduler.stopAll(); // Now handled by Go gateway
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
    console.log('\n🧩 Node compatibility endpoints:');
    console.log(`   🔐 SuperTokens: http://localhost:${port}/auth`);
    console.log('='.repeat(60) + '\n');
  });
};

// Start the server
startServer().catch((err) => {
  console.error('\n❌ Failed to start server:', err);
  process.exit(1);
});
