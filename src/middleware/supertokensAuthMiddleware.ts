import { Request, Response, NextFunction } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import ResponseUtils from '../utils/ResponseUtils';
import { db } from '../db/drizzle.config';
import { projects } from '../db/schemas/ProjectsSchema';
import { organization_members } from '../db/schemas/OrganizationsSchema';
import { eq, sql, inArray } from 'drizzle-orm';
import { migrateStaleUserRecords } from '../config/supertokens';

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
 * 
 * CSRF Protection:
 * - Enabled for production (cookie-based auth requires CSRF protection)
 * - Disabled in development for easier testing
 * - For header-based auth (app users), CSRF is not needed
 */
const isProduction = process.env.NODE_ENV === 'production';

export const authenticateSession = verifySession({
  sessionRequired: true,
  antiCsrfCheck: isProduction, // Enable CSRF protection in production
});

/**
 * Helper to fetch user data (projects, org memberships, role) from the database
 */
async function fetchUserData(userId: string) {
  // 1. Projects owned by user
  const ownedProjectsQuery = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.user_id, userId));
  
  // 2. Projects user is a direct member of (via project_members table)
  const memberProjectsQuery = await db.execute(sql`
    SELECT DISTINCT project_id as id 
    FROM skaftin_system_project_members 
    WHERE user_id = ${userId}
  `);
  
  // 3. Projects from organizations user belongs to
  const userOrganizations = await db
    .select({ 
      organization_id: organization_members.organization_id,
      role: organization_members.role
    })
    .from(organization_members)
    .where(eq(organization_members.user_id, userId));
  
  let orgProjectIds: number[] = [];
  let isOrgOwnerOrAdmin = false;
  if (userOrganizations.length > 0) {
    const orgIds = userOrganizations.map(org => org.organization_id);
    const orgProjectsQuery = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.organization_id, orgIds));
    orgProjectIds = orgProjectsQuery.map(p => p.id);
    
    // Check if user is owner or admin of any organization
    isOrgOwnerOrAdmin = userOrganizations.some(org => 
      org.role === 'owner' || org.role === 'admin'
    );
  }
  
  const ownedProjectIds = ownedProjectsQuery.map(p => p.id);
  const memberProjectIds = (memberProjectsQuery.rows as any[]).map(p => p.id);
  
  // Combine all lists and remove duplicates
  const projectIds = [...new Set([...ownedProjectIds, ...memberProjectIds, ...orgProjectIds])];

  return { projectIds, isOrgOwnerOrAdmin };
}

/**
 * Middleware to extract user info from SuperTokens session and attach to req.user
 * 
 * If no data is found for the current SuperTokens user ID, this middleware will
 * check if records exist under a different SuperTokens user ID for the same email
 * (e.g., from OAuth vs email/password, or after a SuperTokens Core reset) and
 * migrate them to the current user ID.
 */
export const attachUserInfo = async (req: SuperTokensAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.session) {
      return ResponseUtils.error(res, 'Session not found', null, null, 401);
    }

    const userId = req.session.getUserId();
    const sessionData = req.session.getAccessTokenPayload();

    // Fetch user's data from database
    let { projectIds, isOrgOwnerOrAdmin } = await fetchUserData(userId);

    // If no data found, check for stale user ID and migrate records if needed.
    // This handles the case where a restored session has a different SuperTokens user ID
    // than the one currently associated with the user's data (e.g., OAuth vs email/password
    // login, or SuperTokens Core reset).
    if (projectIds.length === 0 && !isOrgOwnerOrAdmin) {
      const migrated = await migrateStaleUserRecords(userId);
      if (migrated) {
        // Re-fetch data after migration
        const freshData = await fetchUserData(userId);
        projectIds = freshData.projectIds;
        isOrgOwnerOrAdmin = freshData.isOrgOwnerOrAdmin;
      }
    }

    // Determine user role: admin if SuperTokens says so, or if they're an org owner/admin
    let userRole = sessionData.role || 'user';
    if (isOrgOwnerOrAdmin && userRole !== 'admin') {
      // Organization owners/admins get admin-level access
      userRole = 'admin';
    }

    // Attach user info to request
    req.user = {
      userId,
      email: sessionData.email,
      projectIds,
      role: userRole,
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

