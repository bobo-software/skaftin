import { Response } from 'express';
import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, unlinkSync, existsSync, writeFileSync, statSync, createWriteStream, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import archiver from 'archiver';
import unzipper from 'unzipper';
import ResponseUtils from '../utils/ResponseUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { db } from '../db/drizzle.config';
import { backupSchedules } from '../db/schemas/BackupSchedulesSchema';
import { projects } from '../db/schemas/ProjectsSchema';
import { eq, and, sql } from 'drizzle-orm';
import { BackupScheduler } from '../services/BackupScheduler';
import * as cron from 'node-cron';
import { verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';
import { DatabaseInitializer } from '../services/DatabaseInitializer';

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
      'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
      [projectId]
    );
    return result.rows.length > 0 ? result.rows[0].schema_name : null;
  }

  /**
   * Get project bucket name
   */
  private static async getProjectBucket(projectId: number): Promise<string | null> {
    const result = await BackupController.pool.query(
      'SELECT bucket_name FROM skaftin_system_projects WHERE id = $1',
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
              // Get primary key columns first (before creating table definition)
              const pkResult = await client.query(`
                SELECT 
                  kcu.column_name,
                  kcu.ordinal_position
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                  AND tc.table_name = kcu.table_name
                WHERE tc.table_schema = $1 
                  AND tc.table_name = $2 
                  AND tc.constraint_type = 'PRIMARY KEY'
                ORDER BY kcu.ordinal_position
              `, [schemaName, tableName]);

              const primaryKeyColumns = pkResult.rows.map(row => row.column_name);

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

                // Add PRIMARY KEY constraint if it exists
                if (primaryKeyColumns.length > 0) {
                  // Remove duplicates (in case of any data issues)
                  const uniquePkColumns = [...new Set(primaryKeyColumns)];
                  columnDefs.push(`  PRIMARY KEY (${uniquePkColumns.map(col => `"${col}"`).join(', ')})`);
                }
                
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
        
        // Determine backup type based on file extension
        let backupName = fileName;
        let backupType: 'database' | 'full' = 'database';
        
        if (fileName.endsWith('.zip')) {
          backupName = fileName.replace('.zip', '');
          backupType = 'full';
        } else if (fileName.endsWith('.sql')) {
          backupName = fileName.replace('.sql', '');
          backupType = 'database';
        }

        // Extract metadata from object metadata or key
        return {
          id: key,
          name: backupName,
          projectId: projectId,
          createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
          size: object.Size || 0,
          type: backupType,
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

  /**
   * Generate SQL dump for system settings tables
   */
  private static async generateSystemSettingsDump(projectId: number, schemaName: string): Promise<string> {
    const client = await BackupController.pool.connect();
    let sqlContent = '';

    try {
      sqlContent += `-- System Settings Dump for Project ID: ${projectId}\n`;
      sqlContent += `-- Schema: ${schemaName}\n`;
      sqlContent += `-- Dumped at: ${new Date().toISOString()}\n\n`;

      // Tables to backup with their location (public or project schema)
      const systemTables = [
        // Project schema tables
        { schema: schemaName, table: 'skaftin_system_users', pkColumn: 'id' },
        { schema: schemaName, table: 'skaftin_system_roles', pkColumn: 'id' },
        { schema: schemaName, table: 'skaftin_system_user_roles', pkColumn: 'id' },
        { schema: schemaName, table: 'skaftin_system_user_custom_fields', pkColumn: 'id' },
        { schema: schemaName, table: 'skaftin_system_otp_verifications', pkColumn: 'id' },
        // Public schema tables (filtered by project_id)
        { schema: 'public', table: 'skaftin_system_auth_settings', pkColumn: 'id', filterByProject: true },
        { schema: 'public', table: 'skaftin_system_email_providers', pkColumn: 'id', filterByProject: true },
        { schema: 'public', table: 'sms_providers', pkColumn: 'id', filterByProject: true },
        { schema: 'public', table: 'skaftin_system_email_templates', pkColumn: 'id', filterByProject: true },
        { schema: 'public', table: 'skaftin_system_sms_templates', pkColumn: 'id', filterByProject: true },
        { schema: 'public', table: 'skaftin_system_api_credentials', pkColumn: 'id', filterByProject: true },
      ];

      for (const tableInfo of systemTables) {
        try {
          // Check if table exists
          const tableExistsQuery = `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = $1 AND table_name = $2
            )
          `;
          const tableExists = await client.query(tableExistsQuery, [tableInfo.schema, tableInfo.table]);
          
          if (!tableExists.rows[0].exists) {
            sqlContent += `-- Table ${tableInfo.schema}.${tableInfo.table} does not exist, skipping\n\n`;
            continue;
          }

          // Build query with optional project_id filter
          let dataQuery = `SELECT * FROM "${tableInfo.schema}"."${tableInfo.table}"`;
          const queryParams: any[] = [];
          
          if (tableInfo.filterByProject) {
            dataQuery += ` WHERE project_id = $1`;
            queryParams.push(projectId);
          }
          
          dataQuery += ` ORDER BY ${tableInfo.pkColumn}`;

          const dataResult = await client.query(dataQuery, queryParams);
          
          if (dataResult.rows.length > 0) {
            sqlContent += `-- Data for ${tableInfo.schema}.${tableInfo.table}\n`;
            sqlContent += `DELETE FROM "${tableInfo.schema}"."${tableInfo.table}"`;
            
            if (tableInfo.filterByProject) {
              sqlContent += ` WHERE project_id = ${projectId}`;
            }
            sqlContent += `;\n`;

            const columns = dataResult.fields.map(f => f.name);
            
            for (const row of dataResult.rows) {
              const values = columns.map(col => {
                const value = row[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') {
                  return `'${value.replace(/'/g, "''")}'`;
                }
                if (typeof value === 'boolean') {
                  return value ? 'TRUE' : 'FALSE';
                }
                if (value instanceof Date) {
                  return `'${value.toISOString()}'`;
                }
                if (typeof value === 'object') {
                  // Handle JSONB
                  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
                }
                return String(value);
              });
              
              sqlContent += `INSERT INTO "${tableInfo.schema}"."${tableInfo.table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            sqlContent += '\n';
          } else {
            sqlContent += `-- No data in ${tableInfo.schema}.${tableInfo.table}\n\n`;
          }
        } catch (tableError: any) {
          console.warn(`Warning: Could not backup ${tableInfo.table}:`, tableError.message);
          sqlContent += `-- Warning: Could not backup ${tableInfo.table}: ${tableError.message}\n\n`;
        }
      }

      return sqlContent;
    } finally {
      client.release();
    }
  }

  /**
   * Create a full backup (project data + system settings) as a ZIP file
   */
  static async createFullBackup(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { name, description } = req.body;

      // Get project info
      const projectResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (projectResult.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const project = projectResult[0];
      const schemaName = project.schema_name;

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `full-backup-${timestamp}`;
      const backupFileName = `${backupName}.zip`;
      const backupKey = `backups/${projectId}/${backupFileName}`;

      // Create temporary directory
      const tempDir = join(tmpdir(), `backup-${projectId}-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });

      const projectDataPath = join(tempDir, 'project_data.sql');
      const systemSettingsPath = join(tempDir, 'system_settings.sql');
      const metadataPath = join(tempDir, 'metadata.json');
      const zipPath = join(tempDir, backupFileName);

      try {
        console.log(`📦 Creating full backup for project ${projectId}`);

        // 1. Generate project data SQL dump
        const client = await BackupController.pool.connect();
        let projectSql = '';

        try {
          await client.query(`SET search_path TO ${schemaName}, public`);

          projectSql += `-- Project Data Dump\n`;
          projectSql += `-- Schema: ${schemaName}\n`;
          projectSql += `-- Dumped at: ${new Date().toISOString()}\n\n`;
          projectSql += `SET search_path TO ${schemaName}, public;\n\n`;

          // Get all tables in the schema (excluding skaftin_system tables)
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'skaftin_system_%'
            ORDER BY table_name
          `, [schemaName]);

          const tables = tablesResult.rows.map(row => row.table_name);

          for (const tableName of tables) {
            // Get primary key columns first (before creating table definition)
            const pkResult = await client.query(`
              SELECT 
                kcu.column_name,
                kcu.ordinal_position
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.table_name = kcu.table_name
              WHERE tc.table_schema = $1 
                AND tc.table_name = $2 
                AND tc.constraint_type = 'PRIMARY KEY'
              ORDER BY kcu.ordinal_position
            `, [schemaName, tableName]);

            const primaryKeyColumns = pkResult.rows.map(row => row.column_name);

            // Get column info
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
              projectSql += `\n-- Table: ${tableName}\n`;
              projectSql += `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (\n`;
              
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

              // Add PRIMARY KEY constraint if it exists
              if (primaryKeyColumns.length > 0) {
                // Remove duplicates (in case of any data issues)
                const uniquePkColumns = [...new Set(primaryKeyColumns)];
                columnDefs.push(`  PRIMARY KEY (${uniquePkColumns.map(col => `"${col}"`).join(', ')})`);
              }
              
              projectSql += columnDefs.join(',\n') + '\n);\n\n';

              // Get table data
              const dataResult = await client.query(`SELECT * FROM "${schemaName}"."${tableName}"`);
              
              if (dataResult.rows.length > 0) {
                const columns = dataResult.fields.map(f => f.name);
                projectSql += `-- Data for table: ${tableName}\n`;
                
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
                    if (typeof value === 'object') {
                      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                    }
                    return String(value);
                  });
                  projectSql += `INSERT INTO "${schemaName}"."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                projectSql += '\n';
              }
            }
          }
        } finally {
          client.release();
        }

        writeFileSync(projectDataPath, projectSql, 'utf8');
        console.log(`✓ Project data SQL generated`);

        // 2. Generate system settings dump
        const systemSql = await BackupController.generateSystemSettingsDump(projectId, schemaName);
        writeFileSync(systemSettingsPath, systemSql, 'utf8');
        console.log(`✓ System settings SQL generated`);

        // 3. Create metadata.json
        const metadata = {
          version: '1.0.0',
          backupName: backupName,
          description: description || '',
          projectId: projectId,
          projectName: project.name,
          projectDescription: project.description || '',
          schemaName: schemaName,
          timestamp: new Date().toISOString(),
          backupType: 'full',
          files: ['project_data.sql', 'system_settings.sql', 'metadata.json'],
        };
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        console.log(`✓ Metadata created`);

        // 4. Create ZIP file
        await new Promise<void>((resolve, reject) => {
          const output = createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', () => resolve());
          archive.on('error', (err) => reject(err));

          archive.pipe(output);
          archive.file(projectDataPath, { name: 'project_data.sql' });
          archive.file(systemSettingsPath, { name: 'system_settings.sql' });
          archive.file(metadataPath, { name: 'metadata.json' });
          archive.finalize();
        });

        console.log(`✓ ZIP file created`);

        // 5. Upload to MinIO
        const fileStream = createReadStream(zipPath);
        const bucketName = process.env.MINIO_BUCKET || 'skaftin';
        const stats = statSync(zipPath);

        await BackupController.s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: backupKey,
            Body: fileStream,
            ContentType: 'application/zip',
            Metadata: {
              projectId: projectId.toString(),
              projectName: project.name,
              backupName: backupName,
              type: 'full',
              description: description || '',
              createdAt: new Date().toISOString(),
            },
          })
        );

        console.log(`✅ Full backup created and uploaded: ${backupKey}`);

        // Clean up temp files
        try {
          if (existsSync(projectDataPath)) unlinkSync(projectDataPath);
          if (existsSync(systemSettingsPath)) unlinkSync(systemSettingsPath);
          if (existsSync(metadataPath)) unlinkSync(metadataPath);
          if (existsSync(zipPath)) unlinkSync(zipPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp files:', cleanupError);
        }

        const backupMetadata: BackupMetadata = {
          id: backupKey,
          name: backupName,
          projectId: projectId,
          createdAt: new Date().toISOString(),
          size: stats.size,
          type: 'full',
          description: description,
        };

        ResponseUtils.success(res, 'Full backup created successfully', backupMetadata);
      } catch (error: any) {
        // Cleanup on error
        try {
          if (existsSync(projectDataPath)) unlinkSync(projectDataPath);
          if (existsSync(systemSettingsPath)) unlinkSync(systemSettingsPath);
          if (existsSync(metadataPath)) unlinkSync(metadataPath);
          if (existsSync(zipPath)) unlinkSync(zipPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp files on error:', cleanupError);
        }

        console.error('Error creating full backup:', error);
        return ResponseUtils.error(res, 'Failed to create full backup', error);
      }
    } catch (error: any) {
      console.error('Error in createFullBackup:', error);
      return ResponseUtils.error(res, 'Failed to create full backup', error);
    }
  }

  /**
   * Restore a full backup (creates a new project)
   */
  static async restoreFullBackup(req: BackupRequest, res: Response) {
    try {
      const { backupId, newProjectName, organizationId } = req.body;
      const userId = req.user?.userId;

      if (!backupId || !newProjectName || !organizationId) {
        return ResponseUtils.error(res, 'Backup ID, new project name, and organization ID are required', null, null, 400);
      }

      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const tempDir = join(tmpdir(), `restore-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
      
      const zipPath = join(tempDir, 'backup.zip');

      try {
        console.log(`🔄 Restoring backup: ${backupId}`);

        // 1. Download ZIP from MinIO
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: backupId,
        });

        const response = await BackupController.s3Client.send(getCommand);

        if (!response.Body) {
          return ResponseUtils.error(res, 'Backup file not found', null, null, 404);
        }

        // Save ZIP to temp file
        const writeStream = createWriteStream(zipPath);
        if (response.Body instanceof Readable) {
          response.Body.pipe(writeStream);
          await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', reject);
          });
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of response.Body as any) {
            chunks.push(Buffer.from(chunk));
          }
          writeFileSync(zipPath, Buffer.concat(chunks));
        }

        console.log(`✓ Backup downloaded`);

        // 2. Extract ZIP
        const extractDir = join(tempDir, 'extracted');
        mkdirSync(extractDir, { recursive: true });

        await new Promise<void>((resolve, reject) => {
          createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractDir }))
            .on('close', () => resolve())
            .on('error', reject);
        });

        console.log(`✓ Backup extracted`);

        // 3. Read metadata
        const metadataPath = join(extractDir, 'metadata.json');
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
        
        console.log(`✓ Metadata read: ${metadata.projectName}`);

        // 4. Create new project
        const timestamp = Date.now();
        const sanitizedName = newProjectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const newSchemaName = `project_${sanitizedName}_${timestamp}`;

        const [newProject] = await db
          .insert(projects)
          .values({
            name: newProjectName,
            description: `Restored from backup: ${metadata.projectName}`,
            organization_id: organizationId,
            user_id: userId || '',
            schema_name: newSchemaName,
          })
          .returning();

        console.log(`✓ New project created: ${newProject.id}`);

        // 5. Create schema
        await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${newSchemaName}`));
        console.log(`✓ Schema created: ${newSchemaName}`);

        // 6. Initialize auth tables (creates base skaftin_system tables)
        const dbInitializer = new DatabaseInitializer(BackupController.pool);
        await dbInitializer.initializeProjectAuthTables(newSchemaName, newProject.id);
        console.log(`✓ Auth tables initialized`);

        // 7. Restore project data
        const projectDataPath = join(extractDir, 'project_data.sql');
        if (existsSync(projectDataPath)) {
          let projectSql = readFileSync(projectDataPath, 'utf8');
          // Replace old schema name with new schema name
          projectSql = projectSql.replace(new RegExp(metadata.schemaName, 'g'), newSchemaName);
          projectSql = projectSql.replace(/SET search_path TO [^;]+;/, `SET search_path TO ${newSchemaName}, public;`);
          
          const client = await BackupController.pool.connect();
          try {
            await client.query(projectSql);
            console.log(`✓ Project data restored`);
          } finally {
            client.release();
          }
        }

        // 8. Restore system settings
        const systemSettingsPath = join(extractDir, 'system_settings.sql');
        if (existsSync(systemSettingsPath)) {
          let systemSql = readFileSync(systemSettingsPath, 'utf8');
          // Replace old project ID and schema name with new ones
          systemSql = systemSql.replace(new RegExp(`project_id = ${metadata.projectId}`, 'g'), `project_id = ${newProject.id}`);
          systemSql = systemSql.replace(new RegExp(`'${metadata.projectId}'`, 'g'), `'${newProject.id}'`);
          systemSql = systemSql.replace(new RegExp(metadata.schemaName, 'g'), newSchemaName);
          
          const client = await BackupController.pool.connect();
          try {
            await client.query(systemSql);
            console.log(`✓ System settings restored`);
          } finally {
            client.release();
          }
        }

        // Clean up temp files
        try {
          unlinkSync(zipPath);
          unlinkSync(metadataPath);
          if (existsSync(projectDataPath)) unlinkSync(projectDataPath);
          if (existsSync(systemSettingsPath)) unlinkSync(systemSettingsPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp files:', cleanupError);
        }

        console.log(`✅ Backup restored successfully`);

        ResponseUtils.success(res, 'Backup restored successfully', {
          projectId: newProject.id,
          projectName: newProject.name,
          schemaName: newSchemaName,
          backupId: backupId,
        });
      } catch (error: any) {
        // Cleanup on error
        try {
          if (existsSync(zipPath)) unlinkSync(zipPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp files on error:', cleanupError);
        }

        console.error('Error restoring backup:', error);
        return ResponseUtils.error(res, 'Failed to restore backup', error);
      }
    } catch (error: any) {
      console.error('Error in restoreFullBackup:', error);
      return ResponseUtils.error(res, 'Failed to restore backup', error);
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  static async cleanupOldBackups(req: BackupRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId || req.params.id);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { retentionPolicy, retentionValue } = req.body;

      if (!retentionPolicy || !['keep_count', 'keep_days'].includes(retentionPolicy)) {
        return ResponseUtils.error(res, 'Invalid retention policy', null, null, 400);
      }

      if (!retentionValue || retentionValue < 1) {
        return ResponseUtils.error(res, 'Invalid retention value', null, null, 400);
      }

      const bucketName = process.env.MINIO_BUCKET || 'skaftin';
      const prefix = `backups/${projectId}/`;

      // List all backups
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const response = await BackupController.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        return ResponseUtils.success(res, 'No backups to clean up', { deletedCount: 0 });
      }

      // Sort backups by date (newest first)
      const backups = response.Contents
        .map((object) => ({
          key: object.Key || '',
          lastModified: object.LastModified || new Date(),
          size: object.Size || 0,
        }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      let backupsToDelete: string[] = [];

      if (retentionPolicy === 'keep_count') {
        // Keep only the N most recent backups
        if (backups.length > retentionValue) {
          backupsToDelete = backups.slice(retentionValue).map(b => b.key);
        }
      } else if (retentionPolicy === 'keep_days') {
        // Delete backups older than N days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionValue);

        backupsToDelete = backups
          .filter(b => b.lastModified < cutoffDate)
          .map(b => b.key);
      }

      // Delete old backups
      let deletedCount = 0;
      for (const key of backupsToDelete) {
        try {
          await BackupController.s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            })
          );
          deletedCount++;
          console.log(`🗑️  Deleted old backup: ${key}`);
        } catch (deleteError) {
          console.error(`Failed to delete backup ${key}:`, deleteError);
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} old backups`);

      ResponseUtils.success(res, `Cleaned up ${deletedCount} old backups`, {
        deletedCount,
        totalBackups: backups.length,
        remainingBackups: backups.length - deletedCount,
      });
    } catch (error: any) {
      console.error('Error cleaning up backups:', error);
      return ResponseUtils.error(res, 'Failed to cleanup backups', error);
    }
  }
}

export default BackupController;

