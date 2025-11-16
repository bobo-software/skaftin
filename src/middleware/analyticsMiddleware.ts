import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { SuperTokensAuthenticatedRequest } from './supertokensAuthMiddleware';
import { HybridAuthRequest } from './hybridAuthMiddleware';

// Extended request type that can have projectId from middleware or params
type AnalyticsRequest = (SuperTokensAuthenticatedRequest | HybridAuthRequest) & {
  projectId?: number;
  _startTime?: number;
};

/**
 * Analytics middleware to track API requests
 * Should be placed after authentication middleware but before route handlers
 */
export const analyticsMiddleware = (req: AnalyticsRequest, res: Response, next: NextFunction) => {
  // Record start time
  req._startTime = Date.now();

  // Get project ID from request (middleware or params)
  const projectId = req.projectId || req.params?.projectId || req.params?.id;
  
  // Skip analytics for certain endpoints
  const skipEndpoints = [
    '/api/health',
    '/api/analytics', // Don't track analytics endpoints themselves
  ];

  const shouldSkip = skipEndpoints.some((endpoint) => req.path.startsWith(endpoint));

  if (!projectId || shouldSkip) {
    return next();
  }

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Calculate response time
    const responseTime = req._startTime ? Date.now() - req._startTime : 0;

    // Get user ID
    const userId = (req as any).session?.getUserId?.() || (req as any).user?.userId || null;

    // Get API key ID if present
    const apiKeyId = (req as any).apiKeyId || null;

    // Record metric asynchronously (don't block response)
    if (projectId) {
      const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
      
      if (!isNaN(projectIdNum)) {
        AnalyticsService.recordApiMetric({
          projectId: projectIdNum,
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          userId: userId?.toString() || undefined,
          apiKeyId: apiKeyId || undefined,
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.headers['user-agent'] || undefined,
        }).catch((error) => {
          // Silently fail - don't break the request
          console.error('Error recording API metric:', error);
        });
      }
    }

    return originalJson(body);
  };

  next();
};

/**
 * Optional analytics middleware that only tracks if projectId is available
 * Use this for routes where projectId might not always be present
 */
export const optionalAnalyticsMiddleware = (req: AnalyticsRequest, res: Response, next: NextFunction) => {
  const projectId = req.projectId || req.params?.projectId || req.params?.id;
  
  if (projectId) {
    return analyticsMiddleware(req, res, next);
  }
  
  next();
};

