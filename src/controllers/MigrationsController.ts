/**
 * Migrations Controller
 * 
 * Handles database migrations via API endpoints
 * Only accessible to authenticated SuperTokens users (dashboard admins)
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

interface MigrationFile {
  name: string;
  path: string;
  size: number;
  modified: Date;
}

interface MigrationResult {
  file: string;
  success: boolean;
  error?: string;
  duration: number;
  statementsExecuted?: number;
}

class MigrationsController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    MigrationsController.pool = pool;
  }

  /**
   * List all available migration files
   * GET /api/migrations
   */
  static async listMigrations(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      if (!fs.existsSync(MIGRATIONS_DIR)) {
        return ResponseUtils.success(res, 'Migrations directory not found', { migrations: [] });
      }

      const files = fs.readdirSync(MIGRATIONS_DIR);
      const migrations: MigrationFile[] = files
        .filter(f => f.endsWith('.sql'))
        .map(f => {
          const filePath = path.join(MIGRATIONS_DIR, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return ResponseUtils.success(res, 'Migrations listed', {
        migrations,
        total: migrations.length,
        directory: MIGRATIONS_DIR
      });
    } catch (error: any) {
      console.error('Error listing migrations:', error);
      return ResponseUtils.error(res, 'Failed to list migrations', error.message);
    }
  }

  /**
   * Get content of a specific migration file
   * GET /api/migrations/:filename
   */
  static async getMigration(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { filename } = req.params;
      
      // Security: prevent directory traversal
      const sanitizedFilename = path.basename(filename);
      if (sanitizedFilename !== filename || !filename.endsWith('.sql')) {
        return ResponseUtils.error(res, 'Invalid migration filename', null, null, 400);
      }

      const filePath = path.join(MIGRATIONS_DIR, sanitizedFilename);
      
      if (!fs.existsSync(filePath)) {
        return ResponseUtils.error(res, 'Migration file not found', null, null, 404);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);

      return ResponseUtils.success(res, 'Migration content retrieved', {
        name: sanitizedFilename,
        content,
        size: stats.size,
        modified: stats.mtime
      });
    } catch (error: any) {
      console.error('Error getting migration:', error);
      return ResponseUtils.error(res, 'Failed to get migration', error.message);
    }
  }

  /**
   * Run a specific migration
   * POST /api/migrations/:filename/run
   */
  static async runMigration(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const startTime = Date.now();

    try {
      const { filename } = req.params;
      const { dryRun = false } = req.body;
      
      // Security: prevent directory traversal
      const sanitizedFilename = path.basename(filename);
      if (sanitizedFilename !== filename || !filename.endsWith('.sql')) {
        return ResponseUtils.error(res, 'Invalid migration filename', null, null, 400);
      }

      const filePath = path.join(MIGRATIONS_DIR, sanitizedFilename);
      
      if (!fs.existsSync(filePath)) {
        return ResponseUtils.error(res, 'Migration file not found', null, null, 404);
      }

      const sql = fs.readFileSync(filePath, 'utf-8');
      
      if (dryRun) {
        return ResponseUtils.success(res, 'Dry run - migration not executed', {
          file: sanitizedFilename,
          sql_preview: sql.substring(0, 1000) + (sql.length > 1000 ? '...' : ''),
          size: sql.length,
          dryRun: true
        });
      }

      console.log(`🚀 [MigrationsController] Running migration: ${sanitizedFilename}`);
      
      // Execute the migration
      await MigrationsController.pool.query(sql);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [MigrationsController] Migration completed in ${duration}ms`);

      return ResponseUtils.success(res, 'Migration executed successfully', {
        file: sanitizedFilename,
        success: true,
        duration
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('❌ [MigrationsController] Migration failed:', error.message);
      return ResponseUtils.error(res, 'Migration failed', {
        error: error.message,
        duration
      });
    }
  }

  /**
   * Run multiple migrations in sequence
   * POST /api/migrations/run-batch
   * Body: { migrations: ['0001_init.sql', '0002_tables.sql'], stopOnError: true }
   */
  static async runBatch(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const startTime = Date.now();

    try {
      const { migrations, stopOnError = true, dryRun = false } = req.body;

      if (!Array.isArray(migrations) || migrations.length === 0) {
        return ResponseUtils.error(res, 'migrations array is required', null, null, 400);
      }

      const results: MigrationResult[] = [];

      for (const filename of migrations) {
        const migrationStart = Date.now();
        
        // Security: prevent directory traversal
        const sanitizedFilename = path.basename(filename);
        if (sanitizedFilename !== filename || !filename.endsWith('.sql')) {
          results.push({
            file: filename,
            success: false,
            error: 'Invalid filename',
            duration: 0
          });
          if (stopOnError) break;
          continue;
        }

        const filePath = path.join(MIGRATIONS_DIR, sanitizedFilename);
        
        if (!fs.existsSync(filePath)) {
          results.push({
            file: sanitizedFilename,
            success: false,
            error: 'File not found',
            duration: 0
          });
          if (stopOnError) break;
          continue;
        }

        if (dryRun) {
          results.push({
            file: sanitizedFilename,
            success: true,
            duration: 0
          });
          continue;
        }

        try {
          const sql = fs.readFileSync(filePath, 'utf-8');
          console.log(`🚀 [MigrationsController] Running: ${sanitizedFilename}`);
          await MigrationsController.pool.query(sql);
          
          results.push({
            file: sanitizedFilename,
            success: true,
            duration: Date.now() - migrationStart
          });
          console.log(`✅ [MigrationsController] Completed: ${sanitizedFilename}`);
        } catch (err: any) {
          results.push({
            file: sanitizedFilename,
            success: false,
            error: err.message,
            duration: Date.now() - migrationStart
          });
          console.error(`❌ [MigrationsController] Failed: ${sanitizedFilename} - ${err.message}`);
          if (stopOnError) break;
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return ResponseUtils.success(res, 'Batch migration completed', {
        results,
        summary: {
          total: results.length,
          successful,
          failed,
          duration: Date.now() - startTime
        },
        dryRun
      });
    } catch (error: any) {
      console.error('Error running batch migrations:', error);
      return ResponseUtils.error(res, 'Failed to run batch migrations', error.message);
    }
  }

  /**
   * Run all migrations in order
   * POST /api/migrations/run-all
   */
  static async runAll(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { stopOnError = true, dryRun = false } = req.body;

      if (!fs.existsSync(MIGRATIONS_DIR)) {
        return ResponseUtils.error(res, 'Migrations directory not found', null, null, 404);
      }

      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      // Reuse runBatch logic
      req.body = { migrations: files, stopOnError, dryRun };
      return MigrationsController.runBatch(req, res);
    } catch (error: any) {
      console.error('Error running all migrations:', error);
      return ResponseUtils.error(res, 'Failed to run all migrations', error.message);
    }
  }
}

export default MigrationsController;
