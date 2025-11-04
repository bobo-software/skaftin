import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import StorageController from '../controllers/StorageController';
import { authenticateAndAttachUser } from '../middleware/supertokensAuthMiddleware';
import { verifyProjectAccess } from '../middleware/authMiddleware';

const router = express.Router();

// Configure multer for multipart file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// ============================================================================
// BUCKET ROUTES (No project access verification needed for listing)
// ============================================================================

/**
 * List all buckets
 * GET /api/storage/buckets?includeStats=false
 */
router.get('/buckets', authenticateAndAttachUser, StorageController.listBuckets);

/**
 * Create a new bucket
 * POST /api/storage/buckets
 * Body: { projectId: string, bucketName: string, region?: string }
 */
router.post('/buckets', authenticateAndAttachUser, StorageController.createBucket);

/**
 * Delete a bucket
 * DELETE /api/storage/buckets/:bucketName?force=false
 */
router.delete('/buckets/:bucketName', authenticateAndAttachUser, StorageController.deleteBucket);

// ============================================================================
// PROJECT-BASED FILE ROUTES (Require project access verification)
// ============================================================================

/**
 * List files in a project bucket
 * GET /api/storage/:projectId/files?prefix=&maxKeys=1000
 */
router.get(
  '/:projectId/files',
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.listFiles
);

/**
 * Search files in a project bucket
 * POST /api/storage/:projectId/search
 * Body: { query: string, fileType?: string, dateRange?: { start: string, end: string } }
 */
router.post(
  '/:projectId/search',
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.searchFiles
);

/**
 * Upload file (base64 encoded)
 * POST /api/storage/:projectId/upload
 * Body: { filePath: string, fileContent: string (base64), contentType?: string, metadata?: object }
 */
router.post(
  '/:projectId/upload',
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.uploadFile
);

/**
 * Upload file (multipart form data)
 * POST /api/storage/:projectId/upload-multipart
 * Form data: file (file field)
 */
router.post(
  '/:projectId/upload-multipart',
  authenticateAndAttachUser,
  verifyProjectAccess,
  upload.single('file'),
  StorageController.uploadFileMultipart
);

/**
 * Download file
 * GET /api/storage/:projectId/download/* (uses regex to capture full path)
 */
router.get(
  /^\/([^\/]+)\/download\/(.+)$/,
  authenticateAndAttachUser,
  verifyProjectAccess,
  (req: Request, res: Response, next: NextFunction) => {
    // Regex captures: [0] = projectId, [1] = filePath
    req.params.projectId = req.params[0];
    req.params.filePath = req.params[1];
    next();
  },
  StorageController.downloadFile
);

/**
 * Get file metadata
 * GET /api/storage/:projectId/files/* /metadata
 */
router.get(
  /^\/([^\/]+)\/files\/(.+)\/metadata$/,
  authenticateAndAttachUser,
  verifyProjectAccess,
  (req: Request, res: Response, next: NextFunction) => {
    // Regex captures: [0] = projectId, [1] = filePath
    req.params.projectId = req.params[0];
    req.params.filePath = req.params[1];
    next();
  },
  StorageController.getFileMetadata
);

/**
 * Delete file
 * DELETE /api/storage/:projectId/files/*
 */
router.delete(
  /^\/([^\/]+)\/files\/(.+)$/,
  authenticateAndAttachUser,
  verifyProjectAccess,
  (req: Request, res: Response, next: NextFunction) => {
    // Regex captures: [0] = projectId, [1] = filePath
    req.params.projectId = req.params[0];
    req.params.filePath = req.params[1];
    next();
  },
  StorageController.deleteFile
);

export { router };

