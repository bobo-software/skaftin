import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Middleware } from '../registry/types';
import { authenticateAndVerifyProject, authenticateAndAttachUser } from '../../middleware/supertokensAuthMiddleware';
import { hybridAuthAndVerifyProject, verifyProjectAccess as verifyHybridProjectAccess } from '../../middleware/hybridAuthMiddleware';
import { extractProjectFromCredentials } from '../../middleware/appUserAuthMiddleware';
import { verifyProjectAccess } from '../../middleware/authMiddleware';

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
      return [...hybridAuthAndVerifyProject];
    }
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

