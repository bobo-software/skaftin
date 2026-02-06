import { Pool } from 'pg';

/**
 * Service for cleaning up old request logs based on retention settings
 * Runs daily via cron job to delete logs older than the configured retention period
 * 
 * Uses public.skaftin_system_request_logs table with project_id column
 */
export class RequestLogsCleanupService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get retention days based on retention setting
   */
  private getRetentionDays(retention: string): number | null {
    switch (retention) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'monthly':
        return 30;
      case 'disabled':
        return null; // No cleanup, logging disabled
      default:
        return 7; // Default to weekly
    }
  }

  /**
   * Process cleanup for all projects
   * Reads retention settings and deletes old logs accordingly
   */
  async cleanupAllProjects(): Promise<{ processed: number; deleted: number; errors: number }> {
    let processed = 0;
    let deleted = 0;
    let errors = 0;

    try {
      console.log('🧹 [RequestLogsCleanupService] Starting scheduled request logs cleanup...');

      // Get all projects with their retention settings
      const projectsResult = await this.pool.query(`
        SELECT 
          p.id as project_id,
          p.name as project_name,
          COALESCE(s.settings_json->>'request_log_retention', 'weekly') as retention,
          COALESCE((s.settings_json->>'request_logging_enabled')::boolean, false) as logging_enabled
        FROM skaftin_system_projects p
        LEFT JOIN skaftin_system_auth_settings s ON s.project_id = p.id
      `);

      console.log(`   └─ Found ${projectsResult.rows.length} project(s)`);

      // Process each project
      for (const project of projectsResult.rows) {
        const { project_id, project_name, retention, logging_enabled } = project;

        try {
          const retentionDays = this.getRetentionDays(retention);

          // If logging is disabled, delete all logs for this project
          if (retention === 'disabled' || !logging_enabled) {
            const deleteResult = await this.pool.query(
              `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1`,
              [project_id]
            );
            
            const deletedCount = deleteResult.rowCount || 0;
            deleted += deletedCount;
            processed++;
            
            if (deletedCount > 0) {
              console.log(`   └─ Project ${project_name} (ID: ${project_id}): Deleted ${deletedCount} logs (logging disabled)`);
            }
            continue;
          }

          if (!retentionDays) {
            continue;
          }

          const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

          // Delete logs older than retention period
          const deleteResult = await this.pool.query(
            `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at < $2`,
            [project_id, cutoffDate]
          );

          const deletedCount = deleteResult.rowCount || 0;
          deleted += deletedCount;
          processed++;

          if (deletedCount > 0) {
            console.log(`   └─ Project ${project_name} (ID: ${project_id}): Deleted ${deletedCount} logs older than ${retentionDays} days`);
          }

        } catch (projectError: any) {
          console.error(`   └─ Error processing project ${project_name} (ID: ${project_id}):`, projectError.message);
          errors++;
        }
      }

      console.log(`🧹 [RequestLogsCleanupService] Cleanup complete:`);
      console.log(`   └─ Projects processed: ${processed}`);
      console.log(`   └─ Total logs deleted: ${deleted}`);
      console.log(`   └─ Errors: ${errors}`);

      return { processed, deleted, errors };

    } catch (error: any) {
      console.error('❌ [RequestLogsCleanupService] Critical error during cleanup:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup logs for a specific project
   * Can be called manually or for project-specific cleanup
   */
  async cleanupProject(projectId: number): Promise<{ deleted: number }> {
    try {
      console.log(`🧹 [RequestLogsCleanupService] Cleaning up logs for project ${projectId}...`);

      // Get project retention settings
      const result = await this.pool.query(`
        SELECT 
          p.name as project_name,
          COALESCE(s.settings_json->>'request_log_retention', 'weekly') as retention
        FROM skaftin_system_projects p
        LEFT JOIN skaftin_system_auth_settings s ON s.project_id = p.id
        WHERE p.id = $1
      `, [projectId]);

      if (result.rows.length === 0) {
        console.log(`   └─ Project ${projectId} not found`);
        return { deleted: 0 };
      }

      const { project_name, retention } = result.rows[0];
      const retentionDays = this.getRetentionDays(retention);

      if (retention === 'disabled') {
        // Delete all logs when logging is disabled
        const deleteResult = await this.pool.query(
          `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1`,
          [projectId]
        );
        
        console.log(`   └─ Deleted ${deleteResult.rowCount} logs (logging disabled)`);
        return { deleted: deleteResult.rowCount || 0 };
      }

      if (!retentionDays) {
        console.log(`   └─ Invalid retention setting for project ${project_name}`);
        return { deleted: 0 };
      }

      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Delete old logs
      const deleteResult = await this.pool.query(
        `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at < $2`,
        [projectId, cutoffDate]
      );

      const deleted = deleteResult.rowCount || 0;
      console.log(`   └─ Deleted ${deleted} logs older than ${retentionDays} days from ${project_name}`);

      return { deleted };

    } catch (error: any) {
      console.error(`❌ [RequestLogsCleanupService] Error cleaning up project ${projectId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get stats about stored logs for all projects
   */
  async getLogsStats(): Promise<{ projects: Array<{ projectId: number; projectName: string; logCount: number; oldestLog: Date | null; newestLog: Date | null }> }> {
    try {
      const statsResult = await this.pool.query(`
        SELECT 
          p.id as project_id,
          p.name as project_name,
          COUNT(r.id) as log_count,
          MIN(r.created_at) as oldest_log,
          MAX(r.created_at) as newest_log
        FROM skaftin_system_projects p
        LEFT JOIN public.skaftin_system_request_logs r ON r.project_id = p.id
        GROUP BY p.id, p.name
        ORDER BY p.id
      `);

      return {
        projects: statsResult.rows.map((row: any) => ({
          projectId: row.project_id,
          projectName: row.project_name,
          logCount: parseInt(row.log_count) || 0,
          oldestLog: row.oldest_log,
          newestLog: row.newest_log
        }))
      };

    } catch (error: any) {
      console.error('❌ [RequestLogsCleanupService] Error getting logs stats:', error.message);
      throw error;
    }
  }
}
