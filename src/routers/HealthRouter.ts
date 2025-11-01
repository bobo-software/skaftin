import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import ResponseUtils from '../utils/ResponseUtils';

const router = express.Router();

// Initialize S3 client for MinIO
const s3Client = new S3Client({
  endpoint: process.env.MINIO_SERVER_URL || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || '',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'skaftin';

/**
 * Main health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = (req.app.locals as any).pool as Pool;
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    // Test MinIO connection
    let bucketExists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      bucketExists = true;
    } catch (err) {
      // Bucket doesn't exist or connection failed
    }

    res.json({
      status: 'healthy',
      database: 'connected',
      minio: bucketExists ? 'connected' : 'disconnected',
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      minio: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Database test endpoint
 */
router.get('/db', async (req: Request, res: Response) => {
  try {
    const pool = (req.app.locals as any).pool as Pool;
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();

    ResponseUtils.success(res, 'Database connection successful', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].version,
    });
  } catch (error) {
    console.error('Database test error:', error);
    ResponseUtils.error(res, 'Database connection failed', error);
  }
});

/**
 * MinIO test endpoint
 */
router.get('/minio', async (req: Request, res: Response) => {
  try {
    const minioEndpoint = process.env.MINIO_SERVER_URL || 'http://localhost:9000';
    
    let bucketExists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      bucketExists = true;
    } catch (err: any) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
        throw err;
      }
    }

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    const fileCount = response.Contents?.length || 0;

    ResponseUtils.success(res, 'MinIO connection successful', {
      bucketExists,
      bucketName: BUCKET_NAME,
      fileCount,
      endpoint: minioEndpoint,
    });
  } catch (error) {
    console.error('MinIO test error:', error);
    ResponseUtils.error(res, 'MinIO connection failed', error);
  }
});

export { router };

