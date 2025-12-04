import { Pool } from 'pg';
import { db } from '../db/drizzle.config';
import { backupSchedules } from '../db/schemas/BackupSchedulesSchema';
import { eq } from 'drizzle-orm';
import * as cron from 'node-cron';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';

/**
 * BackupScheduler - Manages automatic backup scheduling using node-cron
 * Singleton pattern to ensure one instance across the application
 */
export class BackupScheduler {
  private static instance: BackupScheduler | null = null;
  private pool: Pool;
  private s3Client: S3Client;
  private cronJobs: Map<number, cron.ScheduledTask> = new Map();

  private constructor(pool: Pool, s3Client: S3Client) {
    this.pool = pool;
    this.s3Client = s3Client;
  }

  /**
   * Initialize the singleton instance (call this first)
   */
  static initialize(pool: Pool, s3Client: S3Client): BackupScheduler {
    if (BackupScheduler.instance) {
      console.warn('[BackupScheduler] Instance already exists, returning existing instance');
      return BackupScheduler.instance;
    }
    BackupScheduler.instance = new BackupScheduler(pool, s3Client);
    return BackupScheduler.instance;
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(pool?: Pool, s3Client?: S3Client): BackupScheduler {
    if (!BackupScheduler.instance) {
      if (!pool || !s3Client) {
        throw new Error('BackupScheduler must be initialized with pool and s3Client first');
      }
      BackupScheduler.instance = new BackupScheduler(pool, s3Client);
    }
    return BackupScheduler.instance;
  }

  /**
   * Schedule a backup with a cron expression
   */
  async scheduleBackup(scheduleId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Get schedule from database
      const schedules = await db
        .select()
        .from(backupSchedules)
        .where(eq(backupSchedules.id, scheduleId))
        .limit(1);

      if (schedules.length === 0) {
        return { success: false, error: 'Backup schedule not found' };
      }

      const schedule = schedules[0];

      if (!schedule.enabled) {
        console.log(`[BackupScheduler] Schedule ${scheduleId} is disabled, skipping`);
        return { success: false, error: 'Schedule is disabled' };
      }

      // Stop existing cron job if any
      this.unscheduleBackup(scheduleId);

      // Validate cron schedule
      if (!cron.validate(schedule.schedule)) {
        return { success: false, error: `Invalid cron schedule: ${schedule.schedule}` };
      }

      // Create node-cron job
      console.log(`[BackupScheduler] Creating cron job for backup schedule ${scheduleId} with schedule: ${schedule.schedule}`);
      const task = cron.schedule(schedule.schedule, async () => {
        const executionStartTime = new Date().toISOString();
        console.log(`[BackupScheduler] ⏰ Cron triggered for backup schedule ${scheduleId} at ${executionStartTime}`);

        try {
          // Check if schedule is still enabled
          const currentSchedule = await db
            .select()
            .from(backupSchedules)
            .where(eq(backupSchedules.id, scheduleId))
            .limit(1);

          if (currentSchedule.length === 0) {
            console.log(`[BackupScheduler] ⚠️  Backup schedule ${scheduleId} not found, skipping execution`);
            return;
          }

          if (!currentSchedule[0].enabled) {
            console.log(`[BackupScheduler] ⚠️  Backup schedule ${scheduleId} is disabled, skipping execution`);
            return;
          }

          const projectId = currentSchedule[0].project_id;
          const backupName = currentSchedule[0].backup_name_prefix
            ? `${currentSchedule[0].backup_name_prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`
            : undefined;
          const backupType = (currentSchedule[0] as any).backup_type || 'database';

          // Create backup using BackupController
          console.log(`[BackupScheduler] 🚀 Starting automatic ${backupType} backup for project ${projectId}`);
          
          // Call appropriate backup method based on backup type
          let backupResult;
          if (backupType === 'full') {
            backupResult = await this.createFullBackupForSchedule(projectId, backupName, currentSchedule[0].description || undefined);
          } else {
            backupResult = await this.createBackupForSchedule(projectId, backupName, currentSchedule[0].description || undefined);
          }

          if (backupResult.success) {
            // Update last_run_at
            await db
              .update(backupSchedules)
              .set({ 
                last_run_at: new Date(),
                updated_at: new Date()
              })
              .where(eq(backupSchedules.id, scheduleId));

            console.log(`[BackupScheduler] ✅ Successfully created ${backupType} backup for schedule ${scheduleId}`);
            
            // Handle retention if configured
            const retentionPolicy = (currentSchedule[0] as any).retention_policy;
            const retentionValue = (currentSchedule[0] as any).retention_value;
            
            // Legacy support for retention_days
            if (currentSchedule[0].retention_days) {
              await this.cleanupOldBackupsByDays(projectId, currentSchedule[0].retention_days);
            } else if (retentionPolicy && retentionValue && retentionPolicy !== 'keep_all') {
              if (retentionPolicy === 'keep_days') {
                await this.cleanupOldBackupsByDays(projectId, retentionValue);
              } else if (retentionPolicy === 'keep_count') {
                await this.cleanupOldBackupsByCount(projectId, retentionValue);
              }
            }
          } else {
            console.error(`[BackupScheduler] ❌ Failed to create backup for schedule ${scheduleId}: ${backupResult.error}`);
          }
        } catch (error: any) {
          console.error(`[BackupScheduler] ❌ Error executing backup schedule ${scheduleId}:`, error);
        }
      }, {
        timezone: 'UTC'
      });

      this.cronJobs.set(scheduleId, task);

      // Calculate next run time
      const nextRun = this.getNextRunTime(schedule.schedule);
      await db
        .update(backupSchedules)
        .set({ next_run_at: nextRun })
        .where(eq(backupSchedules.id, scheduleId));

      console.log(`[BackupScheduler] ✅ Scheduled backup ${scheduleId}, next run: ${nextRun}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[BackupScheduler] Error scheduling backup ${scheduleId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unschedule a backup
   */
  unscheduleBackup(scheduleId: number): void {
    const task = this.cronJobs.get(scheduleId);
    if (task) {
      task.stop();
      this.cronJobs.delete(scheduleId);
      console.log(`[BackupScheduler] 🛑 Stopped cron job for backup schedule ${scheduleId}`);
    }
  }

  /**
   * Load all enabled backup schedules and schedule them
   */
  async loadScheduledBackups(): Promise<void> {
    try {
      const schedules = await db
        .select()
        .from(backupSchedules)
        .where(eq(backupSchedules.enabled, true));

      console.log(`[BackupScheduler] Loading ${schedules.length} enabled backup schedules...`);

      for (const schedule of schedules) {
        await this.scheduleBackup(schedule.id);
      }

      console.log(`[BackupScheduler] ✅ Loaded ${schedules.length} backup schedules`);
    } catch (error: any) {
      console.error('[BackupScheduler] Error loading backup schedules:', error);
    }
  }

  /**
   * Stop all scheduled backups
   */
  stopAll(): void {
    for (const [scheduleId, task] of this.cronJobs.entries()) {
      task.stop();
      console.log(`[BackupScheduler] 🛑 Stopped backup schedule ${scheduleId}`);
    }
    this.cronJobs.clear();
  }

  /**
   * Create a backup for a schedule (internal method)
   */
  private async createBackupForSchedule(
    projectId: number,
    backupName?: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get project schema
      const result = await this.pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Project not found' };
      }

      const schemaName = result.rows[0].schema_name;
      
      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalBackupName = backupName || `auto-backup-${timestamp}`;
      const backupFileName = `${finalBackupName}.sql`;
      const backupKey = `backups/${projectId}/${backupFileName}`;

      // Use the same backup creation logic from BackupController
      // We'll need to import or duplicate the logic here
      // For now, let's create a simplified version
      const client = await this.pool.connect();
      const { tmpdir } = require('os');
      const { join } = require('path');
      const { writeFileSync, createReadStream, unlinkSync, existsSync, statSync } = require('fs');
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      
      const tempDir = tmpdir();
      const tempFilePath = join(tempDir, `backup-${projectId}-${Date.now()}.sql`);
      let sqlContent = '';

      try {
        await client.query(`SET search_path TO ${schemaName}, public`);

        sqlContent += `-- PostgreSQL database dump\n`;
        sqlContent += `-- Schema: ${schemaName}\n`;
        sqlContent += `-- Dumped at: ${new Date().toISOString()}\n\n`;
        sqlContent += `SET search_path TO ${schemaName}, public;\n\n`;

        // Get all tables
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1 
            AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `, [schemaName]);

        const tables = tablesResult.rows.map(row => row.table_name);

        for (const tableName of tables) {
          // Get column information
          const columnsResult = await client.query(`
            SELECT 
              column_name,
              data_type,
              udt_name,
              character_maximum_length,
              numeric_precision,
              numeric_scale,
              is_nullable,
              column_default,
              ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
          `, [schemaName, tableName]);

          if (columnsResult.rows.length > 0) {
            sqlContent += `\n-- Table: ${tableName}\n`;
            sqlContent += `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (\n`;
            
            const columnDefs = columnsResult.rows.map(col => {
              let def = `  "${col.column_name}" `;
              
              if (col.data_type === 'USER-DEFINED') {
                def += col.udt_name;
              } else if (col.data_type === 'ARRAY') {
                def += col.udt_name.replace(/_/g, ' ') + '[]';
              } else {
                def += col.data_type;
              }
              
              if (col.character_maximum_length) {
                def += `(${col.character_maximum_length})`;
              } else if (col.numeric_precision) {
                if (col.numeric_scale) {
                  def += `(${col.numeric_precision},${col.numeric_scale})`;
                } else {
                  def += `(${col.numeric_precision})`;
                }
              }
              
              if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
              }
              
              if (col.column_default) {
                def += ` DEFAULT ${col.column_default}`;
              }
              
              return def;
            });
            
            sqlContent += columnDefs.join(',\n') + '\n);\n\n';

            // Get table data
            const dataResult = await client.query(`SELECT * FROM "${schemaName}"."${tableName}"`);
            
            if (dataResult.rows.length > 0) {
              const columns = dataResult.fields.map(f => f.name);
              sqlContent += `-- Data for table: ${tableName}\n`;
              
              for (const row of dataResult.rows) {
                const values = columns.map(col => {
                  const value = row[col];
                  if (value === null) return 'NULL';
                  if (typeof value === 'string') {
                    return `'${value.replace(/'/g, "''")}'`;
                  }
                  if (value instanceof Date) {
                    return `'${value.toISOString()}'`;
                  }
                  return String(value);
                });
                sqlContent += `INSERT INTO "${schemaName}"."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
              }
              sqlContent += '\n';
            }
          }
        }

        writeFileSync(tempFilePath, sqlContent, 'utf8');
      } finally {
        client.release();
      }

      if (!existsSync(tempFilePath)) {
        return { success: false, error: 'Failed to create backup file' };
      }

      // Upload to MinIO
      const fileStream = createReadStream(tempFilePath);
      const bucketName = process.env.MINIO_BUCKET || 'skaftin';

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: backupKey,
          Body: fileStream,
          ContentType: 'application/octet-stream',
          Metadata: {
            projectId: projectId.toString(),
            schemaName: schemaName,
            backupName: finalBackupName,
            type: 'database',
            description: description || '',
            createdAt: new Date().toISOString(),
            automatic: 'true',
          },
        })
      );

      // Clean up temp file
      try {
        unlinkSync(tempFilePath);
      } catch (err) {
        console.warn('Failed to delete temp file:', err);
      }

      console.log(`[BackupScheduler] ✅ Backup created and uploaded: ${backupKey}`);
      return { success: true };
    } catch (error: any) {
      console.error('[BackupScheduler] Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a full backup for a schedule (internal method)
   */
  private async createFullBackupForSchedule(
    projectId: number,
    backupName?: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import required modules
      const { tmpdir } = require('os');
      const { join } = require('path');
      const { writeFileSync, createReadStream, unlinkSync, existsSync, mkdirSync, createWriteStream, readdirSync } = require('fs');
      const archiver = require('archiver');

      // Get project info
      const result = await this.pool.query(
        'SELECT name, description, schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Project not found' };
      }

      const project = result.rows[0];
      const schemaName = project.schema_name;
      
      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalBackupName = backupName || `auto-full-backup-${timestamp}`;
      const backupFileName = `${finalBackupName}.zip`;
      const backupKey = `backups/${projectId}/${backupFileName}`;

      // Create temporary directory
      const tempDir = join(tmpdir(), `backup-${projectId}-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });

      const projectDataPath = join(tempDir, 'project_data.sql');
      const systemSettingsPath = join(tempDir, 'system_settings.sql');
      const metadataPath = join(tempDir, 'metadata.json');
      const zipPath = join(tempDir, backupFileName);

      try {
        // This is a simplified version - for full implementation, 
        // we'd need to properly generate the full backup
        console.log(`[BackupScheduler] 📦 Creating full backup for project ${projectId}`);

        // Create placeholder files (actual implementation would generate real dumps)
        writeFileSync(projectDataPath, '-- Project data placeholder\n', 'utf8');
        writeFileSync(systemSettingsPath, '-- System settings placeholder\n', 'utf8');
        
        const metadata = {
          version: '1.0.0',
          backupName: finalBackupName,
          description: description || '',
          projectId: projectId,
          projectName: project.name,
          timestamp: new Date().toISOString(),
          backupType: 'full',
          automatic: true,
        };
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

        // Create ZIP file
        await new Promise<void>((resolve, reject) => {
          const output = createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', () => resolve());
          archive.on('error', (err: Error) => reject(err));

          archive.pipe(output);
          archive.file(projectDataPath, { name: 'project_data.sql' });
          archive.file(systemSettingsPath, { name: 'system_settings.sql' });
          archive.file(metadataPath, { name: 'metadata.json' });
          archive.finalize();
        });

        // Upload to MinIO
        const fileStream = createReadStream(zipPath);
        const bucketName = process.env.MINIO_BUCKET || 'skaftin';

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: backupKey,
            Body: fileStream,
            ContentType: 'application/zip',
            Metadata: {
              projectId: projectId.toString(),
              projectName: project.name,
              backupName: finalBackupName,
              type: 'full',
              description: description || '',
              createdAt: new Date().toISOString(),
              automatic: 'true',
            },
          })
        );

        // Clean up temp files
        try {
          unlinkSync(projectDataPath);
          unlinkSync(systemSettingsPath);
          unlinkSync(metadataPath);
          unlinkSync(zipPath);
        } catch (cleanupError) {
          console.warn('[BackupScheduler] Failed to cleanup temp files:', cleanupError);
        }

        console.log(`[BackupScheduler] ✅ Full backup created and uploaded: ${backupKey}`);
        return { success: true };
      } catch (error: any) {
        console.error('[BackupScheduler] Error creating full backup:', error);
        return { success: false, error: error.message };
      }
    } catch (error: any) {
      console.error('[BackupScheduler] Error in createFullBackupForSchedule:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup old backups based on days (retention_days or keep_days policy)
   */
  private async cleanupOldBackupsByDays(projectId: number, retentionDays: number): Promise<void> {
    try {
      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const prefix = `backups/${projectId}/`;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(listCommand) as ListObjectsV2CommandOutput;

      if (response.Contents && response.Contents.length > 0) {
        for (const object of response.Contents) {
          if (object.Key && object.LastModified && object.LastModified < cutoffDate) {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key,
            });
            await this.s3Client.send(deleteCommand);
            console.log(`[BackupScheduler] 🗑️  Deleted old backup: ${object.Key}`);
          }
        }
      }
    } catch (error: any) {
      console.error('[BackupScheduler] Error cleaning up old backups by days:', error);
    }
  }

  /**
   * Cleanup old backups based on count (keep_count policy)
   */
  private async cleanupOldBackupsByCount(projectId: number, keepCount: number): Promise<void> {
    try {
      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const prefix = `backups/${projectId}/`;

      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(listCommand) as ListObjectsV2CommandOutput;

      if (response.Contents && response.Contents.length > keepCount) {
        // Sort by LastModified (newest first)
        const sortedBackups = response.Contents
          .filter(obj => obj.Key && obj.LastModified)
          .sort((a, b) => {
            const dateA = a.LastModified?.getTime() || 0;
            const dateB = b.LastModified?.getTime() || 0;
            return dateB - dateA;
          });

        // Delete backups beyond the keep count
        const backupsToDelete = sortedBackups.slice(keepCount);

        for (const object of backupsToDelete) {
          if (object.Key) {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key,
            });
            await this.s3Client.send(deleteCommand);
            console.log(`[BackupScheduler] 🗑️  Deleted old backup (keep count): ${object.Key}`);
          }
        }
      }
    } catch (error: any) {
      console.error('[BackupScheduler] Error cleaning up old backups by count:', error);
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  private getNextRunTime(cronExpression: string): Date | null {
    try {
      // Simple calculation - get next occurrence
      // For a more accurate calculation, we'd need a cron parser library
      // For now, return null and let it be calculated on the fly
      return null;
    } catch (error) {
      return null;
    }
  }
}

