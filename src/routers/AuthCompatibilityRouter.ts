import express, { Request, Response } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import { convertToRecipeUserId } from "supertokens-node";
import ResponseUtils from '../utils/ResponseUtils';

const router = express.Router();

/**
 * Compatibility layer for old JWT-based auth routes
 * Maps old routes to SuperTokens functionality
 */

/**
 * POST /api/auth/register
 * Compatibility endpoint for old registration flow
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
    }

    if (password.length < 6) {
      return ResponseUtils.error(res, 'Password must be at least 6 characters', null, null, 400);
    }

    // Use SuperTokens to sign up
    const signUpResponse = await EmailPassword.signUp("public", email, password);

    if (signUpResponse.status === "OK") {
      // Create a session for the user
      const recipeUserId = convertToRecipeUserId(signUpResponse.user.id);
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        email: signUpResponse.user.emails[0],
        name: full_name || email.split('@')[0],
      }, {});

      console.log('✅ [Auth] Session created for user:', signUpResponse.user.id);
      console.log('✅ [Auth] Session handle:', session.getHandle());
      console.log('✅ [Auth] Response headers set:', res.getHeaders()['set-cookie']);

      // Return response in old format for frontend compatibility
      return ResponseUtils.success(res, 'User registered successfully', {
        user: {
          id: signUpResponse.user.id,
          email: signUpResponse.user.emails[0],
          name: full_name || email.split('@')[0],
        },
        token: 'session-managed-by-supertokens', // Placeholder - sessions are in cookies now
        accessToken: 'session-managed-by-supertokens',
        refreshToken: 'session-managed-by-supertokens',
      }, 201);
    } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
      return ResponseUtils.error(res, 'Email already registered', null, null, 409);
    } else {
      return ResponseUtils.error(res, 'Failed to register user', null, null, 500);
    }
  } catch (error) {
    console.error('Register compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to register user', error);
  }
});

/**
 * POST /api/auth/login
 * Compatibility endpoint for old login flow
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
    }

    // Use SuperTokens to sign in
    const signInResponse = await EmailPassword.signIn("public", email, password);

    if (signInResponse.status === "OK") {
      // Create a session for the user
      const recipeUserId = convertToRecipeUserId(signInResponse.user.id);
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        email: signInResponse.user.emails[0],
        name: email.split('@')[0],
      }, {});

      console.log('✅ [Auth] Session created for user:', signInResponse.user.id);
      console.log('✅ [Auth] Session handle:', session.getHandle());
      console.log('✅ [Auth] Response headers set:', res.getHeaders()['set-cookie']);
      
      // Return response in old format for frontend compatibility
      return ResponseUtils.success(res, 'Login successful', {
        user: {
          id: signInResponse.user.id,
          email: signInResponse.user.emails[0],
          name: email.split('@')[0],
        },
        token: 'session-managed-by-supertokens', // Placeholder - sessions are in cookies now
        accessToken: 'session-managed-by-supertokens',
        refreshToken: 'session-managed-by-supertokens',
      });
    } else if (signInResponse.status === "WRONG_CREDENTIALS_ERROR") {
      return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
    } else {
      return ResponseUtils.error(res, 'Failed to login', null, null, 500);
    }
  } catch (error) {
    console.error('Login compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to login', error);
  }
});

/**
 * POST /api/auth/verify
 * Compatibility endpoint for token verification
 */
router.post('/verify', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    if (!req.session) {
      return ResponseUtils.error(res, 'Session not found', null, null, 401);
    }

    const userId = req.session.getUserId();
    const sessionData = req.session.getAccessTokenPayload();

    return ResponseUtils.success(res, 'Token is valid', {
      user: {
        id: userId,
        email: sessionData.email,
        name: sessionData.name || 'User',
        projectIds: sessionData.projectIds || [],
        role: sessionData.role || 'user',
      },
    });
  } catch (error) {
    console.error('Verify compatibility error:', error);
    return ResponseUtils.error(res, 'Invalid or expired token', error, null, 403);
  }
});

/**
 * POST /api/auth/refresh
 * Compatibility endpoint - SuperTokens handles refresh automatically
 */
router.post('/refresh', async (req: Request, res: Response) => {
  // SuperTokens handles session refresh automatically via middleware
  // This endpoint is just for compatibility
  return ResponseUtils.success(res, 'Session refresh is handled automatically by SuperTokens', {
    message: 'No action needed - sessions are automatically refreshed',
  });
});

/**
 * POST /api/auth/logout
 * Compatibility endpoint for logout
 */
router.post('/logout', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    if (!req.session) {
      return ResponseUtils.error(res, 'No active session', null, null, 401);
    }

    // Revoke the session
    await req.session.revokeSession();

    return ResponseUtils.success(res, 'Logged out successfully');
  } catch (error) {
    console.error('Logout compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to logout', error);
  }
});

export { router };

