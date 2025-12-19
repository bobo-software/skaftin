import { Router } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createStorageRouteDefinitions } from './definitions/storageRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyClientRoutes } from './helpers/routeHelper';
import { authenticateAndAttachUser } from '../middleware/supertokensAuthMiddleware';

/**
 * Create client storage router
 * Uses hybrid authentication (API key or SuperTokens) with project ID from API key or URL
 */
export function createStorageRouter(pool: Pool): Router {
  const router = Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false
  const routes = createStorageRouteDefinitions(false); // isAdmin = false

  // Special handling for bucket routes that use optional auth
  const bucketRoutes = routes.filter(r => r.path === '/buckets' && r.method === 'get');
  const fileRoutes = routes.filter(r => r.path !== '/buckets' || r.method !== 'get');
  
  // Apply bucket list route with optional auth (uses project extractor + optional auth)
  for (const route of bucketRoutes) {
    const projectExtractor = middlewareBuilder.buildProjectExtractor();
    const optionalAuth = middlewareBuilder.buildOptionalAuth();
    router.get(route.path, projectExtractor, optionalAuth, route.handler);
  }
  
  // Apply other bucket routes (create, delete) with SuperTokens auth
  for (const route of routes) {
    if (route.path === '/buckets' && (route.method === 'post' || route.method === 'delete')) {
      const routeMethod = router[route.method].bind(router);
      routeMethod(route.path, ...authenticateAndAttachUser, route.handler);
    }
  }

  // Separate routes that require project from those that don't
  const projectRequiredRoutes = fileRoutes.filter(r => r.requiresProject !== false);
  const projectOptionalRoutes = fileRoutes.filter(r => r.requiresProject === false);
  
  // Apply routes that require project with full auth chain
  applyClientRoutes(router, projectRequiredRoutes, middlewareBuilder.buildAuthChain(), pool);
  
  // Apply routes that don't require project with optional project auth chain
  applyClientRoutes(router, projectOptionalRoutes, middlewareBuilder.buildOptionalProjectAuthChain(), pool);

  return router;
}

