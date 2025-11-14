import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

export interface AppUserAuthenticatedRequest extends Request {
  appUser?: {
    userId: number;
    email: string;
    projectId: number;
    roles: any[];
  };
  projectId?: number;
  schemaName?: string;
}

/**
 * Middleware to extract project information from API key or JWT token
 * Sets req.projectId and req.schemaName for downstream handlers
 */
export function extractProjectFromCredentials(pool: Pool) {
  return async (req: AppUserAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let projectId: number | null = null;

      // Method 1: Extract from API key or access token (x-api-key or x-access-token header)
      const apiKey = req.headers['x-api-key'] as string;
      const accessToken = req.headers['x-access-token'] as string;
      const credential = apiKey || accessToken;
      
      if (credential) {
        const result = await pool.query(
          'SELECT project_id FROM api_credentials WHERE token = $1 AND is_active = true',
          [credential]
        );

        if (result.rows.length > 0) {
          projectId = result.rows[0].project_id;
          console.log(`📍 Project extracted from credential: ${projectId}`);
        }
      }

      // Method 2: Extract from JWT token (Authorization header)
      if (!projectId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          
          try {
            const decoded = jwt.verify(
              token,
              process.env.JWT_SECRET || 'your-secret-key'
            ) as any;

            if (decoded.projectId) {
              projectId = parseInt(decoded.projectId);
              console.log(`📍 Project extracted from JWT: ${projectId}`);
            }
          } catch (jwtError) {
            // Invalid token - will be handled by auth middleware
          }
        }
      }

      // Method 3: Fallback to URL parameter if provided (backward compatibility)
      if (!projectId && req.params.projectId) {
        projectId = parseInt(req.params.projectId);
        console.log(`📍 Project from URL parameter: ${projectId}`);
      }

      // If we found a project, get its schema and attach to request
      if (projectId) {
        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
        );

        if (schemaResult.rows.length > 0) {
          req.projectId = projectId;
          req.schemaName = schemaResult.rows[0].schema_name;
          console.log(`✅ Project context set: ${projectId} (${req.schemaName})`);
        }
      }

      next();
    } catch (error) {
      console.error('Error extracting project from credentials:', error);
      next(); // Continue anyway - other middleware will handle auth
    }
  };
}

/**
 * Middleware to verify and attach app user from JWT token
 * Requires extractProjectFromCredentials to run first
 */
export function verifyAppUserToken(pool: Pool) {
  return async (req: AppUserAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No authentication token provided',
        });
      }

      const token = authHeader.substring(7);

      // Verify JWT
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;

      // If projectId was not extracted from credentials, use token's projectId
      if (!req.projectId && decoded.projectId) {
        req.projectId = parseInt(decoded.projectId);

        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [req.projectId]
        );

        if (schemaResult.rows.length > 0) {
          req.schemaName = schemaResult.rows[0].schema_name;
        }
      }

      // Verify user still exists and is active
      if (!req.schemaName) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
        });
      }

      const userResult = await pool.query(
        `SELECT id, email, is_active FROM ${req.schemaName}.app_users WHERE id = $1`,
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive',
        });
      }

      // Attach user info to request
      req.appUser = {
        userId: decoded.userId,
        email: decoded.email,
        projectId: req.projectId!,
        roles: decoded.roles || [],
      };

      console.log(`✅ App user authenticated: ${req.appUser.email} (Project: ${req.projectId})`);
      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }

      console.error('Error verifying app user token:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed',
      });
    }
  };
}

/**
 * Middleware to ensure project context is available
 * Use after extractProjectFromCredentials
 */
export function requireProjectContext(req: AppUserAuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.projectId || !req.schemaName) {
    return res.status(400).json({
      success: false,
      message: 'Project context not found. Please provide either x-api-key header, JWT token with projectId, or projectId in URL.',
    });
  }
  next();
}

