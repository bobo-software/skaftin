import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/drizzle.config';
import { users } from '../db/schemas/UsersSchema';
import { projects } from '../db/schemas/ProjectsSchema';
import { eq } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

class AuthController {
  /**
   * Generate access token with user info and projects
   */
  // NOTE: This is legacy code - SuperTokens handles token generation now
  private static async generateAccessToken(userId: number, email: string, role: string = 'user'): Promise<string> {
    // Fetch user's projects
    const userProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.user_id, String(userId)));
    const projectIds = userProjects.map(p => p.id);

    return jwt.sign(
      {
        userId,
        email,
        role,
        projectIds,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    ) as string;
  }

  /**
   * Generate refresh token
   */
  private static generateRefreshToken(userId: number, email: string): string {
    return jwt.sign(
      {
        userId,
        email,
        type: 'refresh',
      },
      JWT_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRY } as jwt.SignOptions
    ) as string;
  }

  /**
   * Register a new user
   */
  static async register(req: Request, res: Response) {
    try {
      const { email, password, full_name } = req.body;

      // Validation
      if (!email || !password) {
        return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
      }

      if (password.length < 6) {
        return ResponseUtils.error(res, 'Password must be at least 6 characters', null, null, 400);
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (existingUser.length > 0) {
        return ResponseUtils.error(res, 'Email already registered', null, null, 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Generate username from email if not provided
      const username = email.split('@')[0];

      // Create user
      const result = await db
        .insert(users)
        .values({
          username,
          email,
          password_hash: passwordHash,
          full_name: full_name || null,
        })
        .returning();

      const user = result[0];

      // Generate tokens
      const accessToken = await AuthController.generateAccessToken(user.id, user.email);
      const refreshToken = AuthController.generateRefreshToken(user.id, user.email);

      ResponseUtils.success(res, 'User registered successfully', {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.full_name || user.username,
        },
        accessToken,
        refreshToken,
        // For backward compatibility
        token: accessToken,
      }, 201);
    } catch (error: any) {
      console.error('Register error:', error);

      // Handle unique constraint violations
      if (error.code === '23505') {
        return ResponseUtils.error(res, 'Email already registered', null, null, 409);
      }

      ResponseUtils.error(res, 'Failed to register user', error);
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
      }

      // Find user by email
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
      }

      const user = result[0];

      // Check if user has a password_hash
      if (!user.password_hash) {
        return ResponseUtils.error(
          res,
          'Account not set up for password authentication. Please use registration.',
          null,
          null,
          401
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
      }

      // Generate tokens
      const accessToken = await AuthController.generateAccessToken(user.id, user.email);
      const refreshToken = AuthController.generateRefreshToken(user.id, user.email);

      ResponseUtils.success(res, 'Login successful', {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.full_name || user.username,
        },
        accessToken,
        refreshToken,
        // For backward compatibility
        token: accessToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      ResponseUtils.error(res, 'Failed to login', error);
    }
  }

  /**
   * Verify token (optional endpoint for frontend to check if token is still valid)
   */
  static async verify(req: Request, res: Response) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return ResponseUtils.error(res, 'Authentication token required', null, null, 401);
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Check token type
      if (decoded.type && decoded.type !== 'access') {
        return ResponseUtils.error(res, 'Invalid token type', null, null, 403);
      }

      // Get user from database
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          full_name: users.full_name,
        })
        .from(users)
        .where(eq(users.id, decoded.userId));

      if (result.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = result[0];

      ResponseUtils.success(res, 'Token is valid', {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.full_name || user.username,
          projectIds: decoded.projectIds || [],
          role: decoded.role || 'user',
        },
      });
    } catch (error: any) {
      console.error('Verify error:', error);
      if (error.name === 'TokenExpiredError') {
        return ResponseUtils.error(res, 'Token has expired', error, null, 403);
      }
      ResponseUtils.error(res, 'Invalid or expired token', error, null, 403);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return ResponseUtils.error(res, 'Refresh token required', null, null, 400);
      }

      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;

      // Verify it's a refresh token
      if (decoded.type !== 'refresh') {
        return ResponseUtils.error(res, 'Invalid token type', null, null, 403);
      }

      // Generate new access token
      const newAccessToken = await AuthController.generateAccessToken(decoded.userId, decoded.email);

      ResponseUtils.success(res, 'Token refreshed successfully', {
        accessToken: newAccessToken,
        token: newAccessToken, // For backward compatibility
      });
    } catch (error: any) {
      console.error('Refresh token error:', error);
      if (error.name === 'TokenExpiredError') {
        return ResponseUtils.error(res, 'Refresh token has expired. Please login again.', error, null, 403);
      }
      ResponseUtils.error(res, 'Invalid refresh token', error, null, 403);
    }
  }

  /**
   * Logout (invalidate refresh token - client should delete stored tokens)
   */
  static async logout(req: Request, res: Response) {
    // In a production app, you'd want to:
    // 1. Add refresh tokens to a blacklist/database
    // 2. Implement token revocation
    // For now, we just send a success response and rely on client to delete tokens
    
    ResponseUtils.success(res, 'Logged out successfully');
  }
}

export default AuthController;
