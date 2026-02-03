/**
 * Delete a MinIO bucket by name (including all objects). Use for buckets not linked to a project.
 * Run: npx tsx scripts/delete-minio-bucket.ts <bucket-name>
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const bucketName = process.argv[2];
  if (!bucketName) {
    console.error('Usage: npx tsx scripts/delete-minio-bucket.ts <bucket-name>');
    process.exit(1);
  }

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

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket "${bucketName}" does not exist.`);
      return;
    }
    throw err;
  }

  let continuationToken: string | undefined;
  let totalDeleted = 0;
  do {
    const list = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));
    const keys = (list.Contents || []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
    if (keys.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: keys },
      }));
      totalDeleted += keys.length;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  if (totalDeleted > 0) {
    console.log(`Deleted ${totalDeleted} object(s) from bucket "${bucketName}".`);
  }

  await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  console.log(`Bucket "${bucketName}" deleted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
