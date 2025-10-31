#!/usr/bin/env node

/**
 * Standalone MCP Server for Cursor IDE
 * This server uses stdio transport to communicate with MCP clients
 */

import { MCPServer } from './mcp/MCPServer';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection pool
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

// MinIO/S3 client configuration
const accessKeyId = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;
const endpoint = process.env.MINIO_SERVER_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('MinIO credentials are not properly configured');
  process.exit(1);
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
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
  tls: process.env.MINIO_USE_SSL === 'true' || minioEndpoint.startsWith('https://'),
});

// Create and start MCP server
const mcpServer = new MCPServer({
  pool,
  s3Client,
});

// Start the server
mcpServer.start().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

