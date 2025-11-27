import { Request, Response, NextFunction } from 'express';
import { RouteDefinition, Middleware } from '../registry/types';
import StorageController from '../../controllers/StorageController';
import multer from 'multer';
import { matchStoragePattern } from '../utils/pathPatternUtils';

/**
 * Configure multer for multipart file uploads
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

/**
 * Middleware to handle wildcard file paths
 * Extracts filePath, folderPath from URL patterns
 */
export function createWildcardPathHandler(isAdmin: boolean): Middleware {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const match = matchStoragePattern(path, isAdmin);
    
    if (match) {
      // Apply matched values to request params
      if (match.projectId) {
        req.params.projectId = match.projectId;
      }
      if (match.bucketName) {
        req.params.bucketName = match.bucketName;
      }
      if (match.filePath) {
        req.params.filePath = match.filePath;
      }
      if (match.folderPath) {
        req.params.folderPath = match.folderPath;
      }
      if (match.isMetadata) {
        req.params.isMetadata = 'true';
      }
      return next();
    }
    
    // If no match, continue to next handler
    next();
  };
}

/**
 * Middleware to skip metadata requests when handling delete
 */
export const skipMetadataHandler: Middleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip if this is a metadata request
  if (req.params.isMetadata) {
    return next('route');
  }
  next();
};

/**
 * Shared storage route definitions
 * These can be used by both admin and client routers with different middleware
 */
export function createStorageRouteDefinitions(isAdmin: boolean): RouteDefinition[] {
  const wildcardHandler = createWildcardPathHandler(isAdmin);

  return [
    // ============================================================================
    // BUCKET ROUTES
    // ============================================================================

    {
      method: 'get',
      path: '/buckets',
      handler: StorageController.listBuckets,
      description: 'List buckets for a project',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // FILE ROUTES (Simple paths - require bucketName)
    // ============================================================================

    {
      method: 'get',
      path: '/:bucketName/files',
      handler: StorageController.listFiles,
      description: 'List files in a project bucket',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/:bucketName/search',
      handler: StorageController.searchFiles,
      description: 'Search files in a project bucket',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/:bucketName/upload',
      handler: StorageController.uploadFile,
      description: 'Upload file (base64 encoded)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/:bucketName/upload-multipart',
      handler: StorageController.uploadFileMultipart,
      description: 'Upload file (multipart form data)',
      requiresProject: true,
      requiresAuth: true,
      middleware: [upload.single('file') as any],
    },
    {
      method: 'post',
      path: '/files',
      handler: StorageController.uploadFileFromForm,
      description: 'Upload file (multipart form data with bucket and path in form)',
      requiresProject: false,
      requiresAuth: true,
      middleware: [upload.single('file') as any],
    },
    {
      method: 'delete',
      path: '/files',
      handler: StorageController.deleteFileFromBody,
      description: 'Delete file (bucket and path in request body)',
      requiresProject: false,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/files/download',
      handler: StorageController.downloadFileFromQuery,
      description: 'Download file (bucket and path as query parameters)',
      requiresProject: false,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/:bucketName/folders/rename',
      handler: StorageController.renameFolder,
      description: 'Rename folder',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // FILE ROUTES (Wildcard paths - use regex)
    // ============================================================================

    {
      method: 'get',
      path: isAdmin ? /^\/\d+\/([^\/]+)\/download\/(.+)$/ : /^\/([^\/]+)\/download\/(.+)$/,
      handler: StorageController.downloadFile,
      description: 'Download file',
      requiresProject: true,
      requiresAuth: true,
      middleware: [wildcardHandler],
    },
    {
      method: 'delete',
      path: isAdmin ? /^\/\d+\/([^\/]+)\/files\/(.+)$/ : /^\/([^\/]+)\/files\/(.+)$/,
      handler: StorageController.deleteFile,
      description: 'Delete file',
      requiresProject: true,
      requiresAuth: true,
      middleware: [wildcardHandler, skipMetadataHandler],
    },
    {
      method: 'get',
      path: isAdmin ? /^\/\d+\/([^\/]+)\/files\/(.+)\/metadata$/ : /^\/([^\/]+)\/files\/(.+)\/metadata$/,
      handler: StorageController.getFileMetadata,
      description: 'Get file metadata',
      requiresProject: true,
      requiresAuth: true,
      middleware: [wildcardHandler],
    },
    {
      method: 'delete',
      path: isAdmin ? /^\/\d+\/([^\/]+)\/folders\/(.+)$/ : /^\/([^\/]+)\/folders\/(.+)$/,
      handler: StorageController.deleteFolder,
      description: 'Delete folder',
      requiresProject: true,
      requiresAuth: true,
      middleware: [wildcardHandler],
    },
  ];
}


