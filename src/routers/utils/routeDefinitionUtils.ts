import { RouteDefinition, HttpMethod, RouteHandler } from '../registry/types';
import { createRoutePath } from './routePathUtils';

/**
 * Utility functions for creating route definitions
 */

/**
 * Create a route definition with common defaults
 */
export function createRoute(
  method: HttpMethod,
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  const {
    description,
    requiresProject = true,
    requiresAuth = true,
    isAdmin = false,
  } = options || {};

  return {
    method,
    path: createRoutePath(path, isAdmin),
    handler,
    description,
    requiresProject,
    requiresAuth,
  };
}

/**
 * Create a GET route
 */
export function createGetRoute(
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  return createRoute('get', path, handler, options);
}

/**
 * Create a POST route
 */
export function createPostRoute(
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  return createRoute('post', path, handler, options);
}

/**
 * Create a PUT route
 */
export function createPutRoute(
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  return createRoute('put', path, handler, options);
}

/**
 * Create a PATCH route
 */
export function createPatchRoute(
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  return createRoute('patch', path, handler, options);
}

/**
 * Create a DELETE route
 */
export function createDeleteRoute(
  path: string,
  handler: RouteHandler,
  options?: {
    description?: string;
    requiresProject?: boolean;
    requiresAuth?: boolean;
    isAdmin?: boolean;
  }
): RouteDefinition {
  return createRoute('delete', path, handler, options);
}

