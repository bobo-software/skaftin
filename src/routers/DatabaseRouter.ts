import { Router } from 'express';
import { Pool } from 'pg';
import { createDatabaseRouteDefinitions } from './definitions/databaseRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyClientRoutes } from './helpers/routeHelper';

/**
 * Create client database router
 * Uses hybrid authentication (API key or SuperTokens) with project ID from API key or URL
 */
export function createDatabaseRouter(pool: Pool): Router {
  const router = Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false
  const routes = createDatabaseRouteDefinitions();

  // Apply routes with hybrid middleware and client paths
  applyClientRoutes(router, routes, middlewareBuilder.buildAuthChain(), pool);

  return router;
}

// Export as both factory and direct router for backward compatibility
export const DatabaseRouter = createDatabaseRouter;
export { DatabaseRouter as router };

