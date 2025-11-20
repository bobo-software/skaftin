import { Response } from 'express';
import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, unlinkSync, existsSync, writeFileSync, statSync, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import ResponseUtils from '../utils/ResponseUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { db } from '../db/drizzle.config';
import { backupSchedules } from '../db/schemas/BackupSchedulesSchema';
import { eq, and } from 'drizzle-orm';
import { BackupScheduler } from '../services/BackupScheduler';
import * as cron from 'node-cron';
import { verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

const execAsync = promisify(exec);

type BackupRequest = SuperTokensAuthenticatedRequest & {
  projectId?: number;
};

interface BackupMetadata {
  id: string;
  name: string;
  projectId: number;
  createdAt: string;
  size: number;
  type: 'database' | 'full';
  description?: string;
}

class BackupController {
  private static pool: Pool;
  private static s3Client: S3Client;

  static initialize(pool: Pool, s3Client: S3Client) {
    BackupController.pool = pool;
    BackupController.s3Client = s3Client;
  }

  /**
   * Get project schema name
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    const result = await BackupController.pool.query(
      'SELECT schema_name FROM projects WHERE id = $1',
      [projectId]
    );
    return result.rows.length > 0 ? result.rows[0].schema_name : null;
  }

  /**
   * Get project bucket name
   */
  private static async getProjectBucket(projectId: number): Promise<string | null> {
    const result = await BackupController.pool.query(
      'SELECT bucket_name FROM projects WHERE id = $1',
      [projectId]
    );
    return result.rows.length > 0 ? result.rows[0].bucket_name : null;
  }

  /**
   * Create a database backup for a project
   */
  static async createBackup(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { name, description, type = 'database' } = req.body;

      // Get project schema
      const schemaName = await BackupController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `backup-${timestamp}`;
      const backupFileName = `${backupName}.sql`;
      const backupKey = `backups/${projectId}/${backupFileName}`;

      // Create temporary file path
      const tempDir = tmpdir();
      const tempFilePath = join(tempDir, `backup-${projectId}-${Date.now()}.sql`);

      try {
        console.log(`📦 Creating backup for project ${projectId}, schema: ${schemaName}`);

        // Use programmatic approach to generate SQL dump (avoids pg_dump version issues)
        const client = await BackupController.pool.connect();
        let sqlContent = '';

        try {
          // Set search path to the project schema
          await client.query(`SET search_path TO ${schemaName}, public`);

          // Add header
          sqlContent += `-- PostgreSQL database dump\n`;
          sqlContent += `-- Schema: ${schemaName}\n`;
          sqlContent += `-- Dumped at: ${new Date().toISOString()}\n\n`;
          sqlContent += `SET search_path TO ${schemaName}, public;\n\n`;

          // Get all tables in the schema
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `, [schemaName]);

          const tables = tablesResult.rows.map(row => row.table_name);

          if (tables.length === 0) {
            sqlContent += `-- No tables found in schema ${schemaName}\n`;
          } else {
            // For each table, get the CREATE TABLE statement and data
            for (const tableName of tables) {
              // Get detailed column information
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
                  
                  // Handle data types
                  if (col.data_type === 'USER-DEFINED') {
                    def += col.udt_name;
                  } else if (col.data_type === 'ARRAY') {
                    def += col.udt_name.replace(/_/g, ' ') + '[]';
                  } else {
                    def += col.data_type;
                  }
                  
                  // Add length/precision for varchar, numeric, etc.
                  if (col.character_maximum_length) {
                    def += `(${col.character_maximum_length})`;
                  } else if (col.numeric_precision) {
                    if (col.numeric_scale) {
                      def += `(${col.numeric_precision},${col.numeric_scale})`;
                    } else {
                      def += `(${col.numeric_precision})`;
                    }
                  }
                  
                  // Add constraints
                  if (col.is_nullable === 'NO') {
                    def += ' NOT NULL';
                  }
                  
                  if (col.column_default) {
                    def += ` DEFAULT ${col.column_default}`;
                  }
                  
                  return def;
                });
                
                sqlContent += columnDefs.join(',\n') + '\n);\n\n';

                // Get table data as INSERT statements
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

              // Get primary keys
              const pkResult = await client.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = $1 AND table_name = $2 AND constraint_type = 'PRIMARY KEY'
              `, [schemaName, tableName]);

              // Get foreign keys
              const fkResult = await client.query(`
                SELECT
                  tc.constraint_name,
                  kcu.column_name,
                  ccu.table_schema AS foreign_table_schema,
                  ccu.table_name AS foreign_table_name,
                  ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = $1
                  AND tc.table_name = $2
              `, [schemaName, tableName]);

              if (fkResult.rows.length > 0) {
                sqlContent += `-- Foreign keys for table: ${tableName}\n`;
                for (const fk of fkResult.rows) {
                  sqlContent += `ALTER TABLE "${schemaName}"."${tableName}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_schema}"."${fk.foreign_table_name}" ("${fk.foreign_column_name}");\n`;
                }
                sqlContent += '\n';
              }
            }
          }

          // Write SQL content to file
          writeFileSync(tempFilePath, sqlContent, 'utf8');
        } finally {
          client.release();
        }

        // Check if backup file was created
        if (!existsSync(tempFilePath)) {
          return ResponseUtils.error(res, 'Failed to create backup file', null, null, 500);
        }

        // Get file size
        const stats = statSync(tempFilePath);
        const fileSize = stats.size;

        // Upload to MinIO
        const fileStream = createReadStream(tempFilePath);
        const bucketName = process.env.MINIO_BUCKET || 'skaftin';

        await BackupController.s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: backupKey,
            Body: fileStream,
            ContentType: 'application/octet-stream',
            Metadata: {
              projectId: projectId.toString(),
              schemaName: schemaName,
              backupName: backupName,
              type: type,
              description: description || '',
              createdAt: new Date().toISOString(),
            },
          })
        );

        console.log(`✅ Backup created and uploaded: ${backupKey}`);

        // Clean up temporary file
        try {
          unlinkSync(tempFilePath);
        } catch (err) {
          console.warn('Failed to delete temp file:', err);
        }

        // Create backup metadata
        const backupMetadata: BackupMetadata = {
          id: backupKey,
          name: backupName,
          projectId: projectId,
          createdAt: new Date().toISOString(),
          size: fileSize,
          type: type as 'database' | 'full',
          description: description,
        };

        ResponseUtils.success(res, 'Backup created successfully', backupMetadata);
      } catch (error: any) {
        // Clean up temp file on error
        if (existsSync(tempFilePath)) {
          try {
            unlinkSync(tempFilePath);
          } catch (err) {
            console.warn('Failed to delete temp file on error:', err);
          }
        }

        console.error('Error creating backup:', error);
        return ResponseUtils.error(res, 'Failed to create backup', error);
      }
    } catch (error: any) {
      console.error('Error in createBackup:', error);
      return ResponseUtils.error(res, 'Failed to create backup', error);
    }
  }

  /**
   * List all backups for a project
   */
  static async listBackups(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const prefix = `backups/${projectId}/`;

      // List objects in MinIO
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const response = await BackupController.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        return ResponseUtils.success(res, 'No backups found', []);
      }

      // Map S3 objects to backup metadata
      const backups: BackupMetadata[] = response.Contents.map((object) => {
        const key = object.Key || '';
        const fileName = key.split('/').pop() || '';
        const backupName = fileName.replace('.sql', '');

        // Extract metadata from object metadata or key
        return {
          id: key,
          name: backupName,
          projectId: projectId,
          createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
          size: object.Size || 0,
          type: 'database' as const,
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      ResponseUtils.success(res, 'Backups fetched successfully', backups);
    } catch (error: any) {
      console.error('Error listing backups:', error);
      return ResponseUtils.error(res, 'Failed to list backups', error);
    }
  }

  /**
   * Download a backup file
   */
  static async downloadBackup(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      // Get filename from URL parameter and reconstruct full backupId path
      let filename = req.params.backupId;
      if (filename) {
        filename = decodeURIComponent(filename);
      }

      if (!projectId || !filename) {
        return ResponseUtils.error(res, 'Project ID and Backup filename are required', null, null, 400);
      }

      // Reconstruct the full backupId path
      const backupId = `backups/${projectId}/${filename}`;
      const bucketName = process.env.MINIO_BUCKET || 'skaftin';

      // Get object from MinIO
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: backupId,
      });

      const response = await BackupController.s3Client.send(getCommand);

      if (!response.Body) {
        return ResponseUtils.error(res, 'Backup file not found', null, null, 404);
      }

      // Extract filename from backup key
      const fileName = backupId.split('/').pop() || 'backup.sql';

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Stream the file - handle AWS SDK v3 Body types
      if (response.Body instanceof Readable) {
        response.Body.pipe(res);
      } else {
        // Handle as async iterable (ReadableStream, Blob, or other types)
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        res.send(buffer);
      }
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      return ResponseUtils.error(res, 'Failed to download backup', error);
    }
  }

  /**
   * Restore a backup (imports the SQL dump)
   */
  static async restoreBackup(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      // Get filename from URL parameter and reconstruct full backupId path
      let filename = req.params.backupId;
      if (filename) {
        filename = decodeURIComponent(filename);
      }
      const { dropExisting = false } = req.body;

      if (!projectId || !filename) {
        return ResponseUtils.error(res, 'Project ID and Backup filename are required', null, null, 400);
      }

      // Reconstruct the full backupId path
      const backupId = `backups/${projectId}/${filename}`;

      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const tempDir = tmpdir();
      const tempFilePath = join(tempDir, `restore-${projectId}-${Date.now()}.sql`);

      try {
        // Download backup from MinIO
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: backupId,
        });

        const response = await BackupController.s3Client.send(getCommand);

        if (!response.Body) {
          return ResponseUtils.error(res, 'Backup file not found', null, null, 404);
        }

        // Save to temporary file
        const writeStream = createWriteStream(tempFilePath);

        // Handle AWS SDK v3 Body types
        if (response.Body instanceof Readable) {
          // Direct pipe for Node.js Readable stream
          const bodyStream = response.Body;
          bodyStream.pipe(writeStream);
          await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', reject);
            bodyStream.on('error', reject);
          });
        } else {
          // Handle as async iterable (ReadableStream, Blob, or other types)
          const chunks: Buffer[] = [];
          for await (const chunk of response.Body as any) {
            chunks.push(Buffer.from(chunk));
          }
          writeFileSync(tempFilePath, Buffer.concat(chunks));
        }

        // Get project schema
        const schemaName = await BackupController.getProjectSchema(projectId);
        if (!schemaName) {
          return ResponseUtils.error(res, 'Project not found', null, null, 404);
        }

        // Get database connection details
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = process.env.DB_PORT || '5432';
        const dbName = process.env.DB_NAME || 'skaftin_db';
        const dbUser = process.env.DB_USER || 'postgres';
        const dbPassword = process.env.DB_PASSWORD || '';

        const env = { ...process.env, PGPASSWORD: dbPassword };

        // If dropExisting, drop all tables first
        if (dropExisting) {
          const client = await BackupController.pool.connect();
          try {
            await client.query(`SET search_path TO ${schemaName}, public`);
            const tablesResult = await client.query(`
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = $1 
                AND table_type = 'BASE TABLE'
            `, [schemaName]);

            for (const row of tablesResult.rows) {
              await client.query(`DROP TABLE IF EXISTS "${schemaName}"."${row.table_name}" CASCADE`);
            }
          } finally {
            client.release();
          }
        }

        // Restore using psql (plain SQL format)
        // pg_dump with -n schemaName includes SET search_path commands, so we just execute the SQL
        const restoreCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${tempFilePath}" -v ON_ERROR_STOP=1`;

        console.log(`🔄 Restoring backup ${backupId} for project ${projectId}`);

        try {
          const { stdout, stderr } = await execAsync(restoreCommand, { env });

          if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE') && !stderr.includes('SET')) {
            console.warn('Restore warnings:', stderr);
          }
        } catch (restoreError: any) {
          // Check if it's a real error or just warnings
          if (restoreError.stderr && !restoreError.stderr.includes('WARNING') && !restoreError.stderr.includes('NOTICE')) {
            throw new Error(`Restore failed: ${restoreError.stderr || restoreError.message}`);
          }
        }

        // Clean up temp file
        try {
          unlinkSync(tempFilePath);
        } catch (err) {
          console.warn('Failed to delete temp file:', err);
        }

        ResponseUtils.success(res, 'Backup restored successfully', {
          projectId,
          backupId,
          dropExisting,
        });
      } catch (error: any) {
        // Clean up temp file on error
        if (existsSync(tempFilePath)) {
          try {
            unlinkSync(tempFilePath);
          } catch (err) {
            console.warn('Failed to delete temp file on error:', err);
          }
        }

        console.error('Error restoring backup:', error);
        return ResponseUtils.error(res, 'Failed to restore backup', error);
      }
    } catch (error: any) {
      console.error('Error in restoreBackup:', error);
      return ResponseUtils.error(res, 'Failed to restore backup', error);
    }
  }

  /**
   * Delete a backup
   */
  static async deleteBackup(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      // Get filename from URL parameter and reconstruct full backupId path
      let filename = req.params.backupId;
      if (filename) {
        filename = decodeURIComponent(filename);
      }

      if (!projectId || !filename) {
        return ResponseUtils.error(res, 'Project ID and Backup filename are required', null, null, 400);
      }

      // Reconstruct the full backupId path
      const backupId = `backups/${projectId}/${filename}`;

      const bucketName = process.env.MINIO_BUCKET || 'skaftin';

      // Delete from MinIO
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: backupId,
      });

      await BackupController.s3Client.send(deleteCommand);

      console.log(`🗑️  Deleted backup: ${backupId}`);

      ResponseUtils.success(res, 'Backup deleted successfully', { backupId });
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      return ResponseUtils.error(res, 'Failed to delete backup', error);
    }
  }

  /**
   * List all backup schedules for a project
   */
  static async listBackupSchedules(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const schedules = await db
        .select()
        .from(backupSchedules)
        .where(eq(backupSchedules.project_id, projectId))
        .orderBy(backupSchedules.created_at);

      ResponseUtils.success(res, 'Backup schedules fetched successfully', schedules);
    } catch (error: any) {
      console.error('Error listing backup schedules:', error);
      return ResponseUtils.error(res, 'Failed to list backup schedules', error);
    }
  }

  /**
   * Create a new backup schedule
   */
  static async createBackupSchedule(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { name, description, schedule, backupNamePrefix, retentionDays } = req.body;
      const userId = req.user?.userId;

      if (!name || !schedule) {
        return ResponseUtils.error(res, 'Name and schedule are required', null, null, 400);
      }

      // Validate cron schedule
      if (!cron.validate(schedule)) {
        return ResponseUtils.error(res, 'Invalid cron schedule format', null, null, 400);
      }

      // Create schedule in database
      const [newSchedule] = await db
        .insert(backupSchedules)
        .values({
          project_id: projectId,
          name,
          description,
          schedule,
          backup_name_prefix: backupNamePrefix,
          retention_days: retentionDays,
          enabled: true,
          created_by: userId,
        })
        .returning();

      // Schedule the backup
      const scheduler = BackupScheduler.getInstance();
      await scheduler.scheduleBackup(newSchedule.id);

      ResponseUtils.success(res, 'Backup schedule created successfully', newSchedule);
    } catch (error: any) {
      console.error('Error creating backup schedule:', error);
      return ResponseUtils.error(res, 'Failed to create backup schedule', error);
    }
  }

  /**
   * Update a backup schedule
   */
  static async updateBackupSchedule(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      const scheduleId = parseInt(req.params.scheduleId);
      
      if (!projectId || !scheduleId) {
        return ResponseUtils.error(res, 'Project ID and Schedule ID are required', null, null, 400);
      }

      const { name, description, schedule, backupNamePrefix, retentionDays, enabled } = req.body;

      // Verify schedule belongs to project
      const existing = await db
        .select()
        .from(backupSchedules)
        .where(and(
          eq(backupSchedules.id, scheduleId),
          eq(backupSchedules.project_id, projectId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Backup schedule not found', null, null, 404);
      }

      // Validate cron schedule if provided
      if (schedule && !cron.validate(schedule)) {
        return ResponseUtils.error(res, 'Invalid cron schedule format', null, null, 400);
      }

      // Update schedule
      const updateData: any = {
        updated_at: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (schedule !== undefined) updateData.schedule = schedule;
      if (backupNamePrefix !== undefined) updateData.backup_name_prefix = backupNamePrefix;
      if (retentionDays !== undefined) updateData.retention_days = retentionDays;
      if (enabled !== undefined) updateData.enabled = enabled;

      const [updated] = await db
        .update(backupSchedules)
        .set(updateData)
        .where(eq(backupSchedules.id, scheduleId))
        .returning();

      // Reschedule if schedule or enabled status changed
      const scheduler = BackupScheduler.getInstance();
      if (schedule !== undefined || enabled !== undefined) {
        scheduler.unscheduleBackup(scheduleId);
        if (updated.enabled) {
          await scheduler.scheduleBackup(scheduleId);
        }
      }

      ResponseUtils.success(res, 'Backup schedule updated successfully', updated);
    } catch (error: any) {
      console.error('Error updating backup schedule:', error);
      return ResponseUtils.error(res, 'Failed to update backup schedule', error);
    }
  }

  /**
   * Delete a backup schedule
   */
  static async deleteBackupSchedule(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      const scheduleId = parseInt(req.params.scheduleId);
      
      if (!projectId || !scheduleId) {
        return ResponseUtils.error(res, 'Project ID and Schedule ID are required', null, null, 400);
      }

      // Verify schedule belongs to project
      const existing = await db
        .select()
        .from(backupSchedules)
        .where(and(
          eq(backupSchedules.id, scheduleId),
          eq(backupSchedules.project_id, projectId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Backup schedule not found', null, null, 404);
      }

      // Unschedule the backup
      const scheduler = BackupScheduler.getInstance();
      scheduler.unscheduleBackup(scheduleId);

      // Delete from database
      await db
        .delete(backupSchedules)
        .where(eq(backupSchedules.id, scheduleId));

      ResponseUtils.success(res, 'Backup schedule deleted successfully', { scheduleId });
    } catch (error: any) {
      console.error('Error deleting backup schedule:', error);
      return ResponseUtils.error(res, 'Failed to delete backup schedule', error);
    }
  }
}

export default BackupController;

