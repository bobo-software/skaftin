import { Router } from 'express';
import { Pool } from 'pg';
import { createAuthRouteDefinitions } from './definitions/authRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyAdminRoutes } from './helpers/routeHelper';
import AuthUsersController from '../controllers/AuthUsersController';
import RolesController from '../controllers/RolesController';
import CustomFieldsController from '../controllers/CustomFieldsController';
import AuthSettingsController from '../controllers/AuthSettingsController';

/**
 * Create admin auth router
 * Uses SuperTokens authentication with project ID in URL path
 */
export function createAdminAuthRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controllers
  AuthUsersController.initialize(pool);
  RolesController.initialize(pool);
  CustomFieldsController.initialize(pool);
  AuthSettingsController.initialize(pool);

  const middlewareBuilder = createMiddlewareBuilder(pool, true); // isAdmin = true
  const routes = createAuthRouteDefinitions(true); // isAdmin = true

  // Split routes into public (app auth) and protected (management)
  const publicRoutes = routes.filter(r => !r.requiresAuth);
  const protectedRoutes = routes.filter(r => r.requiresAuth);

  // Apply public routes with project extraction only
  applyAdminRoutes(router, publicRoutes, middlewareBuilder.buildProjectOnlyChain());

  // Apply protected routes with full auth middleware
  applyAdminRoutes(router, protectedRoutes, middlewareBuilder.buildAuthMiddleware());

  return router;
}

