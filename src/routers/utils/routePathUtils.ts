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
 * Transform route path for client routes (remove :projectId prefix)
 */
export function getClientPath(path: RoutePath): RoutePath {
  if (path instanceof RegExp) {
    return path; // Regex paths are already handled correctly
  }
  
  const pathString = path as string;
  // Remove projectId prefix if present
  return pathString.replace(/^\/:projectId/, '');
}

/**
 * Get route path based on admin/client mode
 */
export function getRoutePath(route: RouteDefinition, isAdmin: boolean): RoutePath {
  if (isAdmin) {
    return getAdminPath(route.path, route.requiresProject);
  } else {
    return getClientPath(route.path);
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

