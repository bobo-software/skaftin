import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Middleware } from '../registry/types';
import { authenticateAndVerifyProject, authenticateAndAttachUser } from '../../middleware/supertokensAuthMiddleware';
import { hybridAuthAndVerifyProject, hybridAuthWithOptionalProject, verifyProjectAccess as verifyHybridProjectAccess } from '../../middleware/hybridAuthMiddleware';
import { extractProjectFromCredentials } from '../../middleware/appUserAuthMiddleware';
import { verifyProjectAccess } from '../../middleware/authMiddleware';
// AppUserSuperTokensRequest type imported for typing only (extractAppUserFromBearerToken handles extraction directly)
import { organisationFilterMiddleware } from '../../middleware/organisationFilterMiddleware';
import { apiKeyOnlyAuthAndVerifyProject } from '../../middleware/apiKeyOnlyMiddleware';
import Session from "supertokens-node/recipe/session";

/**
 * Middleware builder for creating standardized middleware chains
 */
export class MiddlewareBuilder {
  private pool: Pool;
  private isAdmin: boolean;

  constructor(pool: Pool, isAdmin: boolean = false) {
    this.pool = pool;
    this.isAdmin = isAdmin;
  }

  /**
   * Build authentication middleware based on router type
   */
  buildAuthMiddleware(): Middleware[] {
    if (this.isAdmin) {
      // Admin routes use SuperTokens authentication
      return [...authenticateAndVerifyProject] as Middleware[];
    } else {
      // Client routes use hybrid authentication (API key or SuperTokens)
      // hybridAuthAndVerifyProject is already an array, so spread it
      return [...hybridAuthAndVerifyProject] as Middleware[];
    }
  }

  /**
   * Build project extraction middleware
   * For admin routes, project comes from URL params
   * For client routes, project comes from API key or URL params
   */
  buildProjectExtractor(): Middleware {
    if (this.isAdmin) {
      // Admin routes: project ID in URL, already handled by authenticateAndVerifyProject
      return (req: Request, res: Response, next: NextFunction) => next();
    } else {
      // Client routes: extract project from API key
      const extractor = extractProjectFromCredentials(this.pool);
      return extractor;
    }
  }

  /**
   * Build optional authentication middleware
   * Tries API key first, falls back to SuperTokens
   */
  buildOptionalAuth(): Middleware {
    const projectExtractor = this.buildProjectExtractor();
    
    return async (req: Request, res: Response, next: NextFunction) => {
      // If projectId is already set (from API key), skip SuperTokens auth
      if ((req as any).projectId) {
        return next();
      }
      
      // Otherwise, try SuperTokens auth (for platform admin)
      const authMiddleware = authenticateAndAttachUser;
      for (const middleware of authMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      return next();
    };
  }

  /**
   * Build complete middleware chain for authenticated routes
   */
  buildAuthChain(): Middleware[] {
    if (this.isAdmin) {
      return this.buildAuthMiddleware();
    } else {
      // For client routes, use hybrid auth which handles both API keys and SuperTokens
      // Also extract app user info from Bearer token if present, and apply organization filter
      return [
        ...hybridAuthAndVerifyProject,
        this.extractAppUserFromBearerToken(),
        organisationFilterMiddleware,
      ];
    }
  }

  /**
   * Build middleware chain for routes that don't require project ID
   */
  buildOptionalProjectAuthChain(): Middleware[] {
    if (this.isAdmin) {
      return this.buildAuthMiddleware();
    } else {
      // For client routes without project requirement, use optional project access
      return [
        ...hybridAuthWithOptionalProject,
        this.extractAppUserFromBearerToken(),
        organisationFilterMiddleware,
      ];
    }
  }

  /**
   * Extract app user info from Bearer token even when API key is used
   * This allows organization filtering to work when client sends both API key and Bearer token
   * 
   * NOTE: This is an OPTIONAL extraction - if the app user is not found, we continue
   * without it. The API key auth is still valid. This is different from attachAppUserInfo
   * which is a REQUIRED middleware that fails the request if user is not found.
   */
  private extractAppUserFromBearerToken(): Middleware {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only try to extract app user if Bearer token is present
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      const hasBearerToken = bearerToken && !bearerToken.startsWith('mcp_');
      
      console.log('🔍 [ExtractAppUser] Checking Bearer token...');
      console.log('  └─ Has Bearer token:', hasBearerToken);
      console.log('  └─ Already has appUser:', !!(req as any).appUser);
      
      if (!hasBearerToken) {
        return next();
      }

      try {
        // Try to get SuperTokens session (non-blocking, won't fail if no session)
        const session = await Session.getSession(req, res, {
          sessionRequired: false,
          antiCsrfCheck: false,
        });

        if (!session) {
          console.log('  └─ ❌ No SuperTokens session found');
          return next();
        }

        console.log('  └─ ✅ SuperTokens session found, extracting app user info...');

        // Get session data
        const supertokensUserId = session.getUserId();
        const sessionData = session.getAccessTokenPayload();
        
        // Get projectId from request (set by API key auth) or session
        const projectId = (req as any).projectId || sessionData.projectId;
        
        if (!projectId) {
          console.log('  └─ ⚠️  No project context available');
          return next();
        }

        // Get project schema
        const schemaResult = await this.pool.query(
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
          [projectId]
        );

        if (schemaResult.rows.length === 0) {
          console.log('  └─ ⚠️  Project not found:', projectId);
          return next();
        }

        const schemaName = schemaResult.rows[0].schema_name;
        const roleUserIdColumnResult = await this.pool.query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = $1
             AND table_name = 'skaftin_system_user_roles'
             AND column_name IN ('app_user_id', 'user_id')`,
          [schemaName]
        );
        const roleUserIdColumns = new Set<string>(
          roleUserIdColumnResult.rows.map((row: any) => row.column_name)
        );
        const roleUserIdColumn = roleUserIdColumns.has('app_user_id')
          ? 'app_user_id'
          : roleUserIdColumns.has('user_id')
            ? 'user_id'
            : null;
        if (!roleUserIdColumn) {
          console.log('  └─ ⚠️  user role link column not found in schema', schemaName);
          return next();
        }

        // Find app user by SuperTokens user ID (non-blocking - just log if not found)
        const userResult = await this.pool.query(
          `SELECT u.id, u.email, u.name, u.is_active,
           COALESCE(
             json_agg(
               json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
             ) FILTER (WHERE r.id IS NOT NULL), 
             '[]'
           ) as roles
           FROM ${schemaName}.skaftin_system_users u
           LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.${roleUserIdColumn}
           LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
           WHERE u.supertokens_user_id = $1
           GROUP BY u.id`,
          [supertokensUserId]
        );

        if (userResult.rows.length === 0) {
          // This is expected for platform users or when session is from a different project
          console.log('  └─ ⚠️  App user not found in project', projectId, '(continuing without app user)');
          return next();
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
          console.log('  └─ ⚠️  App user account is inactive');
          return next();
        }

        // Extract organization context from session payload
        const organisation_name = sessionData.organisation_name || null;
        const organisation_id = sessionData.organisation_id || null;
        const is_admin = sessionData.is_admin || false;

        // Attach app user info to request
        (req as any).appUser = {
          userId: user.id,
          supertokensUserId: supertokensUserId,
          email: user.email,
          projectId: projectId,
          roles: user.roles || [],
          organisation_name,
          organisation_id,
          is_admin,
        };

        (req as any).schemaName = schemaName;

        console.log('  └─ ✅ App user extracted:', (req as any).appUser?.email);
        console.log('  └─   Organisation:', organisation_name, '=', organisation_id);

        return next();
      } catch (error: any) {
        // If extraction fails, continue without app user (API key auth still works)
        console.log('  └─ ⚠️  Could not extract app user from Bearer token:', error.message || error);
        return next();
      }
    };
  }

  /**
   * Build middleware chain for routes that only need project extraction
   */
  buildProjectOnlyChain(): Middleware[] {
    const projectExtractor = this.buildProjectExtractor();
    return [projectExtractor];
  }

  /**
   * Build middleware chain for unauthenticated routes (like registration)
   */
  buildPublicChain(): Middleware[] {
    if (this.isAdmin) {
      // Admin routes typically require auth
      return this.buildAuthMiddleware();
    } else {
      // Client routes: only extract project from API key if available
      return this.buildProjectOnlyChain();
    }
  }

  /**
   * Build middleware chain for API key only authentication (no SuperTokens fallback)
   * Used for public endpoints that require API key/access token but not user authentication
   * 
   * NOTE: This chain does NOT include organization filtering - app-api-2 routes
   * have full project access without organization restrictions
   */
  buildApiKeyOnlyChain(): Middleware[] {
    // API key only auth with project verification
    // No app user extraction or organization filtering since no user auth
    // This allows app-api-2 routes to access all data in the project without org filtering
    return [...apiKeyOnlyAuthAndVerifyProject] as Middleware[];
  }

  /**
   * Combine middleware arrays, removing duplicates
   */
  static combine(...middlewareArrays: (Middleware | Middleware[])[]): Middleware[] {
    const combined: Middleware[] = [];
    const seen = new Set<Middleware>();

    for (const item of middlewareArrays) {
      const middlewares = Array.isArray(item) ? item : [item];
      for (const middleware of middlewares) {
        if (!seen.has(middleware)) {
          seen.add(middleware);
          combined.push(middleware);
        }
      }
    }

    return combined;
  }
}

/**
 * Create middleware builder instance
 */
export function createMiddlewareBuilder(pool: Pool, isAdmin: boolean = false): MiddlewareBuilder {
  return new MiddlewareBuilder(pool, isAdmin);
}

