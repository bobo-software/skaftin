import { Request, Response } from 'express';
import { db } from '../db/drizzle.config';
import { users } from '../db/schemas/UsersSchema';
import { eq } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { convertToRecipeUserId } from 'supertokens-node';

class UsersController {
  /**
   * Get current user info (from SuperTokens session)
   */
  static async getCurrentUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseUtils.error(res, 'User not authenticated', null, null, 401);
      }

      const userData = {
        id: req.user.userId,
        email: req.user.email,
        projectIds: req.user.projectIds,
        role: req.user.role,
      };

      ResponseUtils.success(res, 'User info retrieved successfully', { user: userData });
    } catch (error) {
      console.error('Get current user error:', error);
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
          last_name: users.last_name,
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
      const { username, email, full_name, last_name } = req.body;

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
          last_name: last_name || null,
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

  /**
   * Update current user profile (name, email)
   * PUT /api/users/me
   */
  static async updateProfile(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.user.userId) {
        return ResponseUtils.error(res, 'User not authenticated', null, null, 401);
      }

      const { name, email } = req.body;
      const userId = req.user.userId;

      if (!req.user.email) {
        return ResponseUtils.error(res, 'User email not found', null, null, 400);
      }

      // Get current user from database
      const currentUser = await db
        .select()
        .from(users)
        .where(eq(users.email, req.user.email))
        .limit(1);

      if (currentUser.length === 0) {
        return ResponseUtils.error(res, 'User not found in database', null, null, 404);
      }

      const dbUser = currentUser[0];
      const updates: any = {};

      // Update email in SuperTokens if it changed
      if (email && email !== req.user.email) {
        try {
          const recipeUserId = convertToRecipeUserId(userId);
          const updateResponse = await EmailPassword.updateEmailOrPassword({
            recipeUserId: recipeUserId,
            email: email,
          });

          if (updateResponse.status !== 'OK') {
            return ResponseUtils.error(res, 'Failed to update email in SuperTokens', null, null, 500);
          }

          updates.email = email;
        } catch (error: any) {
          console.error('Error updating email in SuperTokens:', error);
          return ResponseUtils.error(res, 'Failed to update email: ' + (error.message || 'Unknown error'), null, null, 500);
        }
      }

      // Update name in database if provided
      if (name !== undefined) {
        updates.full_name = name;
      }

      // Update database if there are changes
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date();
        await db
          .update(users)
          .set(updates)
          .where(eq(users.id, dbUser.id));
      }

      // Get updated user
      const updatedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, dbUser.id))
        .limit(1);

      ResponseUtils.success(res, 'Profile updated successfully', {
        user: {
          id: updatedUser[0].id.toString(),
          email: updatedUser[0].email,
          name: updatedUser[0].full_name,
        },
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      ResponseUtils.error(res, 'Failed to update profile', error);
    }
  }

  /**
   * Change current user password
   * PUT /api/users/me/password
   */
  static async changePassword(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.user.userId) {
        return ResponseUtils.error(res, 'User not authenticated', null, null, 401);
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return ResponseUtils.error(res, 'Current password and new password are required', null, null, 400);
      }

      if (newPassword.length < 8) {
        return ResponseUtils.error(res, 'New password must be at least 8 characters long', null, null, 400);
      }

      if (currentPassword === newPassword) {
        return ResponseUtils.error(res, 'New password must be different from current password', null, null, 400);
      }

      // Verify current password by attempting to sign in
      if (!req.user.email) {
        return ResponseUtils.error(res, 'User email not found', null, null, 400);
      }

      try {
        const signInResponse = await EmailPassword.signIn('public', req.user.email, currentPassword);
        if (signInResponse.status !== 'OK') {
          return ResponseUtils.error(res, 'Current password is incorrect', null, null, 401);
        }
      } catch (error: any) {
        return ResponseUtils.error(res, 'Current password is incorrect', null, null, 401);
      }

      // Update password in SuperTokens
      try {
        const recipeUserId = convertToRecipeUserId(req.user.userId);
        const updateResponse = await EmailPassword.updateEmailOrPassword({
          recipeUserId: recipeUserId,
          password: newPassword,
        });

        if (updateResponse.status !== 'OK') {
          return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
        }

        ResponseUtils.success(res, 'Password changed successfully', {
          message: 'Your password has been changed successfully.',
        });
      } catch (error: any) {
        console.error('Error updating password in SuperTokens:', error);
        return ResponseUtils.error(res, 'Failed to update password: ' + (error.message || 'Unknown error'), null, null, 500);
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      ResponseUtils.error(res, 'Failed to change password', error);
    }
  }
}

export default UsersController;

