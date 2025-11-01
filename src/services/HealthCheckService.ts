import { Pool } from 'pg';
import { S3Client, HeadBucketCommand, ListObjectsV2Command, CreateBucketCommand } from '@aws-sdk/client-s3';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'warning' | 'pending';
  message: string;
  details: string;
}

interface SystemHealthStatus {
  database: HealthStatus;
  minio: HealthStatus;
}

/**
 * HealthCheckService - Performs health checks on database and storage
 */
export class HealthCheckService {
  private pool: Pool;
  private s3Client: S3Client;
  private bucketName: string;
  private minioEndpoint: string;

  constructor(pool: Pool, s3Client: S3Client, bucketName: string, minioEndpoint: string) {
    this.pool = pool;
    this.s3Client = s3Client;
    this.bucketName = bucketName;
    this.minioEndpoint = minioEndpoint;
  }

  /**
   * Check PostgreSQL database health
   */
  private async checkDatabaseHealth(): Promise<HealthStatus> {
    try {
      const client = await this.pool.connect();
      const startTime = Date.now();
      const result = await client.query('SELECT NOW(), version(), current_database()');
      const responseTime = Date.now() - startTime;
      client.release();

      return {
        status: 'healthy',
        message: 'Connected successfully',
        details: `Response time: ${responseTime}ms | DB: ${result.rows[0].current_database} | Version: ${result.rows[0].version.split(',')[0]}`,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: 'Connection failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Check MinIO storage health
   */
  private async checkMinIOHealth(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
        const responseTime = Date.now() - startTime;

        // List objects to verify full connectivity
        const listCommand = new ListObjectsV2Command({ Bucket: this.bucketName, MaxKeys: 1 });
        await this.s3Client.send(listCommand);

        return {
          status: 'healthy',
          message: 'Connected successfully',
          details: `Response time: ${responseTime}ms | Endpoint: ${this.minioEndpoint} | Bucket: ${this.bucketName}`,
        };
      } catch (err: any) {
        // If bucket doesn't exist, try to create it
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          console.log(`✅ Created MinIO bucket: ${this.bucketName}`);
          
          return {
            status: 'warning',
            message: 'Bucket was created',
            details: `Bucket ${this.bucketName} did not exist and was created`,
          };
        } else {
          throw err;
        }
      }
    } catch (err) {
      return {
        status: 'unhealthy',
        message: 'Connection failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Perform all health checks and display results
   */
  async performHealthChecks(): Promise<SystemHealthStatus> {
    console.log('\n🔍 Performing health checks...\n');

    const healthStatus: SystemHealthStatus = {
      database: { status: 'pending', message: '', details: '' },
      minio: { status: 'pending', message: '', details: '' },
    };

    // Check PostgreSQL Database
    healthStatus.database = await this.checkDatabaseHealth();
    
    if (healthStatus.database.status === 'healthy') {
      console.log('✅ PostgreSQL Database:');
      console.log(`   Status: ${healthStatus.database.status}`);
      console.log(`   Message: ${healthStatus.database.message}`);
      console.log(`   Details: ${healthStatus.database.details}`);
    } else {
      console.log('❌ PostgreSQL Database:');
      console.log(`   Status: ${healthStatus.database.status}`);
      console.log(`   Error: ${healthStatus.database.details}`);
    }

    console.log('');

    // Check MinIO
    healthStatus.minio = await this.checkMinIOHealth();
    
    if (healthStatus.minio.status === 'healthy') {
      console.log('✅ MinIO Storage:');
      console.log(`   Status: ${healthStatus.minio.status}`);
      console.log(`   Message: ${healthStatus.minio.message}`);
      console.log(`   Details: ${healthStatus.minio.details}`);
    } else if (healthStatus.minio.status === 'warning') {
      console.log('⚠️  MinIO Storage:');
      console.log(`   Status: ${healthStatus.minio.status}`);
      console.log(`   Details: ${healthStatus.minio.details}`);
    } else {
      console.log('❌ MinIO Storage:');
      console.log(`   Status: ${healthStatus.minio.status}`);
      console.log(`   Error: ${healthStatus.minio.details}`);
    }

    console.log('');

    // Summary
    const allHealthy =
      healthStatus.database.status === 'healthy' &&
      (healthStatus.minio.status === 'healthy' || healthStatus.minio.status === 'warning');

    if (allHealthy) {
      console.log('✅ All services are ready!\n');
    } else {
      console.log('⚠️  Some services have issues. Server will start but some features may not work.\n');
    }

    return healthStatus;
  }
}
