import { Router } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createStorageRouteDefinitions } from './definitions/storageRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyAdminRoutes } from './helpers/routeHelper';

/**
 * Create admin storage router
 * Uses SuperTokens authentication with project ID in URL path
 */
export function createAdminStorageRouter(pool: Pool, s3Client: S3Client): Router {
  const router = Router();
  const middlewareBuilder = createMiddlewareBuilder(pool, true); // isAdmin = true
  const routes = createStorageRouteDefinitions(true); // isAdmin = true

  // Apply routes with admin middleware and path transformation
  applyAdminRoutes(router, routes, middlewareBuilder.buildAuthMiddleware());

  return router;
}

// Legacy export for backward compatibility
export const AdminStorageRouter = createAdminStorageRouter;

