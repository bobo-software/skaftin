import { Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import ResponseUtils from '../utils/ResponseUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';

// Extended request type that can have projectId from middleware or params
type AnalyticsRequest = (SuperTokensAuthenticatedRequest | HybridAuthRequest) & {
  projectId?: number;
};

class AnalyticsController {
  /**
   * Helper to get projectId from request
   */
  private static getProjectId(req: AnalyticsRequest): number | null {
    // Prefer projectId from middleware (extracted from API key)
    if (req.projectId) {
      return typeof req.projectId === 'string' ? parseInt(req.projectId, 10) : req.projectId;
    }
    // Fallback to params (for SuperTokens routes)
    const projectId = req.params?.projectId || req.params?.id;
    if (projectId) {
      return typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    }
    return null;
  }

  /**
   * Get overview metrics for a project
   * GET /api/analytics/:projectId/overview
   */
  static async getOverview(req: AnalyticsRequest, res: Response) {
    try {
      const projectId = AnalyticsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Parse time range from query params (default to last 7 days)
      const days = parseInt(req.query.days as string) || 7;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      const metrics = await AnalyticsService.getOverviewMetrics(projectId, { start, end });

      ResponseUtils.success(res, 'Overview metrics retrieved successfully', metrics);
    } catch (error) {
      console.error('Error getting overview metrics:', error);
      ResponseUtils.error(res, 'Failed to get overview metrics', error);
    }
  }

  /**
   * Get API metrics for a project
   * GET /api/analytics/:projectId/api
   */
  static async getApiMetrics(req: AnalyticsRequest, res: Response) {
    try {
      const projectId = AnalyticsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Parse time range from query params (default to last 7 days)
      const days = parseInt(req.query.days as string) || 7;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      // Parse groupBy (default to 'hour' for <= 7 days, 'day' for > 7 days)
      const groupBy = (req.query.groupBy as 'hour' | 'day') || (days <= 7 ? 'hour' : 'day');

      const metrics = await AnalyticsService.getApiMetrics(projectId, { start, end }, groupBy);

      ResponseUtils.success(res, 'API metrics retrieved successfully', metrics);
    } catch (error) {
      console.error('Error getting API metrics:', error);
      ResponseUtils.error(res, 'Failed to get API metrics', error);
    }
  }

  /**
   * Get database metrics for a project
   * GET /api/analytics/:projectId/database
   */
  static async getDatabaseMetrics(req: AnalyticsRequest, res: Response) {
    try {
      const projectId = AnalyticsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Parse time range from query params (default to last 7 days)
      const days = parseInt(req.query.days as string) || 7;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      // Parse groupBy (default to 'hour' for <= 7 days, 'day' for > 7 days)
      const groupBy = (req.query.groupBy as 'hour' | 'day') || (days <= 7 ? 'hour' : 'day');

      const metrics = await AnalyticsService.getDatabaseMetrics(projectId, { start, end }, groupBy);

      ResponseUtils.success(res, 'Database metrics retrieved successfully', metrics);
    } catch (error) {
      console.error('Error getting database metrics:', error);
      ResponseUtils.error(res, 'Failed to get database metrics', error);
    }
  }

  /**
   * Get storage metrics for a project
   * GET /api/analytics/:projectId/storage
   */
  static async getStorageMetrics(req: AnalyticsRequest, res: Response) {
    try {
      const projectId = AnalyticsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      // Parse time range from query params (default to last 7 days)
      const days = parseInt(req.query.days as string) || 7;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      // Parse groupBy (default to 'hour' for <= 7 days, 'day' for > 7 days)
      const groupBy = (req.query.groupBy as 'hour' | 'day') || (days <= 7 ? 'hour' : 'day');

      const metrics = await AnalyticsService.getStorageMetrics(projectId, { start, end }, groupBy);

      ResponseUtils.success(res, 'Storage metrics retrieved successfully', metrics);
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      ResponseUtils.error(res, 'Failed to get storage metrics', error);
    }
  }
}

export default AnalyticsController;

