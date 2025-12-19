import { Router } from 'express';
import { Pool } from 'pg';
import { createWorkflowRouteDefinitions } from './definitions/workflowRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyAdminRoutes } from './helpers/routeHelper';
import WorkflowsController from '../controllers/WorkflowsController';

/**
 * Create workflows router for admin routes
 */
export function createWorkflowsRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controller
  WorkflowsController.initialize(pool);

  // Create middleware builder for admin routes
  const middlewareBuilder = createMiddlewareBuilder(pool, true); // isAdmin = true

  // Get route definitions
  const routes = createWorkflowRouteDefinitions();

  // Apply routes with admin middleware and path transformation
  applyAdminRoutes(router, routes, middlewareBuilder.buildAuthChain(), pool);

  return router;
}

