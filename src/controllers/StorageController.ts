import { Request, Response } from 'express';
import { Pool } from 'pg';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ResponseUtils from '../utils/ResponseUtils';

interface StorageControllerConfig {
  pool: Pool;
  s3Client: S3Client;
}

class StorageController {
  private static pool: Pool;
  private static s3Client: S3Client;

  /**
   * Initialize the controller with dependencies
   */
  static initialize(config: StorageControllerConfig) {
    this.pool = config.pool;
    this.s3Client = config.s3Client;
  }

  /**
   * Get project bucket name from database
   */
  private static async getProjectBucket(projectId: string): Promise<string | null> {
    try {
      const result = await this.pool.query(
        'SELECT bucket_name FROM platform.projects WHERE id = $1',
        [projectId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].bucket_name;
    } catch (error) {
      console.error('Error fetching project bucket:', error);
      return null;
    }
  }

  /**
   * List buckets
   * GET /api/storage/buckets
   */
  static async listBuckets(req: Request, res: Response) {
    try {
      const { includeStats = 'false' } = req.query;

      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);

      if (!response.Buckets) {
        return ResponseUtils.success(res, 'No buckets found', []);
      }

      const buckets = await Promise.all(
        response.Buckets.map(async (bucket) => {
          const bucketInfo: any = {
            name: bucket.Name,
            creationDate: bucket.CreationDate,
          };

          // Include stats if requested
          if (includeStats === 'true' && bucket.Name) {
            try {
              const listCommand = new ListObjectsV2Command({
                Bucket: bucket.Name,
                MaxKeys: 1000,
              });
              const objects = await this.s3Client.send(listCommand);
              
              bucketInfo.fileCount = objects.KeyCount || 0;
              bucketInfo.totalSize = objects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;
            } catch (error) {
              bucketInfo.fileCount = 0;
              bucketInfo.totalSize = 0;
            }
          }

          return bucketInfo;
        })
      );

      ResponseUtils.success(res, 'Buckets listed successfully', buckets);
    } catch (error) {
      console.error('List buckets error:', error);
      ResponseUtils.error(res, 'Failed to list buckets', error);
    }
  }

  /**
   * Create bucket
   * POST /api/storage/buckets
   */
  static async createBucket(req: Request, res: Response) {
    try {
      const { projectId, bucketName, region = 'us-east-1' } = req.body;

      if (!projectId || !bucketName) {
        return ResponseUtils.error(res, 'projectId and bucketName are required', null, null, 400);
      }

      // Check if bucket already exists by trying to list objects
      try {
        const checkCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1,
        });
        await this.s3Client.send(checkCommand);
        
        return ResponseUtils.success(res, 'Bucket already exists', {
          bucket: bucketName,
          existed: true,
        });
      } catch (error: any) {
        // Bucket doesn't exist, create it by uploading an init file
        try {
          const createCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: '.bucket-init',
            Body: Buffer.from(''),
          });
          
          await this.s3Client.send(createCommand);
          
          // Delete the init file
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: '.bucket-init',
          });
          
          await this.s3Client.send(deleteCommand);

          // Update project bucket name in database
          await this.pool.query(
            'UPDATE platform.projects SET bucket_name = $1 WHERE id = $2',
            [bucketName, projectId]
          );

          return ResponseUtils.success(res, 'Bucket created successfully', {
            bucket: bucketName,
            existed: false,
          }, 201);
        } catch (createError: any) {
          console.error('Bucket creation error:', createError);
          return ResponseUtils.error(res, `Failed to create bucket: ${createError.message}`, createError);
        }
      }
    } catch (error) {
      console.error('Create bucket error:', error);
      ResponseUtils.error(res, 'Failed to create bucket', error);
    }
  }

  /**
   * Delete bucket
   * DELETE /api/storage/buckets/:bucketName
   */
  static async deleteBucket(req: Request, res: Response) {
    try {
      const { bucketName } = req.params;
      const { force = 'false' } = req.query;

      if (!bucketName) {
        return ResponseUtils.error(res, 'bucketName is required', null, null, 400);
      }

      // List all objects in bucket
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      });
      
      const objects = await this.s3Client.send(listCommand);

      if (objects.Contents && objects.Contents.length > 0) {
        if (force !== 'true') {
          return ResponseUtils.error(
            res,
            'Bucket is not empty. Use force=true to delete all files',
            null,
            null,
            400
          );
        }

        // Delete all objects
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objects.Contents.map((obj) => ({ Key: obj.Key })),
          },
        });

        await this.s3Client.send(deleteCommand);
      }

      ResponseUtils.success(res, 'Bucket deleted successfully', {
        bucket: bucketName,
        filesDeleted: objects.Contents?.length || 0,
      });
    } catch (error: any) {
      console.error('Delete bucket error:', error);
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to delete bucket', error);
    }
  }

  /**
   * List files in a project bucket
   * GET /api/storage/:projectId/files
   */
  static async listFiles(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { prefix, maxKeys = '1000' } = req.query;

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix as string,
        MaxKeys: parseInt(maxKeys as string),
      });

      const response = await this.s3Client.send(command);

      const files = response.Contents?.map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      })) || [];

      ResponseUtils.success(res, 'Files listed successfully', {
        files,
        count: files.length,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('List files error:', error);
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to list files', error);
    }
  }

  /**
   * Search files in a project bucket
   * POST /api/storage/:projectId/search
   */
  static async searchFiles(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { query, fileType, dateRange } = req.body;

      if (!query) {
        return ResponseUtils.error(res, 'query is required', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents) {
        return ResponseUtils.success(res, 'No files found', []);
      }

      let files = response.Contents;

      // Filter by query (filename)
      if (query) {
        files = files.filter((file) =>
          file.Key?.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Filter by file type
      if (fileType) {
        files = files.filter((file) => file.Key?.endsWith(fileType));
      }

      // Filter by date range
      if (dateRange && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        files = files.filter((file) => {
          if (!file.LastModified) return false;
          const modDate = new Date(file.LastModified);
          return modDate >= start && modDate <= end;
        });
      }

      const results = files.map((file) => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        etag: file.ETag,
      }));

      ResponseUtils.success(res, 'Search completed successfully', {
        files: results,
        count: results.length,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('Search files error:', error);
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to search files', error);
    }
  }

  /**
   * Upload file to project bucket
   * POST /api/storage/:projectId/upload
   */
  static async uploadFile(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { filePath, fileContent, contentType, metadata } = req.body;

      if (!filePath || !fileContent) {
        return ResponseUtils.error(res, 'filePath and fileContent are required', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      // Decode base64 content
      const buffer = Buffer.from(fileContent, 'base64');

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      ResponseUtils.success(res, 'File uploaded successfully', {
        filePath,
        size: buffer.length,
        contentType,
        bucket: bucketName,
      }, 201);
    } catch (error: any) {
      console.error('Upload file error:', error);
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to upload file', error);
    }
  }

  /**
   * Upload file (multipart) to project bucket
   * POST /api/storage/:projectId/upload-multipart
   * This is handled by multer middleware
   */
  static async uploadFileMultipart(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!req.file) {
        return ResponseUtils.error(res, 'No file uploaded', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const fileName = `${Date.now()}-${req.file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await this.s3Client.send(command);

      ResponseUtils.success(res, 'File uploaded successfully', {
        fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        bucket: bucketName,
      }, 201);
    } catch (error: any) {
      console.error('Upload multipart file error:', error);
      ResponseUtils.error(res, 'Failed to upload file', error);
    }
  }

  /**
   * Download file from project bucket
   * GET /api/storage/:projectId/download/:filePath(*)
   */
  static async downloadFile(req: Request, res: Response) {
    try {
      const { projectId, filePath } = req.params;
      const { range } = req.query;

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      // Check if file exists
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await this.s3Client.send(headCommand);

      // Generate presigned URL for download (valid for 1 hour)
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Range: range as string,
      });

      const signedUrl = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 3600 });

      // Return signed URL or redirect
      if (req.query.returnUrl === 'true') {
        ResponseUtils.success(res, 'Download URL generated', { url: signedUrl });
      } else {
        res.redirect(signedUrl);
      }
    } catch (error: any) {
      console.error('Download file error:', error);
      
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return ResponseUtils.error(res, 'File not found', null, null, 404);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to download file', error);
    }
  }

  /**
   * Delete file from project bucket
   * DELETE /api/storage/:projectId/files/:filePath(*)
   */
  static async deleteFile(req: Request, res: Response) {
    try {
      const { projectId, filePath } = req.params;

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);

      ResponseUtils.success(res, 'File deleted successfully', {
        filePath,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('Delete file error:', error);
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to delete file', error);
    }
  }

  /**
   * Get file metadata
   * GET /api/storage/:projectId/files/:filePath(*)/metadata
   */
  static async getFileMetadata(req: Request, res: Response) {
    try {
      const { projectId, filePath } = req.params;

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await this.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      ResponseUtils.success(res, 'File metadata retrieved', {
        filePath,
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('Get file metadata error:', error);
      
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return ResponseUtils.error(res, 'File not found', null, null, 404);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to get file metadata', error);
    }
  }
}

export default StorageController;

