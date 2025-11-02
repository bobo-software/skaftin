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
    console.log('📝 [AUTH] Register request received:', {
      email: req.body.email,
      hasPassword: !!req.body.password,
      origin: req.headers.origin,
      cookies: req.headers.cookie ? 'Present' : 'None',
    });

    const { email, password, full_name } = req.body;

    if (!email || !password) {
      console.log('❌ [AUTH] Registration failed: Missing credentials');
      return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
    }

    if (password.length < 6) {
      console.log('❌ [AUTH] Registration failed: Password too short');
      return ResponseUtils.error(res, 'Password must be at least 6 characters', null, null, 400);
    }

    // Use SuperTokens to sign up
    console.log('🔐 [AUTH] Calling SuperTokens signUp...');
    const signUpResponse = await EmailPassword.signUp("public", email, password);
    console.log('🔐 [AUTH] SuperTokens signUp response:', signUpResponse.status);

    if (signUpResponse.status === "OK") {
      // Create a session for the user
      console.log('🍪 [AUTH] Creating session for user:', signUpResponse.user.id);
      const recipeUserId = convertToRecipeUserId(signUpResponse.user.id);
      await Session.createNewSession(req, res, "public", recipeUserId, {
        email: signUpResponse.user.emails[0],
        name: full_name || email.split('@')[0],
      }, {});

      console.log('✅ [AUTH] Session created successfully');
      console.log('🍪 [AUTH] Response headers Set-Cookie:', res.getHeader('Set-Cookie'));

      // Return response in old format for frontend compatibility
      return ResponseUtils.success(res, 'User registered successfully', {
        user: {
          id: signUpResponse.user.id,
          email: signUpResponse.user.emails[0],
          name: full_name || email.split('@')[0],
        },
        token: 'session-managed-by-supertokens',
        accessToken: 'session-managed-by-supertokens',
        refreshToken: 'session-managed-by-supertokens',
      }, 201);
    } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
      console.log('❌ [AUTH] Registration failed: Email already exists');
      return ResponseUtils.error(res, 'Email already registered', null, null, 409);
    } else {
      console.log('❌ [AUTH] Registration failed: Unknown error');
      return ResponseUtils.error(res, 'Failed to register user', null, null, 500);
    }
  } catch (error) {
    console.error('❌ [AUTH] Register compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to register user', error);
  }
});

/**
 * POST /api/auth/login
 * Compatibility endpoint for old login flow
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('🔑 [AUTH] Login request received:', {
      email: req.body.email,
      hasPassword: !!req.body.password,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      cookies: req.headers.cookie ? 'Present' : 'None',
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ [AUTH] Login failed: Missing credentials');
      return ResponseUtils.error(res, 'Email and password are required', null, null, 400);
    }

    // Use SuperTokens to sign in
    console.log('🔐 [AUTH] Calling SuperTokens signIn...');
    const signInResponse = await EmailPassword.signIn("public", email, password);
    console.log('🔐 [AUTH] SuperTokens signIn response:', signInResponse.status);

    if (signInResponse.status === "OK") {
      // Create a session for the user
      console.log('🍪 [AUTH] Creating session for user:', signInResponse.user.id);
      const recipeUserId = convertToRecipeUserId(signInResponse.user.id);
      await Session.createNewSession(req, res, "public", recipeUserId, {
        email: signInResponse.user.emails[0],
        name: email.split('@')[0],
      }, {});
      
      console.log('✅ [AUTH] Session created successfully');
      console.log('🍪 [AUTH] Response headers Set-Cookie:', res.getHeader('Set-Cookie'));
      
      // Return response in old format for frontend compatibility
      return ResponseUtils.success(res, 'Login successful', {
        user: {
          id: signInResponse.user.id,
          email: signInResponse.user.emails[0],
          name: email.split('@')[0],
        },
        token: 'session-managed-by-supertokens',
        accessToken: 'session-managed-by-supertokens',
        refreshToken: 'session-managed-by-supertokens',
      });
    } else if (signInResponse.status === "WRONG_CREDENTIALS_ERROR") {
      console.log('❌ [AUTH] Login failed: Wrong credentials');
      return ResponseUtils.error(res, 'Invalid email or password', null, null, 401);
    } else {
      console.log('❌ [AUTH] Login failed: Unknown error');
      return ResponseUtils.error(res, 'Failed to login', null, null, 500);
    }
  } catch (error) {
    console.error('❌ [AUTH] Login compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to login', error);
  }
});

/**
 * POST /api/auth/verify
 * Compatibility endpoint for token verification
 */
router.post('/verify', verifySession(), async (req: SessionRequest, res: Response) => {
  try {
    console.log('🔍 [AUTH] Verify request received:', {
      origin: req.headers.origin,
      cookies: req.headers.cookie ? 'Present' : 'None',
      hasCookie: req.headers.cookie?.includes('sAccessToken') ? 'Yes' : 'No',
    });

    if (!req.session) {
      console.log('❌ [AUTH] Verify failed: Session not found');
      return ResponseUtils.error(res, 'Session not found', null, null, 401);
    }

    const userId = req.session.getUserId();
    const sessionData = req.session.getAccessTokenPayload();

    console.log('✅ [AUTH] Session verified for user:', userId);
    console.log('📦 [AUTH] Session data:', {
      email: sessionData.email,
      name: sessionData.name,
      projectIds: sessionData.projectIds,
      role: sessionData.role,
    });

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
    console.error('❌ [AUTH] Verify compatibility error:', error);
    return ResponseUtils.error(res, 'Invalid or expired token', error, null, 403);
  }
});

/**
 * POST /api/auth/refresh
 * Compatibility endpoint - SuperTokens handles refresh automatically
 */
router.post('/refresh', async (req: Request, res: Response) => {
  console.log('🔄 [AUTH] Refresh request received:', {
    origin: req.headers.origin,
    cookies: req.headers.cookie ? 'Present' : 'None',
    hasRefreshToken: req.headers.cookie?.includes('sRefreshToken') ? 'Yes' : 'No',
  });
  
  // SuperTokens handles session refresh automatically via middleware
  // This endpoint is just for compatibility
  console.log('ℹ️ [AUTH] SuperTokens handles refresh automatically');
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
    console.log('👋 [AUTH] Logout request received:', {
      origin: req.headers.origin,
      cookies: req.headers.cookie ? 'Present' : 'None',
    });

    if (!req.session) {
      console.log('❌ [AUTH] Logout failed: No active session');
      return ResponseUtils.error(res, 'No active session', null, null, 401);
    }

    // Revoke the session
    await req.session.revokeSession();
    console.log('✅ [AUTH] Session revoked successfully');

    return ResponseUtils.success(res, 'Logged out successfully');
  } catch (error) {
    console.error('❌ [AUTH] Logout compatibility error:', error);
    return ResponseUtils.error(res, 'Failed to logout', error);
  }
});

export { router };

