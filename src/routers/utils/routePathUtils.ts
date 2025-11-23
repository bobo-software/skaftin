import { RouteDefinition, RoutePath } from '../registry/types';

/**
 * Utility functions for route path transformations
 */

/**
 * Transform route path for admin routes (add :projectId prefix)
 */
export function getAdminPath(path: RoutePath, requiresProject: boolean = true): RoutePath {
  if (path instanceof RegExp) {
    return path; // Regex paths are already handled correctly
  }

  const pathString = path as string;
  
  // Skip if path already has projectId
  if (pathString.includes('/:projectId')) {
    return path;
  }
  
  // Add projectId prefix for routes that need it
  if (requiresProject) {
    return `/:projectId${pathString}`;
  }
  
  return path;
}

/**
 * Transform route path for client routes
 * Client routes NEVER include :projectId in the path - project is always extracted from API key header
 * This applies to both public and authenticated client routes
 * The hybrid auth middleware handles project extraction from:
 *   - X-API-Key or X-Access-Token header (for API key auth)
 *   - SuperTokens session (for platform admin fallback)
 */
export function getClientPath(path: RoutePath, requiresProject: boolean = false, requiresAuth: boolean = true): RoutePath {
  if (path instanceof RegExp) {
    return path; // Regex paths are already handled correctly
  }
  
  const pathString = path as string;
  
  // For client routes, always remove :projectId prefix if present
  // Project is extracted from API key header, not from URL path
  return pathString.replace(/^\/:projectId/, '');
}

/**
 * Get route path based on admin/client mode
 */
export function getRoutePath(route: RouteDefinition, isAdmin: boolean): RoutePath {
  if (isAdmin) {
    return getAdminPath(route.path, route.requiresProject ?? false);
  } else {
    return getClientPath(route.path, route.requiresProject ?? false, route.requiresAuth ?? true);
  }
}

/**
 * Create route path with conditional admin prefix
 * Helper for route definitions to avoid repeating ternary operators
 */
export function createRoutePath(path: string, isAdmin: boolean): string {
  if (isAdmin && !path.includes('/:projectId')) {
    // For admin routes, check if we need to add projectId prefix
    // This is mainly for backwards compatibility - most admin paths already include it
    return path;
  }
  return path;
}

