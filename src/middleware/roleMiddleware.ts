import { Response, NextFunction } from 'express';
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import { AppUserSuperTokensRequest } from './appUserSuperTokensMiddleware';

/**
 * Middleware to check if user has required roles
 * Supports both role keys (string) and role IDs (number)
 * User must have at least one of the required roles
 */
export function requireRoles(pool: Pool, requiredRoles: string[] | number[]) {
  return async (req: AppUserSuperTokensRequest, res: Response, next: NextFunction) => {
    try {
      // If no roles required, allow access
      if (!requiredRoles || requiredRoles.length === 0) {
        return next();
      }

      // Check if app user is authenticated
      if (!req.appUser) {
        return ResponseUtils.error(
          res,
          'Authentication required',
          null,
          null,
          401
        );
      }

      const userRoles = req.appUser.roles || [];
      
      if (userRoles.length === 0) {
        console.log('🔒 [requireRoles] User has no roles assigned');
        return ResponseUtils.error(
          res,
          'Insufficient permissions. Required roles: ' + requiredRoles.join(', '),
          null,
          null,
          403
        );
      }

      // Check if user has at least one required role
      const hasRequiredRole = requiredRoles.some(requiredRole => {
        // Check if requiredRole is a string (role_key) or number (role_id)
        if (typeof requiredRole === 'string') {
          // Match by role_key
          return userRoles.some((userRole: any) => 
            userRole.role_key === requiredRole
          );
        } else {
          // Match by role id
          return userRoles.some((userRole: any) => 
            userRole.id === requiredRole
          );
        }
      });

      if (!hasRequiredRole) {
        console.log('🔒 [requireRoles] Access denied');
        console.log('  └─ User roles:', userRoles.map((r: any) => r.role_key || r.id));
        console.log('  └─ Required roles:', requiredRoles);
        
        return ResponseUtils.error(
          res,
          'Insufficient permissions. Required roles: ' + requiredRoles.join(', '),
          null,
          null,
          403
        );
      }

      console.log('✅ [requireRoles] Access granted');
      console.log('  └─ User has required role(s)');
      next();
    } catch (error: any) {
      console.error('Error checking roles:', error);
      return ResponseUtils.error(
        res,
        'Failed to verify role permissions',
        error
      );
    }
  };
}

/**
 * Middleware to check if user has a specific role (convenience function)
 */
export function requireRole(pool: Pool, requiredRole: string | number) {
  if (typeof requiredRole === 'string') {
    return requireRoles(pool, [requiredRole]);
  } else {
    return requireRoles(pool, [requiredRole]);
  }
}
