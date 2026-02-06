/**
 * Request Logs Controller
 * 
 * Handles HTTP endpoints for request logging operations:
 * - Create log entries
 * - List logs with pagination/filters
 * - Get aggregated stats
 * - Manual cleanup
 * 
 * Uses public.skaftin_system_request_logs table with project_id column
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import { clearLoggingSettingsCache } from '../middleware/requestLoggingMiddleware';

interface RequestLogEntry {
  id: number;
  project_id: number;
  request_id: string;
  method: string;
  url: string;
  status_code: number | null;
  request_payload: any;
  response_data: any;
  error_message: string | null;
  duration_ms: number | null;
  user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

interface CreateRequestLogRequest {
  method: string;
  url: string;
  status_code?: number;
  request_payload?: any;
  response_data?: any;
  error_message?: string;
  duration_ms?: number;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
}

class RequestLogsController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    RequestLogsController.pool = pool;
  }

  /**
   * Check if request logging is enabled for a project
   */
  private static async isLoggingEnabled(projectId: number): Promise<boolean> {
    try {
      const result = await RequestLogsController.pool.query(
        'SELECT settings_json FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const settingsJson = result.rows[0].settings_json || {};
      return settingsJson.request_logging_enabled === true;
    } catch (error) {
      console.error('Error checking logging status:', error);
      return false;
    }
  }

  /**
   * Verify project exists
   */
  private static async projectExists(projectId: number): Promise<boolean> {
    try {
      const result = await RequestLogsController.pool.query(
        'SELECT id FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking project:', error);
      return false;
    }
  }

  /**
   * Truncate large payloads to prevent excessive storage
   */
  private static truncatePayload(payload: any, maxSize: number = 10000): any {
    if (!payload) return null;
    
    const str = JSON.stringify(payload);
    if (str.length <= maxSize) return payload;
    
    return {
      _truncated: true,
      _original_size: str.length,
      _preview: str.substring(0, maxSize)
    };
  }

  /**
   * Create a new request log entry
   * POST /api/projects/:projectId/request-logs
   */
  static async createLog(req: HybridAuthRequest, res: Response) {
    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Check if logging is enabled
      const loggingEnabled = await RequestLogsController.isLoggingEnabled(projectId);
      if (!loggingEnabled) {
        // Silently succeed but don't log (don't break the app if logging is disabled)
        return ResponseUtils.success(res, 'Logging disabled for this project', { logged: false });
      }

      const logData: CreateRequestLogRequest = req.body;

      if (!logData.method || !logData.url) {
        return ResponseUtils.error(res, 'Method and URL are required', null, null, 400);
      }

      // Truncate large payloads
      const truncatedRequestPayload = RequestLogsController.truncatePayload(logData.request_payload);
      const truncatedResponseData = RequestLogsController.truncatePayload(logData.response_data);

      const result = await RequestLogsController.pool.query(
        `INSERT INTO public.skaftin_system_request_logs 
         (project_id, method, url, status_code, request_payload, response_data, error_message, duration_ms, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          projectId,
          logData.method,
          logData.url,
          logData.status_code || null,
          truncatedRequestPayload ? JSON.stringify(truncatedRequestPayload) : null,
          truncatedResponseData ? JSON.stringify(truncatedResponseData) : null,
          logData.error_message || null,
          logData.duration_ms || null,
          logData.user_id || null,
          logData.ip_address || req.ip || null,
          logData.user_agent || req.get('user-agent') || null
        ]
      );

      return ResponseUtils.success(res, 'Request logged successfully', { 
        logged: true, 
        log_id: result.rows[0].id 
      }, 201);
    } catch (error: any) {
      console.error('Error creating request log:', error);
      // Don't fail the application if logging fails
      return ResponseUtils.success(res, 'Logging failed but continuing', { logged: false, error: error.message });
    }
  }

  /**
   * List request logs with pagination and filters
   * GET /api/projects/:projectId/request-logs
   */
  static async listLogs(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const statusCode = req.query.status_code ? parseInt(req.query.status_code as string) : null;
      const method = req.query.method as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const hasError = req.query.has_error === 'true';

      // Build query with filters - always filter by project_id
      const conditions: string[] = ['project_id = $1'];
      const values: any[] = [projectId];
      let paramIndex = 2;

      if (statusCode) {
        conditions.push(`status_code = $${paramIndex++}`);
        values.push(statusCode);
      }

      if (method) {
        conditions.push(`method = $${paramIndex++}`);
        values.push(method.toUpperCase());
      }

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(new Date(startDate));
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(new Date(endDate));
      }

      if (hasError) {
        conditions.push(`(error_message IS NOT NULL OR status_code >= 400)`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await RequestLogsController.pool.query(
        `SELECT COUNT(*) FROM public.skaftin_system_request_logs ${whereClause}`,
        values
      );
      const totalCount = parseInt(countResult.rows[0].count);

      // Get paginated results
      const logsResult = await RequestLogsController.pool.query(
        `SELECT * FROM public.skaftin_system_request_logs 
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...values, limit, offset]
      );

      return ResponseUtils.success(res, 'Request logs retrieved', {
        logs: logsResult.rows,
        pagination: {
          total: totalCount,
          limit,
          offset,
          has_more: offset + logsResult.rows.length < totalCount
        }
      });
    } catch (error: any) {
      console.error('Error listing request logs:', error);
      return ResponseUtils.error(res, 'Failed to retrieve request logs', error.message);
    }
  }

  /**
   * Get aggregated stats for request logs
   * POST /api/projects/:projectId/request-logs/stats
   */
  static async getStats(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Get time range from body (default: last 24 hours)
      const hours = req.body?.hours || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Total requests
      const totalResult = await RequestLogsController.pool.query(
        `SELECT COUNT(*) as total FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at >= $2`,
        [projectId, startTime]
      );

      // Requests by status code category
      const statusResult = await RequestLogsController.pool.query(
        `SELECT 
           CASE 
             WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
             WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
             WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
             WHEN status_code >= 500 THEN '5xx'
             ELSE 'unknown'
           END as category,
           COUNT(*) as count
         FROM public.skaftin_system_request_logs 
         WHERE project_id = $1 AND created_at >= $2
         GROUP BY category`,
        [projectId, startTime]
      );

      // Requests by method
      const methodResult = await RequestLogsController.pool.query(
        `SELECT method, COUNT(*) as count 
         FROM public.skaftin_system_request_logs 
         WHERE project_id = $1 AND created_at >= $2
         GROUP BY method`,
        [projectId, startTime]
      );

      // Average response time
      const avgTimeResult = await RequestLogsController.pool.query(
        `SELECT AVG(duration_ms) as avg_duration, MAX(duration_ms) as max_duration, MIN(duration_ms) as min_duration
         FROM public.skaftin_system_request_logs 
         WHERE project_id = $1 AND created_at >= $2 AND duration_ms IS NOT NULL`,
        [projectId, startTime]
      );

      // Error count
      const errorResult = await RequestLogsController.pool.query(
        `SELECT COUNT(*) as error_count 
         FROM public.skaftin_system_request_logs 
         WHERE project_id = $1 AND created_at >= $2 AND (error_message IS NOT NULL OR status_code >= 400)`,
        [projectId, startTime]
      );

      // Top endpoints by request count
      const topEndpointsResult = await RequestLogsController.pool.query(
        `SELECT url, method, COUNT(*) as count, AVG(duration_ms) as avg_duration
         FROM public.skaftin_system_request_logs 
         WHERE project_id = $1 AND created_at >= $2
         GROUP BY url, method
         ORDER BY count DESC
         LIMIT 10`,
        [projectId, startTime]
      );

      const statusByCategory = statusResult.rows.reduce((acc: any, row: any) => {
        acc[row.category] = parseInt(row.count);
        return acc;
      }, {});

      const byMethod = methodResult.rows.reduce((acc: any, row: any) => {
        acc[row.method] = parseInt(row.count);
        return acc;
      }, {});

      return ResponseUtils.success(res, 'Request log stats retrieved', {
        time_range: {
          hours,
          start: startTime.toISOString(),
          end: new Date().toISOString()
        },
        total_requests: parseInt(totalResult.rows[0].total),
        error_count: parseInt(errorResult.rows[0].error_count),
        by_status: statusByCategory,
        by_method: byMethod,
        response_time: {
          avg_ms: Math.round(parseFloat(avgTimeResult.rows[0].avg_duration) || 0),
          max_ms: parseInt(avgTimeResult.rows[0].max_duration) || 0,
          min_ms: parseInt(avgTimeResult.rows[0].min_duration) || 0
        },
        top_endpoints: topEndpointsResult.rows.map((row: any) => ({
          url: row.url,
          method: row.method,
          count: parseInt(row.count),
          avg_duration_ms: Math.round(parseFloat(row.avg_duration) || 0)
        }))
      });
    } catch (error: any) {
      console.error('Error getting request log stats:', error);
      return ResponseUtils.error(res, 'Failed to retrieve stats', error.message);
    }
  }

  /**
   * Get a single request log by ID
   * GET /api/projects/:projectId/request-logs/:logId
   */
  static async getLog(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const logId = parseInt(req.params.logId);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      if (isNaN(logId)) {
        return ResponseUtils.error(res, 'Invalid log ID', null, null, 400);
      }

      const result = await RequestLogsController.pool.query(
        `SELECT * FROM public.skaftin_system_request_logs WHERE id = $1 AND project_id = $2`,
        [logId, projectId]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Log not found', null, null, 404);
      }

      return ResponseUtils.success(res, 'Request log retrieved', result.rows[0]);
    } catch (error: any) {
      console.error('Error getting request log:', error);
      return ResponseUtils.error(res, 'Failed to retrieve request log', error.message);
    }
  }

  /**
   * Manual cleanup of request logs
   * DELETE /api/projects/:projectId/request-logs
   * Query params: older_than_days (optional, default 7)
   */
  static async cleanup(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const olderThanDays = parseInt(req.query.older_than_days as string) || 7;
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await RequestLogsController.pool.query(
        `DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at < $2`,
        [projectId, cutoffDate]
      );

      return ResponseUtils.success(res, 'Request logs cleaned up', {
        deleted_count: result.rowCount,
        cutoff_date: cutoffDate.toISOString()
      });
    } catch (error: any) {
      console.error('Error cleaning up request logs:', error);
      return ResponseUtils.error(res, 'Failed to cleanup request logs', error.message);
    }
  }

  /**
   * Get request logging settings for a project
   * GET /api/projects/:projectId/request-logs/settings
   */
  static async getSettings(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const result = await RequestLogsController.pool.query(
        'SELECT settings_json FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.success(res, 'Request logging settings', {
          request_logging_enabled: false,
          request_log_retention: 'weekly'
        });
      }

      const settingsJson = result.rows[0].settings_json || {};

      return ResponseUtils.success(res, 'Request logging settings', {
        request_logging_enabled: settingsJson.request_logging_enabled || false,
        request_log_retention: settingsJson.request_log_retention || 'weekly'
      });
    } catch (error: any) {
      console.error('Error getting request log settings:', error);
      return ResponseUtils.error(res, 'Failed to retrieve settings', error.message);
    }
  }

  /**
   * Update request logging settings for a project
   * PUT /api/projects/:projectId/request-logs/settings
   */
  static async updateSettings(req: SuperTokensAuthenticatedRequest & { projectId?: number }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { request_logging_enabled, request_log_retention } = req.body;

      // Validate retention value
      const validRetentions = ['daily', 'weekly', 'monthly', 'disabled'];
      if (request_log_retention && !validRetentions.includes(request_log_retention)) {
        return ResponseUtils.error(res, 'Invalid retention value. Must be: daily, weekly, monthly, or disabled', null, null, 400);
      }

      // Get current settings_json
      const currentResult = await RequestLogsController.pool.query(
        'SELECT settings_json FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (currentResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project settings not found', null, null, 404);
      }

      const currentSettingsJson = currentResult.rows[0].settings_json || {};

      // Update settings
      if (request_logging_enabled !== undefined) {
        currentSettingsJson.request_logging_enabled = request_logging_enabled;
      }
      if (request_log_retention !== undefined) {
        currentSettingsJson.request_log_retention = request_log_retention;
      }

      // Save updated settings
      await RequestLogsController.pool.query(
        'UPDATE skaftin_system_auth_settings SET settings_json = $1, updated_at = NOW() WHERE project_id = $2',
        [JSON.stringify(currentSettingsJson), projectId]
      );

      // Clear the logging settings cache so changes take effect immediately
      clearLoggingSettingsCache(projectId);

      return ResponseUtils.success(res, 'Request logging settings updated', {
        request_logging_enabled: currentSettingsJson.request_logging_enabled || false,
        request_log_retention: currentSettingsJson.request_log_retention || 'weekly'
      });
    } catch (error: any) {
      console.error('Error updating request log settings:', error);
      return ResponseUtils.error(res, 'Failed to update settings', error.message);
    }
  }
}

export default RequestLogsController;
