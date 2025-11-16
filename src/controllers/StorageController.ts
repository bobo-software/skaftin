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
  private static s3Client: S3Client;

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
   * Get project bucket name from database
   */
  private static async getProjectBucket(projectId: string): Promise<string | null> {
    try {
      // Parse project ID to integer (projects.id is serial/integer type)
      const projectIdInt = parseInt(projectId, 10);
      
      if (isNaN(projectIdInt)) {
        console.error('Invalid project ID:', projectId);
        return null;
      }
      
      const result = await StorageController.pool.query(
        'SELECT bucket_name FROM projects WHERE id = $1',
        [projectIdInt]
      );

      if (result.rows.length === 0) {
        console.log(`Project not found with ID: ${projectIdInt}`);
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
   * 
   * - If projectId is present (from API key): Only return that project's bucket
   * - If no projectId (platform admin): Return all buckets
   */
  static async listBuckets(req: Request & { projectId?: number }, res: Response) {
    try {
      const { includeStats = 'false' } = req.query;
      
      // If projectId is present (client app with API key), filter to only that project's bucket
      let projectBucketName: string | null = null;
      if (req.projectId) {
        projectBucketName = await StorageController.getProjectBucket(req.projectId.toString());
        if (!projectBucketName) {
          return ResponseUtils.error(res, 'Project bucket not found', null, null, 404);
        }
      }

      const command = new ListBucketsCommand({});
      const response = await StorageController.s3Client.send(command);

      if (!response.Buckets) {
        return ResponseUtils.success(res, 'No buckets found', []);
      }

      // Filter buckets by project if projectId is present
      let bucketsToProcess = response.Buckets;
      if (projectBucketName) {
        bucketsToProcess = response.Buckets.filter(b => b.Name === projectBucketName);
        if (bucketsToProcess.length === 0) {
          return ResponseUtils.success(res, 'No buckets found for this project', []);
        }
      }

      const buckets = await Promise.all(
        bucketsToProcess.map(async (bucket) => {
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
        await StorageController.s3Client.send(checkCommand);
        
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
          
          await StorageController.s3Client.send(createCommand);
          
          // Delete the init file
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: '.bucket-init',
          });
          
          await StorageController.s3Client.send(deleteCommand);

          // Parse project ID and update project bucket name in database
          const projectIdInt = parseInt(projectId, 10);
          await StorageController.pool.query(
            'UPDATE projects SET bucket_name = $1 WHERE id = $2',
            [bucketName, projectIdInt]
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
      
      const objects = await StorageController.s3Client.send(listCommand);

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

        await StorageController.s3Client.send(deleteCommand);
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
   * GET /app-api/storage/files
   */
  static async listFiles(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { prefix, maxKeys = '1000' } = req.query;

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

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
   * POST /api/storage/:projectId/search
   */
  static async searchFiles(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { query, fileType, dateRange } = req.body;

      if (!query) {
        return ResponseUtils.error(res, 'query is required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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
   * POST /api/storage/:projectId/upload
   */
  static async uploadFile(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { filePath, fileContent, contentType, metadata } = req.body;

      // Validate required fields (allow empty string for fileContent - used for folders)
      if (!filePath || fileContent === undefined || fileContent === null) {
        return ResponseUtils.error(res, 'filePath and fileContent are required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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
   * POST /api/storage/:projectId/upload-multipart
   * This is handled by multer middleware
   */
  static async uploadFileMultipart(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (!req.file) {
        return ResponseUtils.error(res, 'No file uploaded', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
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
   * GET /api/storage/:projectId/download/ * (wildcard path)
   */
  static async downloadFile(req: Request & { projectId?: number }, res: Response) {
    try {
      let { filePath } = req.params;
      const { range } = req.query;

      // Get projectId from helper (checks both middleware and params)
      let projectId = StorageController.getProjectId(req);

      // If filePath is not in params, extract it from the URL path
      if (!filePath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/download\/(.+)$/);
        if (pathMatch) {
          projectId = projectId || pathMatch[1];
          filePath = decodeURIComponent(pathMatch[2]);
        }
      }

      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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
   * DELETE /app-api/storage/files/... (wildcard path)
   * Project ID is extracted from API key automatically
   */
  static async deleteFile(req: Request & { projectId?: number }, res: Response) {
    try {
      // Get projectId from helper (checks both middleware and params)
      const projectId = StorageController.getProjectId(req);
      
      // Get filePath from params (set by handleWildcardPath middleware)
      const filePath = req.params.filePath;

      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await StorageController.s3Client.send(command);

      // Track storage metric
      this.recordStorageMetric(projectId, 'delete', {
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
        this.recordStorageMetric(projectId, 'delete', {
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
   * GET /api/storage/:projectId/files/ * /metadata (wildcard path)
   */
  static async getFileMetadata(req: Request & { projectId?: number }, res: Response) {
    try {
      let { filePath } = req.params;

      // Get projectId from helper (checks both middleware and params)
      let projectId = StorageController.getProjectId(req);

      // If filePath is not in params, extract it from the URL path
      if (!filePath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/files\/(.+)\/metadata$/);
        if (pathMatch) {
          projectId = projectId || pathMatch[1];
          filePath = decodeURIComponent(pathMatch[2]);
        }
      }

      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (!filePath) {
        return ResponseUtils.error(res, 'File path is required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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
   * PUT /api/storage/:projectId/folders/rename
   */
  static async renameFolder(req: Request & { projectId?: number }, res: Response) {
    try {
      const projectId = StorageController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { oldPath, newPath } = req.body;

      if (!oldPath || !newPath) {
        return ResponseUtils.error(res, 'oldPath and newPath are required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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
   * DELETE /api/storage/:projectId/folders/:folderPath
   */
  static async deleteFolder(req: Request & { projectId?: number }, res: Response) {
    try {
      let { folderPath } = req.params;

      // Get projectId from helper (checks both middleware and params)
      let projectId = StorageController.getProjectId(req);

      // If folderPath is not in params, extract it from the URL path
      if (!folderPath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/folders\/(.+)$/);
        if (pathMatch) {
          projectId = projectId || pathMatch[1];
          folderPath = decodeURIComponent(pathMatch[2]);
        }
      }

      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (!folderPath) {
        return ResponseUtils.error(res, 'Folder path is required', null, null, 400);
      }

      const bucketName = await StorageController.getProjectBucket(projectId);
      if (!bucketName) {
        return ResponseUtils.error(res, 'Project not found or bucket not configured', null, null, 404);
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

