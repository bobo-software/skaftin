import express, { Request, Response, Router } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { deleteUser, listUsersByAccountInfo } from "supertokens-node";
import ResponseUtils from '../utils/ResponseUtils';
import { AuthUtils } from '../utils/AuthUtils';
import { Pool } from 'pg';

export function createAdminRouter(pool: Pool): Router {
  const router = express.Router();

/**
 * Admin routes for managing SuperTokens users
 * These should be protected in production!
 */

/**
 * GET /api/admin/users/search
 * Search for users by email
 */
router.get('/users/search', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return ResponseUtils.error(res, 'Email query parameter is required', null, null, 400);
    }

    // Search for users by email
    const users = await listUsersByAccountInfo("public", {
      email,
    });

    return ResponseUtils.success(res, 'Users found', users);
  } catch (error) {
    console.error('Error searching users:', error);
    return ResponseUtils.error(res, 'Failed to search users', error);
  }
});

/**
 * GET /api/admin/users/check-email
 * Check if an email exists in SuperTokens
 */
router.get('/users/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return ResponseUtils.error(res, 'Email query parameter is required', null, null, 400);
    }

    // Try to sign up with the email (will fail if exists)
    try {
      const tempResponse = await EmailPassword.signUp("public", email, "temp-password-12345");
      
      if (tempResponse.status === "OK") {
        // User didn't exist, but now we created one accidentally!
        // Delete immediately
        await deleteUser(tempResponse.user.id);
        return ResponseUtils.success(res, 'Email does not exist', { exists: false });
      }
    } catch (err) {
      // Error means user might exist or other issue
    }

    // Try to find users by email
    const users = await listUsersByAccountInfo("public", {
      email,
    });

    const exists = users.length > 0;
    const userInfo = exists ? {
      id: users[0].id,
      email: users[0].emails[0],
      timeJoined: new Date(users[0].timeJoined).toISOString(),
    } : null;

    return ResponseUtils.success(res, exists ? 'Email exists' : 'Email does not exist', {
      exists,
      user: userInfo,
    });
  } catch (error) {
    console.error('Error checking email:', error);
    return ResponseUtils.error(res, 'Failed to check email', error);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a SuperTokens user by user ID
 */
router.delete('/users/:userId', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ResponseUtils.error(res, 'User ID is required', null, null, 400);
    }

    // Delete the user from SuperTokens
    await deleteUser(userId);

    return ResponseUtils.success(res, 'User deleted successfully from SuperTokens');
  } catch (error) {
    console.error('Error deleting user:', error);
    return ResponseUtils.error(res, 'Failed to delete user', error);
  }
});

/**
 * POST /api/admin/users/delete-by-email
 * Delete a SuperTokens user by email (dangerous!)
 */
router.post('/users/delete-by-email', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    const { email, confirm } = req.body;

    if (!email) {
      return ResponseUtils.error(res, 'Email is required', null, null, 400);
    }

    if (confirm !== true) {
      return ResponseUtils.error(res, 'Confirmation required (confirm: true)', null, null, 400);
    }

    // Find users by email
    const users = await listUsersByAccountInfo("public", {
      email,
    });

    if (users.length === 0) {
      return ResponseUtils.error(res, 'User not found', null, null, 404);
    }

    // Delete all users with this email
    const deletedUsers: string[] = [];
    for (const user of users) {
      await deleteUser(user.id);
      deletedUsers.push(user.id);
    }

    return ResponseUtils.success(res, `Deleted ${deletedUsers.length} user(s)`, {
      deletedUserIds: deletedUsers,
    });
  } catch (error) {
    console.error('Error deleting user by email:', error);
    return ResponseUtils.error(res, 'Failed to delete user', error);
  }
});

/**
 * POST /api/admin/users/complete-cleanup
 * Completely remove a user from SuperTokens and all project databases
 * This is the ultimate cleanup tool for fixing orphaned users
 */
router.post('/users/complete-cleanup', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    const { email, projectId, confirm } = req.body;

    if (!email) {
      return ResponseUtils.error(res, 'Email is required', null, null, 400);
    }

    if (confirm !== true) {
      return ResponseUtils.error(res, 'Confirmation required (confirm: true)', null, null, 400);
    }

    console.log(`🧹 Starting complete cleanup for: ${email}`);

    // Perform complete cleanup
    const result = await AuthUtils.completeUserCleanup(
      pool,
      email,
      projectId ? parseInt(projectId) : undefined
    );

    if (result.success) {
      console.log(`✅ Complete cleanup successful for: ${email}`);
      console.log(`   - Deleted from SuperTokens: ${result.deletedFromSuperTokens}`);
      console.log(`   - Deleted from app_users: ${result.deletedFromAppUsers}`);
      console.log(`   - Deleted role assignments: ${result.deletedRoleAssignments}`);
    } else {
      console.error(`❌ Cleanup completed with errors for: ${email}`);
      console.error(`   Errors: ${result.errors.join(', ')}`);
    }

    return ResponseUtils.success(res, 
      result.success ? 'User completely removed' : 'Cleanup completed with some errors',
      {
        email,
        deletedFromSuperTokens: result.deletedFromSuperTokens,
        deletedFromAppUsers: result.deletedFromAppUsers,
        deletedRoleAssignments: result.deletedRoleAssignments,
        errors: result.errors,
      }
    );
  } catch (error) {
    console.error('Error during complete cleanup:', error);
    return ResponseUtils.error(res, 'Failed to complete cleanup', error);
  }
});

  return router;
}

