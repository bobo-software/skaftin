import { Router } from 'express';
import { Pool } from 'pg';
import { createAuthRouteDefinitions } from './definitions/authRoutes';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyClientRoutes } from './helpers/routeHelper';
import AuthUsersController from '../controllers/AuthUsersController';
import AppAuthController from '../controllers/AppAuthController';
import RolesController from '../controllers/RolesController';
import CustomFieldsController from '../controllers/CustomFieldsController';
import AuthSettingsController from '../controllers/AuthSettingsController';

/**
 * Create client auth router
 * Uses hybrid authentication (API key or SuperTokens) with project ID from API key or URL
 */
export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controllers
  AuthUsersController.initialize(pool);
  AppAuthController.initialize(pool);
  RolesController.initialize(pool);
  CustomFieldsController.initialize(pool);
  AuthSettingsController.initialize(pool);

  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false
  const routes = createAuthRouteDefinitions(false); // isAdmin = false

  // Split routes into public (app auth) and protected (management)
  const publicRoutes = routes.filter(r => !r.requiresAuth);
  const protectedRoutes = routes.filter(r => r.requiresAuth);

  // Apply public routes with project extraction only
  applyClientRoutes(router, publicRoutes, middlewareBuilder.buildProjectOnlyChain());

  // Apply protected routes with full auth chain
  applyClientRoutes(router, protectedRoutes, middlewareBuilder.buildAuthChain());

  return router;
}
