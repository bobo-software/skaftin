/**
 * One-off script: set public read policy on all MinIO buckets in skaftin_system_project_buckets.
 * Run: npx tsx scripts/set-minio-buckets-public.ts
 */
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import { setBucketPublicRead } from '../src/utils/s3BucketPolicy';

dotenv.config();

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
  });

  const endpoint = process.env.MINIO_SERVER_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  let minioEndpoint = endpoint;
  if (!minioEndpoint.startsWith('http://') && !minioEndpoint.startsWith('https://')) {
    minioEndpoint = process.env.MINIO_USE_SSL === 'true' ? `https://${endpoint}` : `http://${endpoint}`;
  }

  const s3Client = new S3Client({
    endpoint: minioEndpoint,
    region: process.env.MINIO_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || '',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT DISTINCT bucket_name FROM skaftin_system_project_buckets ORDER BY bucket_name'
    );
    const buckets = result.rows.map((r: { bucket_name: string }) => r.bucket_name);
    if (buckets.length === 0) {
      console.log('No buckets found in skaftin_system_project_buckets.');
      return;
    }
    console.log(`Found ${buckets.length} bucket(s): ${buckets.join(', ')}`);
    for (const bucketName of buckets) {
      try {
        await setBucketPublicRead(s3Client, bucketName);
        console.log(`  ✓ ${bucketName}`);
      } catch (err: any) {
        console.warn(`  ✗ ${bucketName}: ${err?.message || err}`);
      }
    }
    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
