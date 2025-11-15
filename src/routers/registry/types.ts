import { Request, Response, NextFunction, Router } from 'express';
import { Pool } from 'pg';

/**
 * HTTP method types
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * Express middleware type
 * Note: Express middleware may return Response objects (e.g., from res.json() chaining),
 * but they should effectively be void. Express discards return values from middleware.
 */
export type Middleware = (req: Request, res: Response, next: NextFunction) => 
  void | 
  Promise<void> | 
  Response | 
  Promise<Response | undefined> | 
  Promise<void | Response>;

/**
 * Express route handler type
 * Note: Express handlers may return Response objects (e.g., from res.json() chaining),
 * but they should effectively be void. The wrapper in routeHelper ensures this.
 */
export type RouteHandler = (req: Request, res: Response, next?: NextFunction) => void | Promise<void> | Response | Promise<Response | undefined>;

/**
 * Route path can be a string or regex pattern
 */
export type RoutePath = string | RegExp;

/**
 * Single route definition
 */
export interface RouteDefinition {
  /**
   * HTTP method
   */
  method: HttpMethod;

  /**
   * Route path (can be string or regex)
   */
  path: RoutePath;

  /**
   * Route handler (controller method)
   */
  handler: RouteHandler;

  /**
   * Middleware chain (applied in order)
   */
  middleware?: Middleware[];

  /**
   * Route description (for documentation)
   */
  description?: string;

  /**
   * Whether this route requires project context
   */
  requiresProject?: boolean;

  /**
   * Whether this route requires authentication
   */
  requiresAuth?: boolean;
}

/**
 * Route group configuration
 */
export interface RouteGroup {
  /**
   * Group base path (prefix for all routes in group)
   */
  basePath: string;

  /**
   * Routes in this group
   */
  routes: RouteDefinition[];

  /**
   * Middleware applied to all routes in group
   */
  groupMiddleware?: Middleware[];

  /**
   * Group description
   */
  description?: string;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /**
   * Database pool (for controllers that need it)
   */
  pool: Pool;

  /**
   * S3 client (for storage-related routers)
   */
  s3Client?: any;

  /**
   * Whether this is an admin router (uses SuperTokens auth)
   */
  isAdmin?: boolean;

  /**
   * Base path for the router
   */
  basePath?: string;
}

/**
 * Route builder context
 */
export interface RouteBuilderContext {
  /**
   * Router instance
   */
  router: Router;

  /**
   * Router configuration
   */
  config: RouterConfig;

  /**
   * Default middleware for routes
   */
  defaultMiddleware?: Middleware[];
}

/**
 * Route metadata for documentation and introspection
 */
export interface RouteMetadata {
  /**
   * Full route path
   */
  path: string;

  /**
   * HTTP method
   */
  method: HttpMethod;

  /**
   * Route description
   */
  description?: string;

  /**
   * Required permissions/authentication
   */
  requirements?: string[];

  /**
   * Example request/response
   */
  examples?: {
    request?: any;
    response?: any;
  };
}

