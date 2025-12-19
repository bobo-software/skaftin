import { Router } from 'express';
import { Pool } from 'pg';
import { createStorageRouteDefinitions } from './definitions/storageRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { filterGetAndPostRoutes } from './helpers/publicRouteHelper';
import { applyPublicRoutes } from './helpers/publicRouteHelper';

/**
 * Create public storage router
 * Exposes GET and POST endpoints with API key/access token authentication (no user auth required)
 */
export function createPublicStorageRouter(pool: Pool): Router {
  const router = Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false
  const allRoutes = createStorageRouteDefinitions(false); // isAdmin = false
  
  // Filter to only GET and POST routes
  const publicRoutes = filterGetAndPostRoutes(allRoutes);
  
  console.log('🔓 [PublicStorageRouter] Registering public GET and POST routes:');
  publicRoutes.forEach(route => {
    console.log(`   ${route.method.toUpperCase()} ${route.path} -> /app-api-2/storage${route.path}`);
  });
  
  // Apply routes with API key only middleware
  applyPublicRoutes(router, publicRoutes, middlewareBuilder.buildApiKeyOnlyChain(), pool);

  return router;
}
