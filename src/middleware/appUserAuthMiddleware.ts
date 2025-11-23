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
      // Express normalizes headers to lowercase automatically
      const apiKey = req.headers['x-api-key'] as string | undefined;
      const accessToken = req.headers['x-access-token'] as string | undefined;
      const credential = apiKey || accessToken;
      
      // Debug: Log all headers to see what we're receiving
      if (req.originalUrl?.includes('/api/app-auth')) {
        console.log(`🔍 [extractProject] URL: ${req.originalUrl}`);
        console.log(`🔍 [extractProject] Method: ${req.method}`);
        console.log(`🔍 [extractProject] All headers:`, Object.keys(req.headers).filter(k => k.toLowerCase().includes('api') || k.toLowerCase().includes('access')));
        console.log(`🔍 [extractProject] x-api-key:`, apiKey ? `${apiKey.substring(0, 30)}...` : 'MISSING');
        console.log(`🔍 [extractProject] x-access-token:`, accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING');
      }
      
      if (credential) {
        console.log(`🔍 Looking up project for credential: ${credential.substring(0, 20)}...`);
        try {
          const result = await pool.query(
            'SELECT project_id, credential_type, is_active FROM skaftin_system_api_credentials WHERE token = $1',
            [credential]
          );

          if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`🔍 Found credential:`, {
              project_id: row.project_id,
              credential_type: row.credential_type,
              is_active: row.is_active
            });
            
            if (row.is_active) {
              projectId = row.project_id;
              console.log(`📍 Project extracted from credential: ${projectId}`);
            } else {
              console.log(`⚠️ Credential found but is inactive`);
            }
          } else {
            console.log(`⚠️ No credential found in database for: ${credential.substring(0, 20)}...`);
            // Debug: Check if any credentials exist
            const debugResult = await pool.query('SELECT COUNT(*) as count FROM skaftin_system_api_credentials');
            console.log(`🔍 Total credentials in database: ${debugResult.rows[0]?.count || 0}`);
          }
        } catch (dbError) {
          console.error('❌ Database error looking up credential:', dbError);
        }
      } else {
        console.log(`⚠️ No API key or access token found in headers`);
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
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
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
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
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
        `SELECT id, email, is_active FROM ${req.schemaName}.skaftin_system_users WHERE id = $1`,
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

