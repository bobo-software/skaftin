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
 * For routes that requireProject, add :projectId prefix (needed for SuperTokens users)
 * For routes that don't requireProject, remove :projectId prefix if present
 * For public routes (requiresAuth=false), don't add :projectId even if requiresProject=true
 *   because project will be extracted from API key header
 */
export function getClientPath(path: RoutePath, requiresProject: boolean = false, requiresAuth: boolean = true): RoutePath {
  if (path instanceof RegExp) {
    return path; // Regex paths are already handled correctly
  }
  
  const pathString = path as string;
  
  // For public routes (requiresAuth=false), don't add :projectId to path
  // Project will be extracted from API key header instead
  if (!requiresAuth) {
    return pathString.replace(/^\/:projectId/, '');
  }
  
  // If route requires project and is authenticated, ensure :projectId is in path (for SuperTokens URL param extraction)
  if (requiresProject && !pathString.includes('/:projectId')) {
    return `/:projectId${pathString}`;
  }
  
  // Otherwise, remove projectId prefix if present (for routes that don't need it)
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

