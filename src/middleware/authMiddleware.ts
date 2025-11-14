import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ResponseUtils from '../utils/ResponseUtils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    projectIds?: number[];
    role?: string;
    iat?: number;
    exp?: number;
  };
  projectId?: number;
  schemaName?: string;
}

/**
 * Middleware to verify JWT token and attach user info to request
 */
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🔐 [authenticateToken] Starting token verification');
    console.log('  └─ URL:', req.originalUrl);
    
    const authHeader = req.headers.authorization;
    console.log('  └─ Auth Header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('  └─ ❌ No Bearer token found');
      return ResponseUtils.error(res, 'Authentication token required', null, null, 401);
    }

    const token = authHeader.split(' ')[1];
    console.log('  └─ Token extracted:', token ? `${token.substring(0, 20)}...` : 'EMPTY');
    
    if (!token) {
      console.log('  └─ ❌ Token is empty after split');
      return ResponseUtils.error(res, 'Authentication token required', null, null, 401);
    }

    console.log('  └─ Attempting to verify token with JWT_SECRET');
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    console.log('  └─ ✅ Token decoded successfully');
    console.log('  └─ User ID:', decoded.userId);
    console.log('  └─ Email:', decoded.email);
    console.log('  └─ Project IDs:', decoded.projectIds);
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      projectIds: decoded.projectIds || [],
      role: decoded.role || 'user',
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (error: any) {
    console.log('  └─ ❌ Token verification failed');
    console.log('  └─ Error name:', error.name);
    console.log('  └─ Error message:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return ResponseUtils.error(res, 'Token has expired', error, null, 403);
    } else if (error.name === 'JsonWebTokenError') {
      return ResponseUtils.error(res, 'Invalid token', error, null, 403);
    }
    return ResponseUtils.error(res, 'Authentication failed', error, null, 403);
  }
};

/**
 * Middleware to verify user has access to a specific project
 * Supports both API key authentication (req.projectId) and SuperTokens/JWT (req.user)
 */
export const verifyProjectAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🔑 [verifyProjectAccess] Checking project access');
    
    // If projectId is set from API key, allow access (API key already verified project)
    if (req.projectId) {
      console.log('  └─ ✅ Project access granted (API key):', req.projectId);
      return next();
    }
    
    // Otherwise, require user authentication (SuperTokens/JWT)
    console.log('  └─ User:', req.user ? `ID ${req.user.userId}, Email: ${req.user.email}` : 'NOT FOUND');
    
    if (!req.user) {
      console.log('  └─ ❌ No user object found and no projectId from API key');
      return ResponseUtils.error(res, 'Authentication required', null, null, 401);
    }

    // Try to get projectId from params/body for SuperTokens users
    const projectId = req.params?.projectId || req.params?.id || req.body?.projectId;
    console.log('  └─ Project ID requested:', projectId);
    console.log('  └─ Request params:', JSON.stringify(req.params));
    
    if (!projectId) {
      console.error('  └─ ❌ Project ID not found in params or body:', { params: req.params, body: req.body });
      return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
    }

    const projectIdInt = typeof projectId === 'number' ? projectId : parseInt(projectId, 10);
    console.log('  └─ Project ID (parsed):', projectIdInt);

    if (isNaN(projectIdInt)) {
      console.log('  └─ ❌ Invalid project ID format');
      return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
    }

    // Admin users have access to all projects
    if (req.user.role === 'admin') {
      console.log('  └─ ✅ Admin user - access granted');
      return next();
    }

    // Check if user has access to this project
    console.log('  └─ User\'s project IDs:', req.user.projectIds);
    if (!req.user.projectIds || !req.user.projectIds.includes(projectIdInt)) {
      console.log(`  └─ ❌ Access denied: User ${req.user.userId} tried to access project ${projectIdInt}. User's projects: ${req.user.projectIds}`);
      return ResponseUtils.error(res, 'Access denied: You do not have permission to access this project', null, null, 403);
    }

    console.log('  └─ ✅ Access granted');
    next();
  } catch (error) {
    console.error('  └─ ❌ Project access verification error:', error);
    return ResponseUtils.error(res, 'Failed to verify project access', error);
  }
};

/**
 * Middleware to verify user has admin role
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return ResponseUtils.error(res, 'Authentication required', null, null, 401);
  }

  if (req.user.role !== 'admin') {
    return ResponseUtils.error(res, 'Admin access required', null, null, 403);
  }

  next();
};

/**
 * Optional authentication - attaches user if token is present but doesn't fail if not
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      projectIds: decoded.projectIds || [],
      role: decoded.role || 'user',
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (error) {
    // Invalid token, but that's okay for optional auth
    next();
  }
};

