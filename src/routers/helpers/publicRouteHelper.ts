import { Router } from 'express';
import { Pool } from 'pg';
import { RouteDefinition, Middleware, RoutePath } from '../registry/types';
import { getClientPath } from '../utils/routePathUtils';

/**
 * Filter route definitions to only include GET and POST methods
 */
export function filterGetAndPostRoutes(routes: RouteDefinition[]): RouteDefinition[] {
  return routes.filter(route => route.method === 'get' || route.method === 'post');
}

/**
 * Apply public route definitions to Express router
 * Uses API key only authentication (no user auth required)
 */
export function applyPublicRoutes(
  router: Router,
  routes: RouteDefinition[],
  defaultMiddleware: Middleware[] = [],
  pool?: Pool
): void {
  for (const route of routes) {
    // Use client path format (no projectId in path, extracted from API key)
    const path = getClientPath(route.path, route.requiresProject ?? false, false);
    const middleware: Middleware[] = [...(route.middleware || [])];
    
    // Add default middleware (API key only auth, project extraction)
    middleware.push(...defaultMiddleware);
    
    const routeMethod = router[route.method].bind(router);

    // Wrap handler to ensure it returns void | Promise<void>
    const wrappedHandler = async (req: any, res: any, next?: any) => {
      await route.handler(req, res, next);
      return;
    };

    console.log(`   ✅ Registered: ${route.method.toUpperCase()} ${path}`);
    routeMethod(path, ...middleware, wrappedHandler);
  }
}
