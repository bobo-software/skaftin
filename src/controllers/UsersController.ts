import { Request, Response } from 'express';
import { db } from '../db/drizzle.config';
import { users } from '../db/schemas/UsersSchema';
import { eq } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';

class UsersController {
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

