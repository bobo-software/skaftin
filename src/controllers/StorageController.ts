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
   */
  static async listBuckets(req: Request, res: Response) {
    try {
      const { includeStats = 'false' } = req.query;

      const command = new ListBucketsCommand({});
      const response = await StorageController.s3Client.send(command);

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
   * GET /api/storage/:projectId/files
   */
  static async listFiles(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
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
   * GET /api/storage/:projectId/download/ * (wildcard path)
   */
  static async downloadFile(req: Request, res: Response) {
    try {
      let { projectId, filePath } = req.params;
      const { range } = req.query;

      // If filePath is not in params, extract it from the URL path
      if (!projectId || !filePath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/download\/(.+)$/);
        if (pathMatch) {
          projectId = pathMatch[1];
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

      // Check if file exists
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await StorageController.s3Client.send(headCommand);

      // Generate presigned URL for download (valid for 1 hour)
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Range: range as string,
      });

      const signedUrl = await getSignedUrl(StorageController.s3Client, getCommand, { expiresIn: 3600 });

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
   * DELETE /api/storage/:projectId/files/ * (wildcard path)
   */
  static async deleteFile(req: Request, res: Response) {
    try {
      let { projectId, filePath } = req.params;

      // If filePath is not in params, extract it from the URL path
      if (!projectId || !filePath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/files\/(.+)$/);
        if (pathMatch) {
          projectId = pathMatch[1];
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

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await StorageController.s3Client.send(command);

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
   * GET /api/storage/:projectId/files/ * /metadata (wildcard path)
   */
  static async getFileMetadata(req: Request, res: Response) {
    try {
      let { projectId, filePath } = req.params;

      // If filePath is not in params, extract it from the URL path
      if (!projectId || !filePath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/files\/(.+)\/metadata$/);
        if (pathMatch) {
          projectId = pathMatch[1];
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
  static async renameFolder(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
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
  static async deleteFolder(req: Request, res: Response) {
    try {
      let { projectId, folderPath } = req.params;

      // If folderPath is not in params, extract it from the URL path
      if (!projectId || !folderPath) {
        const pathMatch = req.path.match(/^\/([^\/]+)\/folders\/(.+)$/);
        if (pathMatch) {
          projectId = pathMatch[1];
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

