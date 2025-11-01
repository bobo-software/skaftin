import { Request, Response } from 'express';
import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';

// Initialize S3 client for MinIO
const minioEndpoint = process.env.MINIO_SERVER_URL || 'http://localhost:9000';
const s3Client = new S3Client({
  endpoint: minioEndpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || '',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'skaftin';

// Configure multer for file uploads
export const uploadMiddleware = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

class FilesController {
  /**
   * Upload file (handled by multer middleware, this just returns the response)
   */
  static async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return ResponseUtils.error(res, 'No file uploaded', null, null, 400);
      }

      const fileLocation = (req.file as any).location || `${minioEndpoint}/${BUCKET_NAME}/${(req.file as any).key}`;
      const fileName = (req.file as any).key || req.file.originalname;

      ResponseUtils.success(res, 'File uploaded successfully', {
        fileName: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        location: fileLocation,
      }, 201);
    } catch (error) {
      console.error('Upload error:', error);
      ResponseUtils.error(res, 'Failed to upload file', error);
    }
  }

  /**
   * List all files
   */
  static async list(req: Request, res: Response) {
    try {
      const objectsList: any[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
          for (const obj of response.Contents) {
            objectsList.push({
              name: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified,
            });
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      ResponseUtils.success(res, 'Files listed successfully', objectsList);
    } catch (error) {
      console.error('List files error:', error);
      ResponseUtils.error(res, 'Failed to list files', error);
    }
  }

  /**
   * Download file
   */
  static async download(req: Request, res: Response) {
    try {
      const fileName = req.params.fileName;

      // Get file metadata
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      });

      await s3Client.send(headCommand);

      // Generate a presigned URL for download (valid for 1 hour)
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      });

      const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

      // Redirect to the presigned URL
      res.redirect(signedUrl);
    } catch (error: any) {
      console.error('Download error:', error);
      
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return ResponseUtils.error(res, 'File not found', null, null, 404);
      }

      ResponseUtils.error(res, 'Failed to download file', error);
    }
  }

  /**
   * Delete file
   */
  static async delete(req: Request, res: Response) {
    try {
      const fileName = req.params.fileName;
      
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      });

      await s3Client.send(command);

      ResponseUtils.success(res, 'File deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      ResponseUtils.error(res, 'Failed to delete file', error);
    }
  }
}

export default FilesController;

