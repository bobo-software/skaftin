import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { setBucketPublicRead } from '../utils/s3BucketPolicy';

/**
 * MinIOInitializer - Handles MinIO bucket initialization
 */
export class MinIOInitializer {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(s3Client: S3Client, bucketName: string) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  /**
   * Initialize MinIO bucket (create if doesn't exist)
   */
  async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
        console.log(`✅ MinIO bucket already exists: ${this.bucketName}`);
      } catch (err: any) {
        // If bucket doesn't exist (404), create it
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          console.log(`✅ Created MinIO bucket: ${this.bucketName}`);
          try {
            await setBucketPublicRead(this.s3Client, this.bucketName);
            console.log(`✅ Set public read policy on bucket: ${this.bucketName}`);
          } catch (policyErr: any) {
            console.warn(`Could not set public read policy on ${this.bucketName}:`, policyErr.message);
          }
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error('❌ MinIO initialization error:', err);
      throw err;
    }
  }
}

