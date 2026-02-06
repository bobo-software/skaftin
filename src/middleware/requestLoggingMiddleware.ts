/**
 * Request Logging Middleware
 * 
 * Automatically logs all API requests for projects that have logging enabled.
 * This is server-side logging - no client-side configuration needed.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface LoggingSettings {
  enabled: boolean;
  retention: string;
}

// Cache for logging settings to avoid DB queries on every request
const settingsCache: Map<number, { settings: LoggingSettings; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

let pool: Pool;

/**
 * Initialize the middleware with database pool
 */
export function initRequestLoggingMiddleware(dbPool: Pool) {
  pool = dbPool;
}

/**
 * Get logging settings for a project (with caching)
 */
async function getLoggingSettings(projectId: number): Promise<LoggingSettings> {
  const cached = settingsCache.get(projectId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.settings;
  }

  try {
    const result = await pool.query(
      `SELECT settings_json->>'request_logging_enabled' as enabled, 
              settings_json->>'request_log_retention' as retention 
       FROM skaftin_system_auth_settings WHERE project_id = $1`,
      [projectId]
    );

    const settings: LoggingSettings = {
      enabled: result.rows[0]?.enabled === 'true',
      retention: result.rows[0]?.retention || 'weekly'
    };

    settingsCache.set(projectId, { settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error('[RequestLogging] Error fetching settings:', error);
    return { enabled: false, retention: 'weekly' };
  }
}

/**
 * Truncate large payloads to prevent excessive storage
 */
function truncatePayload(payload: any, maxSize: number = 10000): any {
  if (!payload) return null;

  try {
    const str = JSON.stringify(payload);
    if (str.length <= maxSize) return payload;

    return {
      _truncated: true,
      _original_size: str.length,
      _preview: str.substring(0, maxSize)
    };
  } catch {
    return { _error: 'Unable to serialize payload' };
  }
}

/**
 * Log the request to the database (fire-and-forget)
 */
async function logRequestToDb(
  projectId: number,
  method: string,
  url: string,
  statusCode: number,
  requestPayload: any,
  responseData: any,
  errorMessage: string | null,
  durationMs: number,
  userId: number | null,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.skaftin_system_request_logs 
       (project_id, method, url, status_code, request_payload, response_data, error_message, duration_ms, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        projectId,
        method,
        url,
        statusCode,
        requestPayload ? JSON.stringify(truncatePayload(requestPayload)) : null,
        responseData ? JSON.stringify(truncatePayload(responseData)) : null,
        errorMessage,
        durationMs,
        userId,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // Don't let logging errors break the request
    console.error('[RequestLogging] Error logging request:', error);
  }
}

/**
 * Request logging middleware
 * Apply this to routes that should be logged (e.g., /app-api/*)
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Store original response methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let responseBody: any = null;
  let logged = false;

  const doLog = async (body: any) => {
    if (logged) return;
    logged = true;

    // Extract project ID at response time (after auth middleware has run)
    const projectId = (req as any).projectId || 
                      parseInt(req.headers['x-project-id'] as string) ||
                      parseInt(req.params.projectId) ||
                      null;

    // Skip if no project ID (can't log without it)
    if (!projectId || isNaN(projectId)) {
      return;
    }

    try {
      const settings = await getLoggingSettings(projectId);
      if (!settings.enabled) return;

      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const errorMessage = statusCode >= 400 ? (body?.message || body?.error || null) : null;

      // Get user ID from request if available
      const userId = (req as any).appUser?.id || (req as any).user?.id || null;

      // Log asynchronously (fire-and-forget)
      logRequestToDb(
        projectId,
        req.method,
        req.originalUrl || req.url,
        statusCode,
        req.body,
        body,
        errorMessage,
        durationMs,
        userId,
        req.ip || req.socket.remoteAddress || null,
        req.get('user-agent') || null
      );
    } catch (error) {
      // Silent fail - don't break the request
    }
  };

  // Override res.json to capture response
  res.json = function (body: any) {
    responseBody = body;
    doLog(body);
    return originalJson(body);
  };

  // Override res.send to capture response
  res.send = function (body: any) {
    if (typeof body === 'string') {
      try {
        responseBody = JSON.parse(body);
      } catch {
        responseBody = body;
      }
    } else {
      responseBody = body;
    }
    doLog(responseBody);
    return originalSend(body);
  };

  // Also log on response finish in case json/send wasn't used
  res.on('finish', () => {
    doLog(responseBody);
  });

  next();
}

/**
 * Clear the settings cache (useful when settings are updated)
 */
export function clearLoggingSettingsCache(projectId?: number) {
  if (projectId) {
    settingsCache.delete(projectId);
  } else {
    settingsCache.clear();
  }
}
