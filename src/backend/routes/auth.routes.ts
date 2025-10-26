import { Router, Response, Request } from 'express';
import Session from 'supertokens-node/recipe/session';

const router = Router();

// Note: SuperTokens middleware in Server.ts already handles auth routes
// These are optional custom endpoints for additional functionality

// Protected route example - get user info  
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    if (session) {
      const userId = session.getUserId();
      res.json({
        success: true,
        userId,
        message: 'Profile retrieved successfully'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
