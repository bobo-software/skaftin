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
}

/**
 * Middleware to verify JWT token and attach user info to request
 */
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseUtils.error(res, 'Authentication token required', null, null, 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return ResponseUtils.error(res, 'Authentication token required', null, null, 401);
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
  } catch (error: any) {
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
 */
export const verifyProjectAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return ResponseUtils.error(res, 'Authentication required', null, null, 401);
    }

    // Try to get projectId from params (could be :id or :projectId) or body
    const projectId = req.params?.projectId || req.params?.id || req.body?.projectId;
    
    if (!projectId) {
      console.error('Project ID not found in params or body:', { params: req.params, body: req.body });
      return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
    }

    const projectIdInt = parseInt(projectId, 10);

    if (isNaN(projectIdInt)) {
      return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
    }

    // Admin users have access to all projects
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has access to this project
    if (!req.user.projectIds || !req.user.projectIds.includes(projectIdInt)) {
      console.log(`Access denied: User ${req.user.userId} tried to access project ${projectIdInt}. User's projects: ${req.user.projectIds}`);
      return ResponseUtils.error(res, 'Access denied: You do not have permission to access this project', null, null, 403);
    }

    next();
  } catch (error) {
    console.error('Project access verification error:', error);
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

