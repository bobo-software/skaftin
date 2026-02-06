/**
 * Migrations Router
 * 
 * API endpoints for managing database migrations
 * All routes require SuperTokens authentication
 */

import { Router } from 'express';
import MigrationsController from '../controllers/MigrationsController';
import { authenticateAndAttachUser } from '../middleware/supertokensAuthMiddleware';

export function createMigrationsRouter(): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authenticateAndAttachUser);

  // List all available migrations
  router.get('/', MigrationsController.listMigrations);

  // Run all migrations
  router.post('/run-all', MigrationsController.runAll);

  // Run batch migrations
  router.post('/run-batch', MigrationsController.runBatch);

  // Get specific migration content
  router.get('/:filename', MigrationsController.getMigration);

  // Run specific migration
  router.post('/:filename/run', MigrationsController.runMigration);

  return router;
}

export default createMigrationsRouter;
