import { Request, Response, NextFunction } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import ResponseUtils from '../utils/ResponseUtils';
import { db } from '../db/drizzle.config';
import { projects } from '../db/schemas/ProjectsSchema';
import { eq } from 'drizzle-orm';

export interface SuperTokensAuthenticatedRequest extends SessionRequest {
  user?: {
    userId: string;
    email?: string;
    projectIds?: number[];
    role?: string;
  };
}

/**
 * Middleware to verify SuperTokens session and attach user info to request
 */
export const authenticateSession = verifySession({
  sessionRequired: true,
  antiCsrfCheck: false, // Disable CSRF for development (re-enable in production)
});

/**
 * Middleware to extract user info from SuperTokens session and attach to req.user
 */
export const attachUserInfo = async (req: SuperTokensAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.session) {
      return ResponseUtils.error(res, 'Session not found', null, null, 401);
    }

    const userId = req.session.getUserId();
    const sessionData = req.session.getAccessTokenPayload();

    // Fetch user's projects from database (user_id is now VARCHAR for SuperTokens)
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.user_id, userId));
    
    const projectIds = userProjects.map(p => p.id);

    // Attach user info to request
    req.user = {
      userId,
      email: sessionData.email,
      projectIds,
      role: sessionData.role || 'user',
    };

    next();
  } catch (error) {
    console.error('Error attaching user info:', error);
    return ResponseUtils.error(res, 'Failed to fetch user information', error);
  }
};

/**
 * Middleware to verify user has access to a specific project
 */
export const verifyProjectAccess = async (req: SuperTokensAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return ResponseUtils.error(res, 'User information not found. Ensure attachUserInfo middleware is used.', null, null, 401);
    }

    // Try to get projectId from params (could be :id or :projectId) or body
    const projectId = req.params?.projectId || req.params?.id || req.body?.projectId;
    
    if (!projectId) {
      console.error('Project ID not found in params or body:', { params: req.params, body: req.body });
      return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
    }

    const projectIdInt = parseInt(projectId, 10);

    if (isNaN(projectIdInt)) {
      return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
    }

    // Admin users have access to all projects
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has access to this project
    if (!req.user.projectIds || !req.user.projectIds.includes(projectIdInt)) {
      console.log(`Access denied: User ${req.user.userId} tried to access project ${projectIdInt}. User's projects: ${req.user.projectIds}`);
      return ResponseUtils.error(res, 'Access denied: You do not have permission to access this project', null, null, 403);
    }

    next();
  } catch (error) {
    console.error('Project access verification error:', error);
    return ResponseUtils.error(res, 'Failed to verify project access', error);
  }
};

/**
 * Middleware to verify user has admin role
 */
export const requireAdmin = (req: SuperTokensAuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return ResponseUtils.error(res, 'User information not found', null, null, 401);
  }

  if (req.user.role !== 'admin') {
    return ResponseUtils.error(res, 'Admin access required', null, null, 403);
  }

  next();
};

/**
 * Combined middleware: Authenticate + Attach User Info
 */
export const authenticateAndAttachUser = [authenticateSession, attachUserInfo];

/**
 * Combined middleware: Authenticate + Attach User Info + Verify Project Access
 */
export const authenticateAndVerifyProject = [authenticateSession, attachUserInfo, verifyProjectAccess];

