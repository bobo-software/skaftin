import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4005';

export interface Backup {
  id: string;
  name: string;
  projectId: number;
  createdAt: string;
  size: number;
  type: 'database' | 'full';
  description?: string;
}

export interface BackupSchedule {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  schedule: string;
  backup_name_prefix?: string;
  retention_days?: number;
  backup_type?: 'database' | 'full';
  retention_policy?: 'keep_all' | 'keep_count' | 'keep_days';
  retention_value?: number;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

class BackupService {
  /**
   * Create a database backup (schema only)
   */
  static async createDatabaseBackup(
    projectId: number,
    name?: string,
    description?: string
  ): Promise<{ success: boolean; backup?: Backup; error?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE}/api/backups/${projectId}/create`,
        { name, description, type: 'database' },
        { withCredentials: true }
      );
      return { success: true, backup: response.data.data };
    } catch (error: any) {
      console.error('Error creating database backup:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create backup',
      };
    }
  }

  /**
   * Create a full backup (schema + system settings)
   */
  static async createFullBackup(
    projectId: number,
    name?: string,
    description?: string
  ): Promise<{ success: boolean; backup?: Backup; error?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE}/api/backups/${projectId}/full`,
        { name, description },
        { withCredentials: true }
      );
      return { success: true, backup: response.data.data };
    } catch (error: any) {
      console.error('Error creating full backup:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create full backup',
      };
    }
  }

  /**
   * List all backups for a project
   */
  static async listBackups(projectId: number): Promise<{ success: boolean; backups?: Backup[]; error?: string }> {
    try {
      const response = await axios.get(
        `${API_BASE}/api/backups/${projectId}/list`,
        { withCredentials: true }
      );
      return { success: true, backups: response.data.data };
    } catch (error: any) {
      console.error('Error listing backups:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to list backups',
      };
    }
  }

  /**
   * Download a backup file
   */
  static async downloadBackup(projectId: number, backupId: string): Promise<void> {
    try {
      const filename = backupId.split('/').pop();
      const response = await axios.get(
        `${API_BASE}/api/backups/${projectId}/${encodeURIComponent(filename!)}/ download`,
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'backup.sql');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to download backup');
    }
  }

  /**
   * Restore a backup to create a new project
   */
  static async restoreBackup(
    backupId: string,
    newProjectName: string,
    organizationId: number
  ): Promise<{ success: boolean; project?: any; error?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE}/api/backups/restore`,
        { backupId, newProjectName, organizationId },
        { withCredentials: true }
      );
      return { success: true, project: response.data.data };
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to restore backup',
      };
    }
  }

  /**
   * Delete a backup
   */
  static async deleteBackup(
    projectId: number,
    backupId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const filename = backupId.split('/').pop();
      await axios.delete(
        `${API_BASE}/api/backups/${projectId}/${encodeURIComponent(filename!)}`,
        { withCredentials: true }
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to delete backup',
      };
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  static async cleanupOldBackups(
    projectId: number,
    retentionPolicy: 'keep_count' | 'keep_days',
    retentionValue: number
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE}/api/backups/${projectId}/cleanup`,
        { retentionPolicy, retentionValue },
        { withCredentials: true }
      );
      return { success: true, deletedCount: response.data.data.deletedCount };
    } catch (error: any) {
      console.error('Error cleaning up backups:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to cleanup backups',
      };
    }
  }

  /**
   * List backup schedules for a project
   */
  static async listSchedules(projectId: number): Promise<{ success: boolean; schedules?: BackupSchedule[]; error?: string }> {
    try {
      const response = await axios.get(
        `${API_BASE}/api/backups/${projectId}/schedules`,
        { withCredentials: true }
      );
      return { success: true, schedules: response.data.data };
    } catch (error: any) {
      console.error('Error listing backup schedules:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to list schedules',
      };
    }
  }

  /**
   * Create a backup schedule
   */
  static async createSchedule(
    projectId: number,
    schedule: {
      name: string;
      description?: string;
      schedule: string;
      backupNamePrefix?: string;
      retentionDays?: number;
      backupType?: 'database' | 'full';
      retentionPolicy?: 'keep_all' | 'keep_count' | 'keep_days';
      retentionValue?: number;
    }
  ): Promise<{ success: boolean; schedule?: BackupSchedule; error?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE}/api/backups/${projectId}/schedules`,
        schedule,
        { withCredentials: true }
      );
      return { success: true, schedule: response.data.data };
    } catch (error: any) {
      console.error('Error creating backup schedule:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create schedule',
      };
    }
  }

  /**
   * Update a backup schedule
   */
  static async updateSchedule(
    projectId: number,
    scheduleId: number,
    updates: {
      name?: string;
      description?: string;
      schedule?: string;
      backupNamePrefix?: string;
      retentionDays?: number;
      backupType?: 'database' | 'full';
      retentionPolicy?: 'keep_all' | 'keep_count' | 'keep_days';
      retentionValue?: number;
      enabled?: boolean;
    }
  ): Promise<{ success: boolean; schedule?: BackupSchedule; error?: string }> {
    try {
      const response = await axios.put(
        `${API_BASE}/api/backups/${projectId}/schedules/${scheduleId}`,
        updates,
        { withCredentials: true }
      );
      return { success: true, schedule: response.data.data };
    } catch (error: any) {
      console.error('Error updating backup schedule:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update schedule',
      };
    }
  }

  /**
   * Delete a backup schedule
   */
  static async deleteSchedule(
    projectId: number,
    scheduleId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await axios.delete(
        `${API_BASE}/api/backups/${projectId}/schedules/${scheduleId}`,
        { withCredentials: true }
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting backup schedule:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to delete schedule',
      };
    }
  }
}

export default BackupService;
