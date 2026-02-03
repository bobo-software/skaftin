import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

/**
 * Policy that allows public read (GetObject) on all objects in the bucket.
 * Use after creating a bucket so objects remain accessible without signed URLs.
 */
const PUBLIC_READ_POLICY = (bucketName: string) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  });

/**
 * Set public read policy on an S3/MinIO bucket so objects are accessible without authentication.
 * Call this after creating a bucket to avoid objects becoming inaccessible.
 */
export async function setBucketPublicRead(s3Client: S3Client, bucketName: string): Promise<void> {
  await s3Client.send(
    new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: PUBLIC_READ_POLICY(bucketName),
    })
  );
}
