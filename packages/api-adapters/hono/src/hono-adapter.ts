import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type {
  APIFrameworkAdapter,
  RouteHandler,
  Middleware,
  MiddlewareOptions,
  RequestContext,
} from '@web-loom/api-core';
import type { HTTPMethod } from '@web-loom/api-shared';

/**
 * Hono API Framework Adapter
 * 
 * Implements the APIFrameworkAdapter interface using Hono, a lightweight
 * (~12KB) web framework optimized for edge runtimes.
 * 
 * Features:
 * - Fast routing with radix tree
 * - Native Web Standards API (Request/Response)
 * - Excellent edge runtime support (Cloudflare Workers, Vercel Edge, etc.)
 * - Built-in middleware support
 * 
 * @example
 * ```typescript
 * const adapter = new HonoAdapter();
 * adapter.registerRoute('GET', '/users/:id', async (ctx) => {
 *   return new Response(JSON.stringify({ id: ctx.params.id }));
 * });
 * await adapter.listen(3000);
 * ```
 */
export class HonoAdapter implements APIFrameworkAdapter {
  private app: Hono;
  private server: any = null; // Use any to handle different server types from @hono/node-server

  constructor() {
    this.app = new Hono();
  }

  /**
   * Register a route handler for a specific HTTP method and path
   */
  registerRoute(method: HTTPMethod, path: string, handler: RouteHandler): void {
    // Convert Web Loom path format to Hono format if needed
    // Web Loom uses :param, Hono also uses :param, so no conversion needed
    const honoPath = path;

    // Wrap the handler to convert between Hono context and RequestContext
    const wrappedHandler = async (c: any) => {
      // Check if context was already created by middleware
      let requestContext = c.get('webLoomContext');
      
      if (!requestContext) {
        requestContext = await this.createRequestContext(c);
      }
      
      return await handler(requestContext);
    };

    // Register the route with Hono using the appropriate method
    switch (method) {
      case 'GET':
        this.app.get(honoPath, wrappedHandler);
        break;
      case 'POST':
        this.app.post(honoPath, wrappedHandler);
        break;
      case 'PUT':
        this.app.put(honoPath, wrappedHandler);
        break;
      case 'PATCH':
        this.app.patch(honoPath, wrappedHandler);
        break;
      case 'DELETE':
        this.app.delete(honoPath, wrappedHandler);
        break;
      case 'OPTIONS':
        this.app.options(honoPath, wrappedHandler);
        break;
      case 'HEAD':
        // Hono doesn't have a dedicated head() method, use all() with method check
        this.app.all(honoPath, async (c) => {
          if (c.req.method === 'HEAD') {
            return await wrappedHandler(c);
          }
          // Let other methods pass through
          return c.notFound();
        });
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  /**
   * Register middleware to be executed in the request pipeline
   */
  registerMiddleware(middleware: Middleware, options?: MiddlewareOptions): void {
    // Wrap the middleware to convert between Hono context and RequestContext
    const wrappedMiddleware = async (c: any, next: () => Promise<void>) => {
      const requestContext = await this.createRequestContext(c);
      
      // Store the context in Hono's context so it can be shared
      c.set('webLoomContext', requestContext);
      
      // Create a next function that matches our Middleware signature
      const nextFn = async (): Promise<Response> => {
        await next();
        return c.res as Response;
      };

      const result = await middleware(requestContext, nextFn);
      
      // If middleware returns a Response, use it
      if (result instanceof Response) {
        return result;
      }
      
      // Otherwise, continue with the existing response
      return c.res;
    };

    // Register middleware with Hono
    if (options?.path) {
      // Scoped middleware
      if (options.methods && options.methods.length > 0) {
        // Register for specific methods
        for (const method of options.methods) {
          switch (method) {
            case 'GET':
              this.app.get(options.path, wrappedMiddleware);
              break;
            case 'POST':
              this.app.post(options.path, wrappedMiddleware);
              break;
            case 'PUT':
              this.app.put(options.path, wrappedMiddleware);
              break;
            case 'PATCH':
              this.app.patch(options.path, wrappedMiddleware);
              break;
            case 'DELETE':
              this.app.delete(options.path, wrappedMiddleware);
              break;
            case 'OPTIONS':
              this.app.options(options.path, wrappedMiddleware);
              break;
            case 'HEAD':
              this.app.on('HEAD', options.path, wrappedMiddleware);
              break;
          }
        }
      } else {
        // Register for all methods on this path
        this.app.use(options.path, wrappedMiddleware);
      }
    } else {
      // Global middleware
      this.app.use('*', wrappedMiddleware);
    }
  }

  /**
   * Handle an incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    return await this.app.fetch(request);
  }

  /**
   * Start the HTTP server listening on the specified port
   */
  async listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = serve({
        fetch: this.app.fetch,
        port,
      });
      
      // Wait for server to be ready
      this.server.once('listening', () => {
        resolve();
      });
    });
  }

  /**
   * Gracefully close the HTTP server
   */
  async close(): Promise<void> {
    if (this.server) {
      const server = this.server;
      return new Promise((resolve, reject) => {
        server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            this.server = null;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Create a RequestContext from Hono's context
   */
  private async createRequestContext(c: any): Promise<RequestContext> {
    // Parse request body if present
    let body: unknown = undefined;
    const contentType = c.req.header('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        body = await c.req.json();
      } catch {
        // Invalid JSON, leave body as undefined
        body = undefined;
      }
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      try {
        body = await c.req.parseBody();
      } catch {
        body = undefined;
      }
    } else if (contentType?.includes('multipart/form-data')) {
      try {
        body = await c.req.parseBody();
      } catch {
        body = undefined;
      }
    }

    // Extract query parameters
    const url = new URL(c.req.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return {
      request: c.req.raw as Request,
      params: c.req.param() || {},
      query,
      body,
      user: undefined,
      session: undefined,
      metadata: new Map(),
    };
  }
}
