import ApiRoutes from '../constants/ApiRoutes';
import RequestUtils from '../utils/RequestUtils';

class StorageService {
  /**
   * List files in a project bucket
   */
  static async listFiles(projectId: string, prefix?: string, maxKeys: number = 1000): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const params = new URLSearchParams();
      if (prefix) params.append('prefix', prefix);
      params.append('maxKeys', maxKeys.toString());
      
      const url = `${ApiRoutes.STORAGE.LIST_FILES}?${params.toString()}`;
      const result = await RequestUtils.get(url, token);
      
      return result;
    } catch (error) {
      console.error('Error listing files:', error);
      return { success: false, error: 'Failed to list files' };
    }
  }

  /**
   * Search files in a project bucket
   */
  static async searchFiles(
    projectId: string, 
    query: string, 
    fileType?: string, 
    dateRange?: { start: string; end: string }
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.STORAGE.SEARCH_FILES,
        token,
        { query, fileType, dateRange }
      );
      
      return result;
    } catch (error) {
      console.error('Error searching files:', error);
      return { success: false, error: 'Failed to search files' };
    }
  }

  /**
   * Upload file (base64 upload for custom paths)
   */
  static async uploadFile(projectId: string, filePath: string, file: File): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      
      // Convert file to base64
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const result = await RequestUtils.post(
        ApiRoutes.STORAGE.UPLOAD_FILE,
        token,
        { 
          filePath, 
          fileContent: base64Content, 
          contentType: file.type || 'application/octet-stream',
          metadata: {
            originalName: file.name,
            size: file.size.toString()
          }
        }
      );
      
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: 'Failed to upload file' };
    }
  }

  /**
   * Upload file (multipart form data) - for backward compatibility
   */
  static async uploadFileMultipart(projectId: string, file: File): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(ApiRoutes.STORAGE.UPLOAD_FILE_MULTIPART, {
        method: 'POST',
        headers: {
          ...(token && token !== 'session-managed-by-supertokens' ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: 'Failed to upload file' };
    }
  }

  /**
   * Upload file with custom path (base64)
   */
  static async uploadFileWithPath(
    projectId: string, 
    filePath: string, 
    fileContent: string, 
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.STORAGE.UPLOAD_FILE,
        token,
        { filePath, fileContent, contentType, metadata }
      );
      
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: 'Failed to upload file' };
    }
  }

  /**
   * Download file (returns URL, component handles opening)
   */
  static async downloadFile(projectId: string, filePath: string): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const url = `${ApiRoutes.STORAGE.DOWNLOAD_FILE(filePath)}?returnUrl=true`;
      const result = await RequestUtils.get(url, token);
      
      return result;
    } catch (error) {
      console.error('Error downloading file:', error);
      return { success: false, error: 'Failed to download file' };
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(projectId: string, filePath: string): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.delete(
        ApiRoutes.STORAGE.DELETE_FILE(filePath),
        token,
        {}
      );
      
      return result;
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: 'Failed to delete file' };
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(projectId: string, filePath: string): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.STORAGE.GET_FILE_METADATA(filePath),
        token
      );
      
      return result;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return { success: false, error: 'Failed to get file metadata' };
    }
  }

  /**
   * Create folder by uploading a marker file
   */
  static async createFolder(projectId: string, folderPath: string): Promise<any> {
    try {
      // Create folder by uploading an empty .folder marker file
      const markerPath = `${folderPath}/.folder`;
      const result = await this.uploadFileWithPath(
        projectId,
        markerPath,
        '', // Empty base64 content
        'application/x-directory',
        { type: 'folder_marker' }
      );
      
      return result;
    } catch (error) {
      console.error('Error creating folder:', error);
      return { success: false, error: 'Failed to create folder' };
    }
  }

  /**
   * Rename folder
   */
  static async renameFolder(projectId: string, oldPath: string, newPath: string): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.put(
        ApiRoutes.STORAGE.RENAME_FOLDER,
        token,
        { oldPath, newPath }
      );
      
      return result;
    } catch (error) {
      console.error('Error renaming folder:', error);
      return { success: false, error: 'Failed to rename folder' };
    }
  }

  /**
   * Delete folder and all its contents
   */
  static async deleteFolder(projectId: string, folderPath: string): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.delete(
        ApiRoutes.STORAGE.DELETE_FOLDER(folderPath),
        token,
        {}
      );
      
      return result;
    } catch (error) {
      console.error('Error deleting folder:', error);
      return { success: false, error: 'Failed to delete folder' };
    }
  }

  /**
   * List buckets
   */
  static async listBuckets(includeStats: boolean = false): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const url = `${ApiRoutes.STORAGE.LIST_BUCKETS}?includeStats=${includeStats}`;
      const result = await RequestUtils.get(url, token);
      
      return result;
    } catch (error) {
      console.error('Error listing buckets:', error);
      return { success: false, error: 'Failed to list buckets' };
    }
  }

  /**
   * Create bucket
   */
  static async createBucket(projectId: string, bucketName: string, region: string = 'us-east-1'): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.STORAGE.CREATE_BUCKET,
        token,
        { projectId, bucketName, region }
      );
      
      return result;
    } catch (error) {
      console.error('Error creating bucket:', error);
      return { success: false, error: 'Failed to create bucket' };
    }
  }

  /**
   * Delete bucket
   */
  static async deleteBucket(bucketName: string, force: boolean = false): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const url = `${ApiRoutes.STORAGE.DELETE_BUCKET(bucketName)}?force=${force}`;
      const result = await RequestUtils.delete(url, token, {});
      
      return result;
    } catch (error) {
      console.error('Error deleting bucket:', error);
      return { success: false, error: 'Failed to delete bucket' };
    }
  }
}

export default StorageService;

