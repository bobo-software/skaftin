/**
 * Utility functions for path pattern matching
 */

export interface PathMatchResult {
  projectId?: string;
  filePath?: string;
  folderPath?: string;
  isMetadata?: boolean;
}

/**
 * Match download pattern
 */
export function matchDownloadPattern(path: string, isAdmin: boolean): PathMatchResult | null {
  if (isAdmin) {
    const match = path.match(/^\/(\d+)\/download\/(.+)$/);
    if (match) {
      return {
        projectId: match[1],
        filePath: decodeURIComponent(match[2]),
      };
    }
  } else {
    const match = path.match(/^\/download\/(.+)$/);
    if (match) {
      return {
        filePath: decodeURIComponent(match[1]),
      };
    }
  }
  return null;
}

/**
 * Match folders pattern
 */
export function matchFoldersPattern(path: string, isAdmin: boolean): PathMatchResult | null {
  if (isAdmin) {
    const match = path.match(/^\/(\d+)\/folders\/(.+)$/);
    if (match) {
      return {
        projectId: match[1],
        folderPath: decodeURIComponent(match[2]),
      };
    }
  } else {
    const match = path.match(/^\/folders\/(.+)$/);
    if (match) {
      return {
        folderPath: decodeURIComponent(match[1]),
      };
    }
  }
  return null;
}

/**
 * Match files pattern (including metadata)
 */
export function matchFilesPattern(path: string, isAdmin: boolean): PathMatchResult | null {
  if (isAdmin) {
    const match = path.match(/^\/(\d+)\/files\/(.+)$/);
    if (match) {
      const projectId = match[1];
      const filePathPart = match[2];
      
      // Check if this is a metadata request
      if (filePathPart.endsWith('/metadata')) {
        return {
          projectId,
          filePath: decodeURIComponent(filePathPart.replace(/\/metadata$/, '')),
          isMetadata: true,
        };
      } else {
        return {
          projectId,
          filePath: decodeURIComponent(filePathPart),
        };
      }
    }
  } else {
    const match = path.match(/^\/files\/(.+)$/);
    if (match) {
      const filePathPart = match[1];
      
      // Check if this is a metadata request
      if (filePathPart.endsWith('/metadata')) {
        return {
          filePath: decodeURIComponent(filePathPart.replace(/\/metadata$/, '')),
          isMetadata: true,
        };
      } else {
        return {
          filePath: decodeURIComponent(filePathPart),
        };
      }
    }
  }
  return null;
}

/**
 * Match any storage pattern (download, folders, files)
 */
export function matchStoragePattern(path: string, isAdmin: boolean): PathMatchResult | null {
  return (
    matchDownloadPattern(path, isAdmin) ||
    matchFoldersPattern(path, isAdmin) ||
    matchFilesPattern(path, isAdmin) ||
    null
  );
}

