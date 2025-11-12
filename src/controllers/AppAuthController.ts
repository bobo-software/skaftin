import { Response } from 'express';
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppUserAuthenticatedRequest } from '../middleware/appUserAuthMiddleware';

/**
 * Authentication controller for application users
 * Separate from platform admin authentication
 */
class AppAuthController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    AppAuthController.pool = pool;
  }

  /**
   * Get project schema name from project ID
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    try {
      const result = await AppAuthController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [projectId]
      );
      return result.rows.length > 0 ? result.rows[0].schema_name : null;
    } catch (error) {
      console.error('Error fetching project schema:', error);
      return null;
    }
  }

  /**
   * Register a new app user
   * POST /api/app-auth/auth/register (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/register (backward compatibility)
   */
  static async register(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { name, email, password, phone, metadata } = req.body;

      if (!name || !email || !password) {
        return ResponseUtils.error(res, 'Name, email, and password are required', null, null, 400);
      }

      // Check if registration is enabled
      const settingsResult = await AppAuthController.pool.query(
        'SELECT registration_enabled, auth_enabled FROM auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      if (!settingsResult.rows[0].registration_enabled) {
        return ResponseUtils.error(res, 'Registration is disabled for this project', null, null, 403);
      }

      // Check if email already exists
      const existingUser = await AppAuthController.pool.query(
        `SELECT id FROM ${schemaName}.app_users WHERE email = $1`,
        [email]
      );

      if (existingUser.rows.length > 0) {
        return ResponseUtils.error(res, 'Email already registered', null, null, 409);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const insertResult = await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.app_users 
         (name, email, password, phone, metadata, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, true, false)
         RETURNING id, name, email, phone, is_active, created_at`,
        [name, email, hashedPassword, phone || null, JSON.stringify(metadata || {})]
      );

      const user = insertResult.rows[0];

      // Assign default role
      const defaultRoleResult = await AppAuthController.pool.query(
        'SELECT default_role_id FROM auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (defaultRoleResult.rows.length > 0 && defaultRoleResult.rows[0].default_role_id) {
        await AppAuthController.pool.query(
          `INSERT INTO ${schemaName}.app_user_roles (app_user_id, role_id)
           VALUES ($1, $2)`,
          [user.id, defaultRoleResult.rows[0].default_role_id]
        );
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          projectId: projectId,
        },
        jwtSecret,
        { expiresIn: '7d' } as jwt.SignOptions
      );

      console.log(`✅ App user registered: ${email} (Project: ${projectId})`);

      ResponseUtils.success(res, 'User registered successfully', {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          is_active: user.is_active,
        },
        token,
      }, 201);
    } catch (error) {
      console.error('Error registering app user:', error);
      ResponseUtils.error(res, 'Failed to register user', error);
    }
  }

  /**
   * Login an app user
   * POST /api/app-auth/auth/login (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/login (backward compatibility)
   */
  static async login(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
      }

      // Check if auth is enabled
      const settingsResult = await AppAuthController.pool.query(
        'SELECT auth_enabled FROM auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      // Find user
      const userResult = await AppAuthController.pool.query(
        `SELECT u.*, 
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
         FROM ${schemaName}.app_users u
         LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
         LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
         WHERE u.email = $1
         GROUP BY u.id`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive', null, null, 403);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
      }

      // Get session duration from user's primary role
      let sessionDuration = '7d'; // Default 7 days
      if (user.roles && user.roles.length > 0) {
        const primaryRole = user.roles[0];
        const roleResult = await AppAuthController.pool.query(
          `SELECT session_duration_minutes FROM ${schemaName}.app_roles WHERE id = $1`,
          [primaryRole.id]
        );
        if (roleResult.rows.length > 0 && roleResult.rows[0].session_duration_minutes) {
          sessionDuration = `${roleResult.rows[0].session_duration_minutes}m`;
        }
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          projectId: projectId,
          roles: user.roles,
        },
        jwtSecret,
        { expiresIn: sessionDuration } as jwt.SignOptions
      );

      console.log(`✅ App user logged in: ${email} (Project: ${projectId})`);

      // Remove password from response
      delete user.password;

      ResponseUtils.success(res, 'Login successful', {
        user,
        token,
      });
    } catch (error) {
      console.error('Error logging in app user:', error);
      ResponseUtils.error(res, 'Failed to login', error);
    }
  }

  /**
   * Verify app user token
   * POST /api/app-auth/auth/verify (with JWT token - projectId extracted from token)
   * POST /api/app-auth/:projectId/auth/verify (backward compatibility)
   */
  static async verify(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return ResponseUtils.error(res, 'No token provided', null, null, 401);
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

      // Get projectId from middleware, URL param, or token
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null) || decoded.projectId;
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Verify token matches project (if projectId was in URL or middleware)
      if (req.projectId && decoded.projectId !== req.projectId) {
        return ResponseUtils.error(res, 'Token does not match project context', null, null, 403);
      }

      // Get fresh user data
      const userResult = await AppAuthController.pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.is_active,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
         FROM ${schemaName}.app_users u
         LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
         LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive', null, null, 403);
      }

      ResponseUtils.success(res, 'Token is valid', { user });
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return ResponseUtils.error(res, 'Token expired', null, null, 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return ResponseUtils.error(res, 'Invalid token', null, null, 401);
      }
      console.error('Error verifying app user token:', error);
      ResponseUtils.error(res, 'Failed to verify token', error);
    }
  }

  /**
   * Logout app user (client-side token removal)
   * POST /api/app-auth/auth/logout
   * POST /api/app-auth/:projectId/auth/logout (backward compatibility)
   */
  static async logout(req: AppUserAuthenticatedRequest, res: Response) {
    // For JWT, logout is handled client-side by removing the token
    // We could implement token blacklisting here if needed
    ResponseUtils.success(res, 'Logged out successfully');
  }
}

export default AppAuthController;

