import type { HTTPMethod } from '@webloom/api-shared';

/**
 * API Framework Adapter Interface
 * 
 * Abstracts HTTP routing frameworks (e.g., Hono, Express, Fastify) to provide
 * a unified interface for route registration, middleware management, and request handling.
 * 
 * This adapter enables the framework to be framework-agnostic, allowing developers
 * to swap HTTP frameworks without changing application code.
 * 
 * **Default Implementation:** Hono (lightweight, edge-optimized)
 * **Alternative Implementations:** Express, Fastify, custom adapters
 * 
 * @example
 * ```typescript
 * const adapter = new HonoAdapter();
 * adapter.registerRoute('GET', '/users/:id', async (ctx) => {
 *   return new Response(JSON.stringify({ id: ctx.params.id }));
 * });
 * await adapter.listen(3000);
 * ```
 * 
 * **Requirements:** 2.1, 8.3, 8.4
 */
export interface APIFrameworkAdapter {
  /**
   * Register a route handler for a specific HTTP method and path
   * 
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
   * @param path - URL path pattern (supports :param for dynamic segments)
   * @param handler - Route handler function that processes requests
   * 
   * @example
   * ```typescript
   * adapter.registerRoute('GET', '/users/:id', async (ctx) => {
   *   const user = await db.getUser(ctx.params.id);
   *   return new Response(JSON.stringify(user));
   * });
   * ```
   */
  registerRoute(method: HTTPMethod, path: string, handler: RouteHandler): void;

  /**
   * Register middleware to be executed in the request pipeline
   * 
   * Middleware can be global (applies to all routes) or scoped to specific
   * paths and HTTP methods.
   * 
   * @param middleware - Middleware function
   * @param options - Optional configuration for path and method filtering
   * 
   * @example
   * ```typescript
   * // Global middleware
   * adapter.registerMiddleware(loggingMiddleware);
   * 
   * // Scoped middleware
   * adapter.registerMiddleware(authMiddleware, { 
   *   path: '/admin/*',
   *   methods: ['GET', 'POST']
   * });
   * ```
   */
  registerMiddleware(middleware: Middleware, options?: MiddlewareOptions): void;

  /**
   * Handle an incoming HTTP request
   * 
   * Processes the request through the middleware pipeline and route handler,
   * returning an HTTP response.
   * 
   * @param request - Web Standards Request object
   * @returns Promise resolving to Web Standards Response object
   * 
   * @example
   * ```typescript
   * const request = new Request('http://localhost:3000/users/123');
   * const response = await adapter.handleRequest(request);
   * ```
   */
  handleRequest(request: Request): Promise<Response>;

  /**
   * Start the HTTP server listening on the specified port
   * 
   * @param port - Port number to listen on
   * @returns Promise that resolves when server is ready
   * 
   * @example
   * ```typescript
   * await adapter.listen(3000);
   * console.log('Server listening on port 3000');
   * ```
   */
  listen(port: number): Promise<void>;

  /**
   * Gracefully close the HTTP server
   * 
   * Stops accepting new connections and waits for existing requests to complete.
   * 
   * @returns Promise that resolves when server is closed
   * 
   * @example
   * ```typescript
   * await adapter.close();
   * console.log('Server closed');
   * ```
   */
  close(): Promise<void>;
}

/**
 * Route handler function type
 * 
 * Processes an HTTP request and returns a response. Can be synchronous or asynchronous.
 * 
 * @param context - Request context containing parsed request data
 * @returns Response object or Promise resolving to Response
 */
export type RouteHandler = (context: RequestContext) => Promise<Response> | Response;

/**
 * Middleware function type
 * 
 * Intercepts requests in the pipeline, optionally modifying the context or response.
 * Must call `next()` to continue to the next middleware or route handler.
 * 
 * @param context - Request context
 * @param next - Function to invoke the next middleware/handler
 * @returns Response, void, or Promise resolving to Response or void
 */
export type Middleware = (
  context: RequestContext,
  next: NextFunction
) => Promise<Response | void> | Response | void;

/**
 * Request context passed to route handlers and middleware
 * 
 * Contains parsed request data and metadata for the current request.
 */
export interface RequestContext {
  /** Web Standards Request object */
  request: Request;
  
  /** URL path parameters (e.g., { id: '123' } for /users/:id) */
  params: Record<string, string>;
  
  /** URL query parameters (e.g., { page: '1', limit: '20' }) */
  query: Record<string, string>;
  
  /** Parsed request body (JSON, form data, etc.) */
  body: unknown;
  
  /** Authenticated user (set by auth middleware) */
  user?: unknown;
  
  /** Session data (set by auth middleware) */
  session?: unknown;
  
  /** Additional metadata for request-scoped data */
  metadata: Map<string, unknown>;
}

/**
 * Function to invoke the next middleware or route handler in the pipeline
 * 
 * @returns Promise resolving to the Response from downstream handlers
 */
export type NextFunction = () => Promise<Response>;

/**
 * Options for configuring middleware behavior
 */
export interface MiddlewareOptions {
  /** Path pattern to match (supports wildcards, e.g., '/admin/*') */
  path?: string;
  
  /** HTTP methods to apply middleware to (if omitted, applies to all methods) */
  methods?: HTTPMethod[];
}
