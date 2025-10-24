import { Client } from 'minio';
import { config, getMinioConfig } from '../config/environment';

export class StorageService {
  private client: Client;

  constructor() {
    const minioConfig = getMinioConfig();
    this.client = new Client(minioConfig);
  }

  async listFiles(projectId: string, prefix: string = ''): Promise<any[]> {
    try {
      const project = await this.getProject(projectId);
      const bucketName = project.bucket_name;
      
      const objects: any[] = [];
      const stream = this.client.listObjects(bucketName, prefix, true);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          objects.push({
            name: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag
          });
        });
        stream.on('error', reject);
        stream.on('end', () => resolve(objects));
      });
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(projectId: string, fileName: string, fileData: string, contentType?: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const bucketName = project.bucket_name;
      
      // Convert base64 to buffer
      const buffer = Buffer.from(fileData, 'base64');
      
      const result = await this.client.putObject(bucketName, fileName, buffer, buffer.length, {
        'Content-Type': contentType || 'application/octet-stream'
      });
      
      return {
        fileName,
        bucketName,
        etag: result.etag,
        size: buffer.length
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFile(projectId: string, fileName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const bucketName = project.bucket_name;
      
      const stream = await this.client.getObject(bucketName, fileName);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            fileName,
            data: buffer.toString('base64'),
            size: buffer.length
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(projectId: string, fileName: string): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      const bucketName = project.bucket_name;
      
      await this.client.removeObject(bucketName, fileName);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Try to list buckets to test connection
      await this.client.listBuckets();
      return true;
    } catch (error) {
      console.error('MinIO connection check failed:', error);
      return false;
    }
  }

  private async getProject(projectId: string): Promise<any> {
    const { pool } = require('../db/connection');
    const query = 'SELECT * FROM platform.projects WHERE id = $1';
    const result = await pool.query(query, [projectId]);
    
    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    return result.rows[0];
  }
}
