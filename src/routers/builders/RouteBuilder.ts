import { Router, Request, Response, NextFunction } from 'express';
import { HttpMethod, RouteDefinition, RoutePath, Middleware, RouteHandler, RouteGroup, RouteBuilderContext } from '../registry/types';
import { MiddlewareBuilder } from './MiddlewareBuilder';

/**
 * Fluent route builder for creating route definitions
 */
export class RouteBuilder {
  private method: HttpMethod;
  private path: RoutePath;
  private handler: RouteHandler;
  private middleware: Middleware[] = [];
  private description?: string;
  private requiresProject: boolean = false;
  private requiresAuth: boolean = true;

  /**
   * Set HTTP method
   */
  method(method: HttpMethod): this {
    this.method = method;
    return this;
  }

  /**
   * Set route path
   */
  path(path: RoutePath): this {
    this.path = path;
    return this;
  }

  /**
   * Set route handler
   */
  handler(handler: RouteHandler): this {
    this.handler = handler;
    return this;
  }

  /**
   * Add middleware
   */
  middleware(...middleware: Middleware[]): this {
    this.middleware.push(...middleware);
    return this;
  }

  /**
   * Set description
   */
  description(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Mark route as requiring project context
   */
  requiresProject(required: boolean = true): this {
    this.requiresProject = required;
    return this;
  }

  /**
   * Mark route as requiring authentication
   */
  requiresAuth(required: boolean = true): this {
    this.requiresAuth = required;
    return this;
  }

  /**
   * Build route definition
   */
  build(): RouteDefinition {
    if (!this.method || !this.path || !this.handler) {
      throw new Error('RouteBuilder: method, path, and handler must be set');
    }

    return {
      method: this.method,
      path: this.path,
      handler: this.handler,
      middleware: this.middleware.length > 0 ? this.middleware : undefined,
      description: this.description,
      requiresProject: this.requiresProject,
      requiresAuth: this.requiresAuth,
    };
  }
}

/**
 * Helper class for building route groups
 */
export class RouteGroupBuilder {
  private basePath: string;
  private routes: RouteDefinition[] = [];
  private groupMiddleware: Middleware[] = [];
  private description?: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Add route to group
   */
  addRoute(route: RouteDefinition): this {
    this.routes.push(route);
    return this;
  }

  /**
   * Add multiple routes to group
   */
  addRoutes(routes: RouteDefinition[]): this {
    this.routes.push(...routes);
    return this;
  }

  /**
   * Set group middleware (applied to all routes)
   */
  groupMiddleware(...middleware: Middleware[]): this {
    this.groupMiddleware.push(...middleware);
    return this;
  }

  /**
   * Set group description
   */
  description(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Build route group
   */
  build(): RouteGroup {
    return {
      basePath: this.basePath,
      routes: this.routes,
      groupMiddleware: this.groupMiddleware.length > 0 ? this.groupMiddleware : undefined,
      description: this.description,
    };
  }
}

/**
 * Router builder for applying route definitions to Express router
 */
export class RouterBuilder {
  private router: Router;
  private middlewareBuilder: MiddlewareBuilder;

  constructor(router: Router, middlewareBuilder: MiddlewareBuilder) {
    this.router = router;
    this.middlewareBuilder = middlewareBuilder;
  }

  /**
   * Apply single route definition to router
   */
  applyRoute(route: RouteDefinition): void {
    const middleware = this.buildMiddlewareChain(route);
    const routeMethod = this.router[route.method].bind(this.router);

    routeMethod(route.path, ...middleware, route.handler);
  }

  /**
   * Apply multiple route definitions to router
   */
  applyRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      this.applyRoute(route);
    }
  }

  /**
   * Apply route group to router
   */
  applyGroup(group: RouteGroup): void {
    const groupRouter = Router();

    // Apply group middleware if provided
    if (group.groupMiddleware) {
      groupRouter.use(...group.groupMiddleware);
    }

    // Apply routes to group router
    for (const route of group.routes) {
      const middleware = this.buildMiddlewareChain(route);
      const routeMethod = groupRouter[route.method].bind(groupRouter);
      routeMethod(route.path, ...middleware, route.handler);
    }

    // Mount group router at base path
    this.router.use(group.basePath, groupRouter);
  }

  /**
   * Build middleware chain for route
   */
  private buildMiddlewareChain(route: RouteDefinition): Middleware[] {
    const middleware: Middleware[] = [];

    // Add route-specific middleware if provided
    if (route.middleware) {
      middleware.push(...route.middleware);
    }

    return middleware;
  }
}

/**
 * Create a new route builder
 */
export function route(): RouteBuilder {
  return new RouteBuilder();
}

/**
 * Create a new route group builder
 */
export function routeGroup(basePath: string): RouteGroupBuilder {
  return new RouteGroupBuilder(basePath);
}

/**
 * Create a new router builder
 */
export function routerBuilder(router: Router, middlewareBuilder: MiddlewareBuilder): RouterBuilder {
  return new RouterBuilder(router, middlewareBuilder);
}

