import { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand, DeleteBucketPolicyCommand } from '@aws-sdk/client-s3';

export type BucketAccessPolicy = 'private' | 'public';

/**
 * Policy that allows public read (GetObject) on all objects in the bucket.
 * Use after creating a bucket so objects are accessible without signed URLs.
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
 * Private policy - no public access (empty policy or deny all)
 */
const PRIVATE_POLICY = () =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [],
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

/**
 * Set private policy on an S3/MinIO bucket (removes public access).
 */
export async function setBucketPrivate(s3Client: S3Client, bucketName: string): Promise<void> {
  try {
    // Try to delete existing policy first
    await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: bucketName }));
  } catch (error: any) {
    // Policy might not exist, that's okay
    if (error.name !== 'NoSuchBucketPolicy') {
      throw error;
    }
  }
}

/**
 * Set bucket access policy (public or private)
 */
export async function setBucketAccessPolicy(
  s3Client: S3Client,
  bucketName: string,
  policy: BucketAccessPolicy
): Promise<void> {
  if (policy === 'public') {
    await setBucketPublicRead(s3Client, bucketName);
  } else {
    await setBucketPrivate(s3Client, bucketName);
  }
}

/**
 * Get current bucket policy
 */
export async function getBucketPolicy(s3Client: S3Client, bucketName: string): Promise<BucketAccessPolicy> {
  try {
    const response = await s3Client.send(
      new GetBucketPolicyCommand({ Bucket: bucketName })
    );
    
    if (response.Policy) {
      const policy = JSON.parse(response.Policy);
      // Check if policy has public read statement
      const hasPublicRead = policy.Statement?.some(
        (stmt: any) => stmt.Principal === '*' && stmt.Action === 's3:GetObject'
      );
      return hasPublicRead ? 'public' : 'private';
    }
    
    return 'private';
  } catch (error: any) {
    // No policy means private
    if (error.name === 'NoSuchBucketPolicy') {
      return 'private';
    }
    throw error;
  }
}
