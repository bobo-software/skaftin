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
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ResponseUtils from '../utils/ResponseUtils';
import { AnalyticsService } from '../services/AnalyticsService';

interface StorageControllerConfig {
  pool: Pool;
  s3Client: S3Client;
}

class StorageController {
  private static pool: Pool;
  static s3Client: S3Client;

  /**
   * Initialize the controller with dependencies
   */
  static initialize(config: StorageControllerConfig) {
    this.pool = config.pool;
    this.s3Client = config.s3Client;
  }

  /**
   * Helper to get projectId from request (middleware or params)
   */
  private static getProjectId(req: Request & { projectId?: number }): string | null {
    // Prefer projectId from middleware (extracted from API key)
    if (req.projectId) {
      return req.projectId.toString();
    }
    // Fallback to params (for SuperTokens routes)
    if (req.params?.projectId) {
      return req.params.projectId;
    }
    return null;
  }

  /**
   * Helper to record storage metrics
   */
  private static recordStorageMetric(
    projectId: string,
    operationType: 'upload' | 'download' | 'delete' | 'list' | 'search',
    data: {
      filePath?: string;
      fileSizeBytes?: number;
      bucketName?: string;
      success?: boolean;
      errorMessage?: string;
    },
    req: Request & { projectId?: number }
  ) {
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) return;

    const userId = (req as any).session?.getUserId?.() || (req as any).user?.userId || undefined;
    const apiKeyId = (req as any).apiKeyId || undefined;

    AnalyticsService.recordStorageMetric({
      projectId: projectIdNum,
      operationType,
      ...data,
      userId: userId?.toString(),
      apiKeyId,
    }).catch((error) => {
      console.error('Error recording storage metric:', error);
    });
  }

  /**
   * Validate that a bucket belongs to a project
   */
  private static async validateBucketForProject(projectId: string, bucketName: string): Promise<boolean> {
    try {
      const projectIdInt = parseInt(projectId, 10);
      
      if (isNaN(projectIdInt)) {
        console.error('Invalid project ID:', projectId);
        return false;
      }
      
      const result = await StorageController.pool.query(
        'SELECT id FROM skaftin_system_project_buckets WHERE project_id = $1 AND bucket_name = $2',
        [projectIdInt, bucketName]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error validating bucket for project:', error);
      return false;
    }
  }

  /**
   * List buckets for a project
   * GET /api/storage/:projectId/buckets
   * 
   * Returns all buckets for the specified project
   */
  static async listBuckets(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { includeStats = 'false' } = req.query;
      const projectIdInt = parseInt(projectId, 10);
      
      if (isNaN(projectIdInt)) {
        return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
      }

      // Get all buckets for the project from database
      const result = await StorageController.pool.query(
        'SELECT id, bucket_name, description, created_at, updated_at FROM skaftin_system_project_buckets WHERE project_id = $1 ORDER BY created_at',
        [projectIdInt]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.success(res, 'No buckets found for this project', []);
      }

      const buckets = await Promise.all(
        result.rows.map(async (row) => {
          const bucketInfo: any = {
            id: row.id,
            name: row.bucket_name,
            description: row.description,
            creationDate: row.created_at,
            updatedAt: row.updated_at,
          };

          // Include stats if requested
          if (includeStats === 'true' && row.bucket_name) {
            try {
              const listCommand = new ListObjectsV2Command({
                Bucket: row.bucket_name,
                MaxKeys: 1000,
              });
              const objects = await StorageController.s3Client.send(listCommand);
              
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
   * List files in a project bucket
   * GET /api/storage/:projectId/:bucketName/files
   */
  static async listFiles(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      
      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      const { prefix, maxKeys = '1000' } = req.query;

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix as string,
        MaxKeys: parseInt(maxKeys as string),
      });

      const response = await StorageController.s3Client.send(command);

      const files = response.Contents?.map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      })) || [];

      // Track storage metric
      this.recordStorageMetric(projectId, 'list', {
        bucketName,
        success: true,
      }, req);

      ResponseUtils.success(res, 'Files listed successfully', {
        files,
        count: files.length,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('List files error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        this.recordStorageMetric(projectId, 'list', {
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to list files', error);
    }
  }

  /**
   * Search files in a project bucket
   * POST /api/storage/:projectId/:bucketName/search
   */
  static async searchFiles(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      
      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      const { query, fileType, dateRange } = req.body;

      if (!query) {
        return ResponseUtils.error(res, 'query is required', null, null, 400);
      }

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      });

      const response = await StorageController.s3Client.send(command);

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

      // Track storage metric
      this.recordStorageMetric(projectId, 'search', {
        bucketName,
        success: true,
      }, req);

      ResponseUtils.success(res, 'Search completed successfully', {
        files: results,
        count: results.length,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('Search files error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        this.recordStorageMetric(projectId, 'search', {
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to search files', error);
    }
  }

  /**
   * Upload file to project bucket
   * POST /api/storage/:projectId/:bucketName/upload
   */
  static async uploadFile(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      
      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      const { filePath, fileContent, contentType, metadata } = req.body;

      // Validate required fields (allow empty string for fileContent - used for folders)
      if (!filePath || fileContent === undefined || fileContent === null) {
        return ResponseUtils.error(res, 'filePath and fileContent are required', null, null, 400);
      }

      // Decode base64 content (empty string is valid for folder markers)
      const buffer = fileContent ? Buffer.from(fileContent, 'base64') : Buffer.from('');

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await StorageController.s3Client.send(command);

      // Track storage metric
      this.recordStorageMetric(projectId, 'upload', {
        filePath,
        fileSizeBytes: buffer.length,
        bucketName,
        success: true,
      }, req);

      ResponseUtils.success(res, 'File uploaded successfully', {
        filePath,
        size: buffer.length,
        contentType,
        bucket: bucketName,
      }, 201);
    } catch (error: any) {
      console.error('Upload file error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        this.recordStorageMetric(projectId, 'upload', {
          filePath: req.body?.filePath,
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to upload file', error);
    }
  }

  /**
   * Upload file (multipart) to project bucket
   * POST /api/storage/:projectId/:bucketName/upload-multipart
   * This is handled by multer middleware
   */
  static async uploadFileMultipart(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      if (!req.file) {
        return ResponseUtils.error(res, 'No file uploaded', null, null, 400);
      }

      const fileName = `${Date.now()}-${req.file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await StorageController.s3Client.send(command);

      // Track storage metric
      this.recordStorageMetric(projectId, 'upload', {
        filePath: fileName,
        fileSizeBytes: req.file.size,
        bucketName,
        success: true,
      }, req);

      ResponseUtils.success(res, 'File uploaded successfully', {
        fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        bucket: bucketName,
      }, 201);
    } catch (error: any) {
      console.error('Upload multipart file error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        this.recordStorageMetric(projectId, 'upload', {
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
      ResponseUtils.error(res, 'Failed to upload file', error);
    }
  }

  /**
   * Download file from project bucket
   * GET /api/storage/:projectId/:bucketName/download/* (wildcard path)
   */
  static async downloadFile(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      let { filePath } = req.params;
      const { range } = req.query;

      // If filePath is not in params, extract it from the URL path
      if (!filePath) {
        const pathMatch = req.path.match(/\/download\/(.+)$/);
        if (pathMatch) {
          filePath = decodeURIComponent(pathMatch[1]);
        }
      }

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      // Check if file exists and get file size
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      const headResult = await StorageController.s3Client.send(headCommand);
      const fileSize = headResult.ContentLength || 0;

      // Generate presigned URL for download (valid for 1 hour)
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Range: range as string,
      });

      const signedUrl = await getSignedUrl(StorageController.s3Client, getCommand, { expiresIn: 3600 });

      // Track storage metric
      this.recordStorageMetric(projectId, 'download', {
        filePath,
        fileSizeBytes: fileSize,
        bucketName,
        success: true,
      }, req);

      // Return signed URL or redirect
      if (req.query.returnUrl === 'true') {
        ResponseUtils.success(res, 'Download URL generated', { url: signedUrl });
      } else {
        res.redirect(signedUrl);
      }
    } catch (error: any) {
      console.error('Download file error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        this.recordStorageMetric(projectId, 'download', {
          filePath: req.params?.filePath,
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
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
   * DELETE /api/storage/:projectId/:bucketName/files/* (wildcard path)
   */
  static async deleteFile(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }
      
      // Get filePath from params (set by handleWildcardPath middleware)
      const filePath = req.params.filePath;

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await StorageController.s3Client.send(command);

      // Track storage metric
      StorageController.recordStorageMetric(projectId, 'delete', {
        filePath,
        bucketName,
        success: true,
      }, req);

      ResponseUtils.success(res, 'File deleted successfully', {
        filePath,
        bucket: bucketName,
      });
    } catch (error: any) {
      console.error('Delete file error:', error);
      
      // Track failed operation
      const projectId = StorageController.getProjectId(req);
      if (projectId) {
        StorageController.recordStorageMetric(projectId, 'delete', {
          filePath: req.params?.filePath,
          success: false,
          errorMessage: error.message,
        }, req);
      }
      
      if (error.name === 'NoSuchBucket') {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }
      
      ResponseUtils.error(res, 'Failed to delete file', error);
    }
  }

  /**
   * Get file metadata
   * GET /api/storage/:projectId/:bucketName/files/
   * <filePath>/metadata (wildcard path)
   */
  static async getFileMetadata(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      let { filePath } = req.params;

      // If filePath is not in params, extract it from the URL path
      if (!filePath) {
        const pathMatch = req.path.match(/\/files\/(.+)\/metadata$/);
        if (pathMatch) {
          filePath = decodeURIComponent(pathMatch[1]);
        }
      }

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      const response = await StorageController.s3Client.send(command);

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

  /**
   * Rename folder (copy all files to new location and delete old ones)
   * PUT /api/storage/:projectId/:bucketName/folders/rename
   */
  static async renameFolder(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      const { oldPath, newPath } = req.body;

      if (!oldPath || !newPath) {
        return ResponseUtils.error(res, 'oldPath and newPath are required', null, null, 400);
      }

      // Ensure paths end with / for folder operations
      const oldPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
      const newPrefix = newPath.endsWith('/') ? newPath : `${newPath}/`;

      // List all objects in the old folder
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: oldPrefix,
      });

      const response = await StorageController.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        return ResponseUtils.error(res, 'Folder not found or is empty', null, null, 404);
      }

      // Copy each object to the new location
      const copyPromises = response.Contents.map(async (object) => {
        if (!object.Key) return;

        const newKey = object.Key.replace(oldPrefix, newPrefix);
        
        const copyCommand = new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${object.Key}`,
          Key: newKey,
        });

        await StorageController.s3Client.send(copyCommand);
      });

      await Promise.all(copyPromises);

      // Delete all old objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: response.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });

      await StorageController.s3Client.send(deleteCommand);

      ResponseUtils.success(res, 'Folder renamed successfully', {
        oldPath,
        newPath,
        filesRenamed: response.Contents.length,
      });
    } catch (error: any) {
      console.error('Rename folder error:', error);
      ResponseUtils.error(res, 'Failed to rename folder', error);
    }
  }

  /**
   * Delete folder and all its contents
   * DELETE /api/storage/:projectId/:bucketName/folders/* (wildcard path)
   */
  static async deleteFolder(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get bucketName from params or body
      const bucketName = req.params.bucketName || req.body.bucketName;
      if (!bucketName) {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket belongs to project
      const isValid = await StorageController.validateBucketForProject(projectId, bucketName);
      if (!isValid) {
        return ResponseUtils.error(res, 'Bucket not found or does not belong to this project', null, null, 404);
      }

      let { folderPath } = req.params;

      // If folderPath is not in params, extract it from the URL path
      if (!folderPath) {
        const pathMatch = req.path.match(/\/folders\/(.+)$/);
        if (pathMatch) {
          folderPath = decodeURIComponent(pathMatch[1]);
        }
      }

      if (!folderPath) {
        return ResponseUtils.error(res, 'Folder path is required', null, null, 400);
      }

      // Ensure path ends with / for folder operations
      const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

      // List all objects in the folder
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const response = await StorageController.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        return ResponseUtils.error(res, 'Folder not found or is empty', null, null, 404);
      }

      // Delete all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: response.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });

      await StorageController.s3Client.send(deleteCommand);

      ResponseUtils.success(res, 'Folder deleted successfully', {
        folderPath,
        filesDeleted: response.Contents.length,
      });
    } catch (error: any) {
      console.error('Delete folder error:', error);
      ResponseUtils.error(res, 'Failed to delete folder', error);
    }
  }
}

export default StorageController;

