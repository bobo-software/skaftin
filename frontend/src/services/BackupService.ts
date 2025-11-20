import ApiRoutes from '../constants/ApiRoutes';
import RequestUtils from '../utils/RequestUtils';

export interface BackupMetadata {
  id: string;
  name: string;
  projectId: number;
  createdAt: string;
  size: number;
  type: 'database' | 'full';
  description?: string;
}

class BackupService {
  /**
   * Create a new backup
   */
  static async createBackup(
    projectId: string,
    name?: string,
    description?: string,
    type: 'database' | 'full' = 'database'
  ): Promise<{ success: boolean; data?: BackupMetadata; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.BACKUPS.CREATE(projectId),
        token,
        { name, description, type }
      );
      
      return result;
    } catch (error: any) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message || 'Failed to create backup' };
    }
  }

  /**
   * List all backups for a project
   */
  static async listBackups(projectId: string): Promise<{ success: boolean; data?: BackupMetadata[]; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.BACKUPS.LIST(projectId),
        token
      );
      
      return result;
    } catch (error: any) {
      console.error('Error listing backups:', error);
      return { success: false, error: error.message || 'Failed to list backups' };
    }
  }

  /**
   * Download a backup file
   */
  static async downloadBackup(projectId: string, backupId: string): Promise<void> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      // Extract just the filename from the backupId (backupId format: backups/3/filename.sql)
      const filename = backupId.split('/').pop() || 'backup.sql';
      // URL encode just the filename
      const encodedFilename = encodeURIComponent(filename);
      const url = ApiRoutes.BACKUPS.DOWNLOAD(projectId, encodedFilename);
      
      // Create a temporary link and trigger download
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token && token !== 'session-managed-by-supertokens' ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download backup');
      }

      // Get filename from Content-Disposition header or use backup ID
      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename = 'backup.sql';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      throw error;
    }
  }

  /**
   * Restore a backup
   */
  static async restoreBackup(
    projectId: string,
    backupId: string,
    dropExisting: boolean = false
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      // Extract just the filename from the backupId
      const filename = backupId.split('/').pop() || 'backup.sql';
      const encodedFilename = encodeURIComponent(filename);
      const result = await RequestUtils.post(
        ApiRoutes.BACKUPS.RESTORE(projectId, encodedFilename),
        token,
        { dropExisting }
      );
      
      return result;
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      return { success: false, error: error.message || 'Failed to restore backup' };
    }
  }

  /**
   * Delete a backup
   */
  static async deleteBackup(projectId: string, backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      // Extract just the filename from the backupId
      const filename = backupId.split('/').pop() || 'backup.sql';
      const encodedFilename = encodeURIComponent(filename);
      const result = await RequestUtils.delete(
        ApiRoutes.BACKUPS.DELETE(projectId, encodedFilename),
        token,
        {}
      );
      
      return result;
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      return { success: false, error: error.message || 'Failed to delete backup' };
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * List backup schedules
   */
  static async listBackupSchedules(projectId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.BACKUPS.LIST_SCHEDULES(projectId),
        token
      );
      return result;
    } catch (error: any) {
      console.error('Error listing backup schedules:', error);
      return { success: false, error: error.message || 'Failed to list backup schedules' };
    }
  }

  /**
   * Create backup schedule
   */
  static async createBackupSchedule(
    projectId: string,
    data: {
      name: string;
      description?: string;
      schedule: string;
      backupNamePrefix?: string;
      retentionDays?: number;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.BACKUPS.CREATE_SCHEDULE(projectId),
        token,
        data
      );
      return result;
    } catch (error: any) {
      console.error('Error creating backup schedule:', error);
      return { success: false, error: error.message || 'Failed to create backup schedule' };
    }
  }

  /**
   * Update backup schedule
   */
  static async updateBackupSchedule(
    projectId: string,
    scheduleId: number,
    data: {
      name?: string;
      description?: string;
      schedule?: string;
      backupNamePrefix?: string;
      retentionDays?: number;
      enabled?: boolean;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.put(
        ApiRoutes.BACKUPS.UPDATE_SCHEDULE(projectId, scheduleId),
        token,
        data
      );
      return result;
    } catch (error: any) {
      console.error('Error updating backup schedule:', error);
      return { success: false, error: error.message || 'Failed to update backup schedule' };
    }
  }

  /**
   * Delete backup schedule
   */
  static async deleteBackupSchedule(projectId: string, scheduleId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.delete(
        ApiRoutes.BACKUPS.DELETE_SCHEDULE(projectId, scheduleId),
        token,
        {}
      );
      return result;
    } catch (error: any) {
      console.error('Error deleting backup schedule:', error);
      return { success: false, error: error.message || 'Failed to delete backup schedule' };
    }
  }
}

export default BackupService;

