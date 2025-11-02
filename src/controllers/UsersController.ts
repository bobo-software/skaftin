import { Request, Response } from 'express';
import { db } from '../db/drizzle.config';
import { users } from '../db/schemas/UsersSchema';
import { eq } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';

class UsersController {
  /**
   * Get current user info (from SuperTokens session)
   */
  static async getCurrentUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    console.log('\n👤 [GET /api/users/me] Request received');
    console.log('================================================');
    
    try {
      console.log('🔍 [GET /api/users/me] Checking if user is attached to request...');
      
      if (!req.user) {
        console.log('❌ [GET /api/users/me] No user in request - middleware failed');
        console.log('   This means authenticateAndAttachUser middleware did not set req.user');
        console.log('   → Returning 401 Unauthorized');
        return ResponseUtils.error(res, 'User not authenticated', null, null, 401);
      }

      console.log('✅ [GET /api/users/me] User found in request:', {
        userId: req.user.userId,
        email: req.user.email,
        projectCount: req.user.projectIds?.length || 0,
        role: req.user.role,
      });

      const userData = {
        id: req.user.userId,
        email: req.user.email,
        projectIds: req.user.projectIds,
        role: req.user.role,
      };

      console.log('📦 [GET /api/users/me] Sending user data to frontend');
      console.log('================================================\n');
      
      ResponseUtils.success(res, 'User info retrieved successfully', { user: userData });
    } catch (error) {
      console.error('❌ [GET /api/users/me] Error:', error);
      console.log('   → Returning error response');
      console.log('================================================\n');
      ResponseUtils.error(res, 'Failed to get user info', error);
    }
  }
  /**
   * Get all users
   */
  static async getAll(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const results = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          full_name: users.full_name,
          created_at: users.created_at,
        })
        .from(users)
        .orderBy(users.created_at);

      ResponseUtils.success(res, 'Users fetched successfully', results);
    } catch (error) {
      console.error('Get users error:', error);
      ResponseUtils.error(res, 'Failed to fetch users', error);
    }
  }

  /**
   * Create a new user
   */
  static async create(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { username, email, full_name } = req.body;

      // Validation
      if (!username || !email) {
        return ResponseUtils.error(res, 'Username and email are required', null, null, 400);
      }

      const result = await db
        .insert(users)
        .values({
          username,
          email,
          full_name: full_name || null,
        })
        .returning();

      ResponseUtils.success(res, 'User created successfully', result[0], 201);
    } catch (error: any) {
      console.error('Create user error:', error);

      // Handle unique constraint violations
      if (error.code === '23505') {
        return ResponseUtils.error(res, 'Username or email already exists', null, null, 409);
      }

      ResponseUtils.error(res, 'Failed to create user', error);
    }
  }
}

export default UsersController;

