import { Router } from 'express';
import { Pool } from 'pg';
import { createDatabaseRouteDefinitions } from './definitions/databaseRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyAdminRoutes } from './helpers/routeHelper';

/**
 * Create admin database router
 * Uses SuperTokens authentication with project ID in URL path
 */
export function createAdminDatabaseRouter(pool: Pool): Router {
  const router = Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, true); // isAdmin = true
  const routes = createDatabaseRouteDefinitions();

  // Apply routes with admin middleware and path transformation
  applyAdminRoutes(router, routes, middlewareBuilder.buildAuthMiddleware(), pool);

  return router;
}

// Legacy export for backward compatibility
export const AdminDatabaseRouter = createAdminDatabaseRouter;

