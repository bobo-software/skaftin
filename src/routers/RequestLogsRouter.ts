import express, { Router } from 'express';
import RequestLogsController from '../controllers/RequestLogsController';
import { Pool } from 'pg';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';
import { hybridAuth } from '../middleware/hybridAuthMiddleware';

export function createRequestLogsRouter(pool: Pool): Router {
  const router = express.Router();
  
  // Initialize controller
  RequestLogsController.initialize(pool);

  // SuperTokens auth middleware for dashboard routes
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  // ============================================================================
  // DASHBOARD ROUTES (SuperTokens authentication)
  // ============================================================================
  
  // Settings management
  router.get('/:projectId/settings', authMiddleware, RequestLogsController.getSettings);
  router.put('/:projectId/settings', authMiddleware, RequestLogsController.updateSettings);
  
  // Stats (POST with payload) - must be before /:projectId/:logId to avoid matching 'stats' as logId
  router.post('/:projectId/stats', authMiddleware, RequestLogsController.getStats);
  
  // List and view logs
  router.get('/:projectId', authMiddleware, RequestLogsController.listLogs);
  router.get('/:projectId/:logId', authMiddleware, RequestLogsController.getLog);
  
  // Manual cleanup
  router.delete('/:projectId', authMiddleware, RequestLogsController.cleanup);

  return router;
}

/**
 * Client-facing router for creating log entries
 * Uses hybrid auth (API key or app user JWT)
 */
export function createClientRequestLogsRouter(pool: Pool): Router {
  const router = express.Router();
  
  // Initialize controller
  RequestLogsController.initialize(pool);

  // Create log entry (hybrid auth - API key or app user JWT)
  router.post('/:projectId', hybridAuth, RequestLogsController.createLog);

  return router;
}
