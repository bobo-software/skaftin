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
 * Rename folder
 * PUT /api/storage/:projectId/folders/rename
 */
router.put(
  '/:projectId/folders/rename',
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.renameFolder
);

/**
 * Custom middleware to handle wildcard file paths
 * Extracts projectId and filePath from the URL for download/delete/metadata operations
 */
const handleWildcardPath = (req: Request, res: Response, next: NextFunction) => {
  // Parse the path after /api/storage/
  // req.path is relative to the router mount point (e.g., /6/download/file.png)
  const path = req.path;
  
  // Match download pattern: /projectId/download/filePath
  let match = path.match(/^\/([^\/]+)\/download\/(.+)$/);
  if (match) {
    req.params.projectId = match[1];
    req.params.filePath = decodeURIComponent(match[2]);
    return next();
  }
  
  // Match folders pattern: /projectId/folders/folderPath
  match = path.match(/^\/([^\/]+)\/folders\/(.+)$/);
  if (match) {
    req.params.projectId = match[1];
    req.params.folderPath = decodeURIComponent(match[2]);
    return next();
  }
  
  // Match files pattern: /projectId/files/filePath
  match = path.match(/^\/([^\/]+)\/files\/(.+)$/);
  if (match) {
    req.params.projectId = match[1];
    const filePathPart = match[2];
    
    // Check if this is a metadata request
    if (filePathPart.endsWith('/metadata')) {
      req.params.filePath = decodeURIComponent(filePathPart.replace(/\/metadata$/, ''));
      req.params.isMetadata = 'true';
    } else {
      req.params.filePath = decodeURIComponent(filePathPart);
    }
    return next();
  }
  
  // If no match, continue to next handler
  next();
};

/**
 * Download file
 * GET /api/storage/:projectId/download/...
 */
router.get(
  /^\/([^\/]+)\/download\/.+$/,
  handleWildcardPath,
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.downloadFile
);

/**
 * Delete file
 * DELETE /api/storage/:projectId/files/...
 */
router.delete(
  /^\/([^\/]+)\/files\/.+$/,
  handleWildcardPath,
  authenticateAndAttachUser,
  verifyProjectAccess,
  (req: Request, res: Response, next: NextFunction) => {
    // Skip if this is a metadata request
    if (req.params.isMetadata) {
      return next('route');
    }
    next();
  },
  StorageController.deleteFile
);

/**
 * Get file metadata
 * GET /api/storage/:projectId/files/.../metadata
 */
router.get(
  /^\/([^\/]+)\/files\/.+\/metadata$/,
  handleWildcardPath,
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.getFileMetadata
);

/**
 * Delete folder
 * DELETE /api/storage/:projectId/folders/:folderPath
 */
router.delete(
  /^\/([^\/]+)\/folders\/.+$/,
  handleWildcardPath,
  authenticateAndAttachUser,
  verifyProjectAccess,
  StorageController.deleteFolder
);

export { router };

