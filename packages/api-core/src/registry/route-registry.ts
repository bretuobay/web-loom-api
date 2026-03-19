import type { HTTPMethod } from '@web-loom/api-shared';
import { ConflictError, NotFoundError } from '@web-loom/api-shared';
import type { RouteDefinition, RouteMatch, RouteMetadata } from './route-types';

/**
 * Route Registry
 *
 * Central registry for tracking all route handlers in the application.
 * Provides route registration, retrieval, matching with parameter extraction,
 * and conflict detection.
 *
 * **Features:**
 * - Route registration with HTTP method and path
 * - Dynamic route parameter extraction (e.g., /users/:id)
 * - Conflict detection for duplicate routes
 * - Route matching with parameter extraction
 * - Metadata management for documentation
 *
 * **Requirements:** 5.1, 5.2, 5.3, 6.5, 6.6
 *
 * @example
 * ```typescript
 * const registry = new RouteRegistry();
 *
 * // Register a route
 * registry.register({
 *   path: '/users/:id',
 *   method: 'GET',
 *   handler: async (ctx) => new Response(JSON.stringify({ id: ctx.params.id }))
 * });
 *
 * // Match a route
 * const match = registry.match('/users/123', 'GET');
 * console.log(match?.params); // { id: '123' }
 * ```
 */
export class RouteRegistry {
  /**
   * Internal storage for routes
   * Key format: `${method}:${path}`
   */
  private routes: Map<string, RouteDefinition> = new Map();

  /**
   * Register a new route in the registry
   *
   * @param route - Route definition to register
   * @throws {ConflictError} If a route with the same method and path already exists
   *
   * @example
   * ```typescript
   * registry.register({
   *   path: '/users/:id',
   *   method: 'GET',
   *   handler: getUserHandler,
   *   metadata: { description: 'Get user by ID' }
   * });
   * ```
   */
  register(route: RouteDefinition): void {
    const key = this.createKey(route.method, route.path);

    // Check for conflicts
    if (this.routes.has(key)) {
      throw new ConflictError(`Route already registered: ${route.method} ${route.path}`);
    }

    this.routes.set(key, route);
  }

  /**
   * Unregister a route from the registry
   *
   * @param path - Route path
   * @param method - HTTP method
   * @throws {NotFoundError} If the route doesn't exist
   *
   * @example
   * ```typescript
   * registry.unregister('/users/:id', 'GET');
   * ```
   */
  unregister(path: string, method: HTTPMethod): void {
    const key = this.createKey(method, path);

    if (!this.routes.has(key)) {
      throw new NotFoundError(`Route not found: ${method} ${path}`);
    }

    this.routes.delete(key);
  }

  /**
   * Get a route by exact path and method
   *
   * @param path - Route path
   * @param method - HTTP method
   * @returns Route definition or undefined if not found
   *
   * @example
   * ```typescript
   * const route = registry.get('/users/:id', 'GET');
   * if (route) {
   *   console.log(route.metadata?.description);
   * }
   * ```
   */
  get(path: string, method: HTTPMethod): RouteDefinition | undefined {
    const key = this.createKey(method, path);
    return this.routes.get(key);
  }

  /**
   * Get all registered routes
   *
   * @returns Array of all route definitions
   *
   * @example
   * ```typescript
   * const allRoutes = registry.getAll();
   * console.log(`Total routes: ${allRoutes.length}`);
   * ```
   */
  getAll(): RouteDefinition[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get all routes for a specific path (all methods)
   *
   * @param path - Route path
   * @returns Array of route definitions for the path
   *
   * @example
   * ```typescript
   * const userRoutes = registry.getByPath('/users/:id');
   * // Returns routes for GET, PUT, PATCH, DELETE, etc.
   * ```
   */
  getByPath(path: string): RouteDefinition[] {
    return Array.from(this.routes.values()).filter((route) => route.path === path);
  }

  /**
   * Match a URL path against registered routes and extract parameters
   *
   * Supports dynamic route parameters (e.g., /users/:id, /posts/:slug)
   * and extracts parameter values from the URL.
   *
   * @param path - URL path to match
   * @param method - HTTP method
   * @returns Route match with extracted parameters, or undefined if no match
   *
   * @example
   * ```typescript
   * const match = registry.match('/users/123', 'GET');
   * if (match) {
   *   console.log(match.params.id); // '123'
   *   await match.route.handler(context);
   * }
   * ```
   */
  match(path: string, method: HTTPMethod): RouteMatch | undefined {
    // Normalize path (remove trailing slash except for root)
    const normalizedPath = path === '/' ? path : path.replace(/\/$/, '');

    // Try exact match first (for static routes)
    const exactRoute = this.get(normalizedPath, method);
    if (exactRoute) {
      return {
        route: exactRoute,
        params: {},
      };
    }

    // Try pattern matching for dynamic routes
    for (const route of this.routes.values()) {
      if (route.method !== method) {
        continue;
      }

      const params = this.matchPattern(route.path, normalizedPath);
      if (params !== null) {
        return {
          route,
          params,
        };
      }
    }

    return undefined;
  }

  /**
   * Get metadata for a specific route
   *
   * @param path - Route path
   * @param method - HTTP method
   * @returns Route metadata or empty object if not found
   *
   * @example
   * ```typescript
   * const metadata = registry.getMetadata('/users/:id', 'GET');
   * console.log(metadata.description);
   * ```
   */
  getMetadata(path: string, method: HTTPMethod): RouteMetadata {
    const route = this.get(path, method);
    return route?.metadata || {};
  }

  /**
   * Create a unique key for storing routes
   *
   * @param method - HTTP method
   * @param path - Route path
   * @returns Unique key string
   */
  private createKey(method: HTTPMethod, path: string): string {
    // Normalize path (remove trailing slash except for root)
    const normalizedPath = path === '/' ? path : path.replace(/\/$/, '');
    return `${method}:${normalizedPath}`;
  }

  /**
   * Match a route pattern against a URL path and extract parameters
   *
   * Converts route patterns like /users/:id to regex and extracts parameter values.
   *
   * @param pattern - Route pattern (e.g., /users/:id)
   * @param path - URL path to match (e.g., /users/123)
   * @returns Object with extracted parameters, or null if no match
   */
  private matchPattern(pattern: string, path: string): Record<string, string> | null {
    // Normalize pattern
    const normalizedPattern = pattern === '/' ? pattern : pattern.replace(/\/$/, '');

    // If patterns are identical, it's a match with no params
    if (normalizedPattern === path) {
      return {};
    }

    // Split pattern and path into segments
    const patternSegments = normalizedPattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    // Must have same number of segments (unless we support wildcards later)
    if (patternSegments.length !== pathSegments.length) {
      return null;
    }

    const params: Record<string, string> = {};

    // Match each segment
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];
      const pathSegment = pathSegments[i];

      // Both segments must exist (already checked by length comparison)
      if (!patternSegment || !pathSegment) {
        return null;
      }

      // Check if this is a parameter segment (starts with :)
      if (patternSegment.startsWith(':')) {
        const paramName = patternSegment.slice(1);
        params[paramName] = decodeURIComponent(pathSegment);
      } else if (patternSegment !== pathSegment) {
        // Static segment doesn't match
        return null;
      }
    }

    return params;
  }

  /**
   * Check if a route exists
   *
   * @param path - Route path
   * @param method - HTTP method
   * @returns True if route exists, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.has('/users/:id', 'GET')) {
   *   console.log('Route exists');
   * }
   * ```
   */
  has(path: string, method: HTTPMethod): boolean {
    const key = this.createKey(method, path);
    return this.routes.has(key);
  }

  /**
   * Clear all routes from the registry
   *
   * Useful for testing or hot reload scenarios.
   *
   * @example
   * ```typescript
   * registry.clear();
   * console.log(registry.getAll().length); // 0
   * ```
   */
  clear(): void {
    this.routes.clear();
  }

  /**
   * Get the total number of registered routes
   *
   * @returns Number of routes
   *
   * @example
   * ```typescript
   * console.log(`Total routes: ${registry.size()}`);
   * ```
   */
  size(): number {
    return this.routes.size;
  }
}
