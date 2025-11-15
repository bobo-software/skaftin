import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import StorageController from '../controllers/StorageController';
import { authenticateAndVerifyProject } from '../middleware/supertokensAuthMiddleware';

const router = Router();

// Configure multer for multipart file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Custom middleware to handle wildcard file paths for admin routes
const handleWildcardPath = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  // Match download pattern: /:projectId/download/filePath
  let match = path.match(/^\/(\d+)\/download\/(.+)$/);
  if (match) {
    req.params.projectId = match[1];
    req.params.filePath = decodeURIComponent(match[2]);
    return next();
  }
  
  // Match folders pattern: /:projectId/folders/folderPath
  match = path.match(/^\/(\d+)\/folders\/(.+)$/);
  if (match) {
    req.params.projectId = match[1];
    req.params.folderPath = decodeURIComponent(match[2]);
    return next();
  }
  
  // Match files pattern: /:projectId/files/filePath
  match = path.match(/^\/(\d+)\/files\/(.+)$/);
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
  
  next();
};

// ============================================================================
// PROJECT-BASED FILE ROUTES (Admin API - SuperTokens authentication)
// Project ID is provided in the URL path: /api/storage/:projectId/...
// ============================================================================

/**
 * List files in a project bucket
 * GET /api/storage/:projectId/files?prefix=&maxKeys=1000
 */
router.get('/:projectId/files', authenticateAndVerifyProject, StorageController.listFiles);

/**
 * Search files in a project bucket
 * POST /api/storage/:projectId/search
 * Body: { query: string, fileType?: string, dateRange?: { start: string, end: string } }
 */
router.post('/:projectId/search', authenticateAndVerifyProject, StorageController.searchFiles);

/**
 * Upload file (base64 encoded)
 * POST /api/storage/:projectId/upload
 * Body: { filePath: string, fileContent: string (base64), contentType?: string, metadata?: object }
 */
router.post('/:projectId/upload', authenticateAndVerifyProject, StorageController.uploadFile);

/**
 * Upload file (multipart form data)
 * POST /api/storage/:projectId/upload-multipart
 * Form data: file (file field)
 */
router.post('/:projectId/upload-multipart', authenticateAndVerifyProject, upload.single('file'), StorageController.uploadFileMultipart);

/**
 * Rename folder
 * PUT /api/storage/:projectId/folders/rename
 */
router.put('/:projectId/folders/rename', authenticateAndVerifyProject, StorageController.renameFolder);

/**
 * Download file
 * GET /api/storage/:projectId/download/...
 */
router.get(
  /^\/\d+\/download\/.+$/,
  handleWildcardPath,
  authenticateAndVerifyProject,
  StorageController.downloadFile
);

/**
 * Delete file
 * DELETE /api/storage/:projectId/files/...
 */
router.delete(
  /^\/\d+\/files\/.+$/,
  handleWildcardPath,
  authenticateAndVerifyProject,
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
  /^\/\d+\/files\/.+\/metadata$/,
  handleWildcardPath,
  authenticateAndVerifyProject,
  StorageController.getFileMetadata
);

/**
 * Delete folder
 * DELETE /api/storage/:projectId/folders/:folderPath
 */
router.delete(
  /^\/\d+\/folders\/.+$/,
  handleWildcardPath,
  authenticateAndVerifyProject,
  StorageController.deleteFolder
);

export { router as AdminStorageRouter };

