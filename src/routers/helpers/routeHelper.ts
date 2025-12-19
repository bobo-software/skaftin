import { Router } from 'express';
import { Pool } from 'pg';
import { RouteDefinition, Middleware, RoutePath } from '../registry/types';
import { getAdminPath, getClientPath } from '../utils/routePathUtils';
import { requireRoles } from '../../middleware/roleMiddleware';

/**
 * Apply route definitions to Express router
 */
export function applyRoutes(
  router: Router,
  routes: RouteDefinition[],
  defaultMiddleware: Middleware[] = [],
  pathTransformer?: (route: RouteDefinition) => RoutePath,
  pool?: Pool // Optional pool for role-based middleware
): void {
  for (const route of routes) {
    const path = pathTransformer ? pathTransformer(route) : route.path;
    const middleware: Middleware[] = [...(route.middleware || [])];
    
    // Add role-based middleware if requiredRoles is specified and pool is available
    if (route.requiredRoles && route.requiredRoles.length > 0 && pool) {
      middleware.push(requireRoles(pool, route.requiredRoles));
    }
    
    // Add default middleware (auth, project extraction, etc.) after role check
    middleware.push(...defaultMiddleware);
    
    const routeMethod = router[route.method].bind(router);

    // Wrap handler to ensure it returns void | Promise<void>
    // Express handlers may return Response objects (e.g., from res.json() chaining), but we need void
    const wrappedHandler = async (req: any, res: any, next?: any) => {
      await route.handler(req, res, next);
      // Discard return value to ensure void return
      return;
    };

    routeMethod(path, ...middleware, wrappedHandler);
  }
}

/**
 * Apply route definitions with admin paths (/:projectId prefix)
 */
export function applyAdminRoutes(
  router: Router,
  routes: RouteDefinition[],
  defaultMiddleware: Middleware[] = [],
  pool?: Pool // Optional pool for role-based middleware
): void {
  applyRoutes(router, routes, defaultMiddleware, (route) => {
    return getAdminPath(route.path, route.requiresProject);
  }, pool);
}

/**
 * Apply route definitions with client paths
 * Routes that requireProject will have :projectId in path (for SuperTokens URL param extraction)
 * Public routes (requiresAuth=false) won't have :projectId in path (project extracted from API key)
 */
export function applyClientRoutes(
  router: Router,
  routes: RouteDefinition[],
  defaultMiddleware: Middleware[] = [],
  pool?: Pool // Optional pool for role-based middleware
): void {
  applyRoutes(router, routes, defaultMiddleware, (route) => {
    return getClientPath(route.path, route.requiresProject ?? false, route.requiresAuth ?? true);
  }, pool);
}
