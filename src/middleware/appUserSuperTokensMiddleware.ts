import { Request, Response, NextFunction } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import EmailPassword from "supertokens-node/recipe/emailpassword";

export interface AppUserSuperTokensRequest extends SessionRequest {
  appUser?: {
    userId: number; // app_users.id (not SuperTokens userId)
    supertokensUserId: string; // SuperTokens user ID
    email: string;
    projectId: number;
    roles: any[];
  };
  projectId?: number;
  schemaName?: string;
}

/**
 * Middleware to verify SuperTokens session for app users
 * Uses header-based tokens (not cookies) for app user authentication
 * Token transfer method is configured in supertokens.ts
 */
export const verifyAppUserSession = verifySession({
  sessionRequired: true,
  antiCsrfCheck: false, // CSRF handled via tokens
});

/**
 * Middleware to extract app user info from SuperTokens session
 * Links SuperTokens user to app_users table via supertokens_user_id
 */
export function attachAppUserInfo(pool: Pool) {
  return async (req: AppUserSuperTokensRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.session) {
        return ResponseUtils.error(res, 'Session not found', null, null, 401);
      }

      const supertokensUserId = req.session.getUserId();
      const sessionData = req.session.getAccessTokenPayload();

      // Get projectId from session payload or request
      const projectId = sessionData.projectId || req.projectId;
      
      if (!projectId) {
        return ResponseUtils.error(res, 'Project context not found', null, null, 400);
      }

      // Get project schema
      const schemaResult = await pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [projectId]
      );

      if (schemaResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = schemaResult.rows[0].schema_name;

      // Find app user by SuperTokens user ID
      const userResult = await pool.query(
        `SELECT u.id, u.email, u.name, u.is_active,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
         FROM ${schemaName}.app_users u
         LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
         LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
         WHERE u.supertokens_user_id = $1
         GROUP BY u.id`,
        [supertokensUserId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'App user not found', null, null, 404);
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive', null, null, 403);
      }

      // Attach app user info to request
      req.appUser = {
        userId: user.id,
        supertokensUserId: supertokensUserId,
        email: user.email,
        projectId: projectId,
        roles: user.roles || [],
      };

      req.projectId = projectId;
      req.schemaName = schemaName;

      console.log(`✅ App user authenticated via SuperTokens: ${req.appUser.email} (Project: ${projectId})`);
      next();
    } catch (error) {
      console.error('Error attaching app user info:', error);
      return ResponseUtils.error(res, 'Failed to fetch app user information', error);
    }
  };
}

/**
 * Combined middleware: Verify SuperTokens session + Attach app user info
 */
export function authenticateAppUser(pool: Pool) {
  return [verifyAppUserSession, attachAppUserInfo(pool)];
}

/**
 * Helper function to create SuperTokens user email with project prefix
 * This allows same email across different projects (multi-tenancy)
 */
export function createProjectScopedEmail(originalEmail: string, projectId: number): string {
  // Use project prefix to allow same email across projects
  // Format: project_1_user@example.com but we'll use a different approach
  // Actually, we'll use the original email but store project context separately
  // For SuperTokens, we need unique emails per project, so we'll prefix
  return `project_${projectId}_${originalEmail}`;
}

/**
 * Helper function to extract original email from project-scoped email
 */
export function extractOriginalEmail(scopedEmail: string, projectId: number): string {
  const prefix = `project_${projectId}_`;
  if (scopedEmail.startsWith(prefix)) {
    return scopedEmail.substring(prefix.length);
  }
  return scopedEmail;
}

