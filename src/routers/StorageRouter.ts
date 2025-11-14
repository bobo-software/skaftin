import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import StorageController from '../controllers/StorageController';
import { authenticateAndAttachUser } from '../middleware/supertokensAuthMiddleware';
import { verifyProjectAccess } from '../middleware/authMiddleware';
import { extractProjectFromCredentials } from '../middleware/appUserAuthMiddleware';
import { Pool } from 'pg';

export function createStorageRouter(pool: Pool): Router {
  const router = Router();

// Configure multer for multipart file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// ============================================================================
// BUCKET ROUTES
// ============================================================================

/**
 * List buckets
 * GET /api/storage/buckets?includeStats=false
 * 
 * - Platform admin (SuperTokens): Can see all buckets
 * - Client app (API key): Only sees their project's bucket
 */
const projectExtractor = extractProjectFromCredentials(pool);

// Middleware to optionally authenticate (allows both API key and SuperTokens)
const optionalAuth = async (req: any, res: Response, next: NextFunction) => {
  // If projectId is already set (from API key), skip SuperTokens auth
  if (req.projectId) {
    return next();
  }
  // Otherwise, try SuperTokens auth (for platform admin)
  // authenticateAndAttachUser is an array, so apply each middleware
  for (const middleware of authenticateAndAttachUser) {
    await new Promise<void>((resolve, reject) => {
      middleware(req, res, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  return next();
};

router.get('/buckets', projectExtractor, optionalAuth, StorageController.listBuckets);

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
// Project ID is extracted from API key automatically, or can be provided in URL for SuperTokens
// ============================================================================

/**
 * List files in a project bucket
 * GET /app-api/storage/files?prefix=&maxKeys=1000
 */
router.get(
  '/files',
  projectExtractor,
  optionalAuth,
  verifyProjectAccess,
  StorageController.listFiles
);

/**
 * Search files in a project bucket
 * POST /app-api/storage/search
 * Body: { query: string, fileType?: string, dateRange?: { start: string, end: string } }
 */
router.post(
  '/search',
  projectExtractor,
  optionalAuth,
  verifyProjectAccess,
  StorageController.searchFiles
);

/**
 * Upload file (base64 encoded)
 * POST /app-api/storage/upload
 * Body: { filePath: string, fileContent: string (base64), contentType?: string, metadata?: object }
 */
router.post(
  '/upload',
  projectExtractor,
  optionalAuth,
  verifyProjectAccess,
  StorageController.uploadFile
);

/**
 * Upload file (multipart form data)
 * POST /app-api/storage/upload-multipart
 * Form data: file (file field)
 */
router.post(
  '/upload-multipart',
  projectExtractor,
  optionalAuth,
  verifyProjectAccess,
  upload.single('file'),
  StorageController.uploadFileMultipart
);

/**
 * Rename folder
 * PUT /app-api/storage/folders/rename
 */
router.put(
  '/folders/rename',
  projectExtractor,
  optionalAuth,
  verifyProjectAccess,
  StorageController.renameFolder
);

/**
 * Custom middleware to handle wildcard file paths
 * Extracts filePath from the URL (projectId comes from API key via middleware)
 */
const handleWildcardPath = (req: Request & { projectId?: number }, res: Response, next: NextFunction) => {
  // Parse the path after /app-api/storage/
  // req.path is relative to the router mount point (e.g., /download/file.png)
  const path = req.path;
  
  // Match download pattern: /download/filePath
  let match = path.match(/^\/download\/(.+)$/);
  if (match) {
    req.params.filePath = decodeURIComponent(match[1]);
    return next();
  }
  
  // Match folders pattern: /folders/folderPath
  match = path.match(/^\/folders\/(.+)$/);
  if (match) {
    req.params.folderPath = decodeURIComponent(match[1]);
    return next();
  }
  
  // Match files pattern: /files/filePath
  match = path.match(/^\/files\/(.+)$/);
  if (match) {
    const filePathPart = match[1];
    
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
 * GET /app-api/storage/download/...
 */
router.get(
  /^\/download\/.+$/,
  projectExtractor,
  handleWildcardPath,
  optionalAuth,
  verifyProjectAccess,
  StorageController.downloadFile
);

/**
 * Delete file
 * DELETE /app-api/storage/files/...
 */
router.delete(
  /^\/files\/.+$/,
  projectExtractor,
  handleWildcardPath,
  optionalAuth,
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
 * GET /app-api/storage/files/.../metadata
 */
router.get(
  /^\/files\/.+\/metadata$/,
  projectExtractor,
  handleWildcardPath,
  optionalAuth,
  verifyProjectAccess,
  StorageController.getFileMetadata
);

/**
 * Delete folder
 * DELETE /app-api/storage/folders/:folderPath
 */
router.delete(
  /^\/folders\/.+$/,
  projectExtractor,
  handleWildcardPath,
  optionalAuth,
  verifyProjectAccess,
  StorageController.deleteFolder
);

  return router;
}

