import express, { Router } from 'express';
import AnalyticsController from '../controllers/AnalyticsController';
import { Pool } from 'pg';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';

/**
 * Create analytics router
 * Uses hybrid authentication (API key or SuperTokens) with project ID from API key or URL
 */
export function createAnalyticsRouter(pool: Pool): Router {
  const router = express.Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false

  // All routes require authentication and project access
  const authMiddleware = middlewareBuilder.buildAuthChain();

  // Analytics routes
  router.get('/:projectId/overview', authMiddleware, AnalyticsController.getOverview);
  router.get('/:projectId/api', authMiddleware, AnalyticsController.getApiMetrics);
  router.get('/:projectId/database', authMiddleware, AnalyticsController.getDatabaseMetrics);
  router.get('/:projectId/storage', authMiddleware, AnalyticsController.getStorageMetrics);

  return router;
}

// Export as both factory and direct router for backward compatibility
export const AnalyticsRouter = createAnalyticsRouter;
export { AnalyticsRouter as router };

