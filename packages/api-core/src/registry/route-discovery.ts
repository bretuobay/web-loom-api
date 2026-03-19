import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HTTPMethod } from '@web-loom/api-shared';
import type { RouteRegistry } from './route-registry';
import type { RouteDefinition } from './route-types';

/**
 * Route Discovery
 *
 * Discovers and registers routes from the file system using file-based routing conventions.
 * Scans the routes directory recursively and maps file paths to URL paths.
 *
 * **File-Based Routing Conventions:**
 * - `index.ts` → `/`
 * - `users.ts` → `/users`
 * - `users/[id].ts` → `/users/:id` (dynamic segment)
 * - `[...path].ts` → `/*` (catch-all route)
 * - Nested folders create nested paths: `users/posts.ts` → `/users/posts`
 *
 * **Supported HTTP Methods:**
 * Route files export functions named after HTTP methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
 *
 * **Requirements:** 6.1, 6.2, 6.3, 6.4, 1.3
 *
 * @example
 * ```typescript
 * const discovery = new RouteDiscovery(registry);
 * await discovery.discover('./src/routes');
 * ```
 */
export class RouteDiscovery {
  private registry: RouteRegistry;

  constructor(registry: RouteRegistry) {
    this.registry = registry;
  }

  /**
   * Discover and register all routes from a directory
   *
   * @param routesDir - Path to the routes directory
   * @returns Promise that resolves when all routes are discovered and registered
   *
   * @example
   * ```typescript
   * await discovery.discover('./src/routes');
   * ```
   */
  async discover(routesDir: string): Promise<void> {
    const absolutePath = path.resolve(routesDir);

    // Check if directory exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Routes directory not found: ${routesDir}`);
    }

    // Scan directory recursively
    await this.scanDirectory(absolutePath, absolutePath);
  }

  /**
   * Scan a directory recursively for route files
   *
   * @param dir - Current directory to scan
   * @param baseDir - Base routes directory for path calculation
   */
  private async scanDirectory(dir: string, baseDir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await this.scanDirectory(fullPath, baseDir);
      } else if (entry.isFile() && this.isRouteFile(entry.name)) {
        // Process route file
        await this.processRouteFile(fullPath, baseDir);
      }
    }
  }

  /**
   * Check if a file is a valid route file
   *
   * @param filename - File name to check
   * @returns True if file is a route file (.ts or .js, not .test or .spec)
   */
  private isRouteFile(filename: string): boolean {
    // Must be .ts or .js file
    if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
      return false;
    }

    // Exclude test files
    if (filename.includes('.test.') || filename.includes('.spec.')) {
      return false;
    }

    // Exclude type definition files
    if (filename.endsWith('.d.ts')) {
      return false;
    }

    return true;
  }

  /**
   * Process a route file and register its handlers
   *
   * @param filePath - Absolute path to the route file
   * @param baseDir - Base routes directory for path calculation
   */
  private async processRouteFile(filePath: string, baseDir: string): Promise<void> {
    try {
      // Convert file path to URL path
      const urlPath = this.filePathToUrlPath(filePath, baseDir);

      // Import the route module
      const module = await this.importRouteModule(filePath);

      // Register handlers for each HTTP method
      this.registerHandlers(module, urlPath);
    } catch (error) {
      // Wrap error with file context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to process route file ${filePath}: ${message}`);
    }
  }

  /**
   * Convert a file path to a URL path
   *
   * Applies file-based routing conventions:
   * - index.ts → /
   * - users.ts → /users
   * - users/[id].ts → /users/:id
   * - [...path].ts → /*
   *
   * @param filePath - Absolute file path
   * @param baseDir - Base routes directory
   * @returns URL path
   */
  private filePathToUrlPath(filePath: string, baseDir: string): string {
    // Get relative path from base directory
    let relativePath = path.relative(baseDir, filePath);

    // Remove file extension
    relativePath = relativePath.replace(/\.(ts|js)$/, '');

    // Handle index files
    if (relativePath.endsWith('/index') || relativePath === 'index') {
      relativePath = relativePath.replace(/\/?index$/, '');
    }

    // Convert to URL path segments
    const segments = relativePath.split(path.sep).filter(Boolean);

    // Transform segments according to conventions
    const urlSegments = segments.map((segment) => {
      // Dynamic segment: [id] → :id
      if (segment.startsWith('[') && segment.endsWith(']') && !segment.startsWith('[...')) {
        const paramName = segment.slice(1, -1);
        return `:${paramName}`;
      }

      // Catch-all route: [...path] → *
      if (segment.startsWith('[...') && segment.endsWith(']')) {
        return '*';
      }

      // Static segment
      return segment;
    });

    // Join segments with /
    const urlPath = '/' + urlSegments.join('/');

    // Normalize: remove trailing slash except for root
    return urlPath === '/' ? urlPath : urlPath.replace(/\/$/, '');
  }

  /**
   * Import a route module dynamically
   *
   * @param filePath - Absolute path to the route file
   * @returns Imported module
   */
  private async importRouteModule(filePath: string): Promise<Record<string, unknown>> {
    // For Windows compatibility, convert backslashes to forward slashes
    // and ensure we have a proper file:// URL
    const normalizedPath = filePath.replace(/\\/g, '/');

    // On Windows, we need file:///C:/... format
    // On Unix, we need file:///path/to/file format
    const fileUrl = normalizedPath.startsWith('/')
      ? `file://${normalizedPath}`
      : `file:///${normalizedPath}`;

    // Dynamic import
    const module = await import(fileUrl);

    return module;
  }

  /**
   * Register route handlers from a module
   *
   * Looks for exported functions named after HTTP methods (GET, POST, etc.)
   * and registers them with the route registry.
   *
   * @param module - Imported route module
   * @param urlPath - URL path for the route
   */
  private registerHandlers(module: Record<string, unknown>, urlPath: string): void {
    const httpMethods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

    let handlerCount = 0;

    for (const method of httpMethods) {
      const handler = module[method];

      // Check if handler exists and is a function
      if (typeof handler === 'function') {
        const routeDefinition: RouteDefinition = {
          path: urlPath,
          method,
          handler: handler as RouteDefinition['handler'],
        };

        this.registry.register(routeDefinition);
        handlerCount++;
      }
    }

    // Warn if no handlers found
    if (handlerCount === 0) {
      console.warn(`No HTTP method handlers found in route file for path: ${urlPath}`);
    }
  }

  /**
   * Get statistics about discovered routes
   *
   * @returns Object with discovery statistics
   */
  getStats(): { totalRoutes: number; routesByMethod: Record<HTTPMethod, number> } {
    const allRoutes = this.registry.getAll();
    const routesByMethod: Record<HTTPMethod, number> = {
      GET: 0,
      POST: 0,
      PUT: 0,
      PATCH: 0,
      DELETE: 0,
      OPTIONS: 0,
      HEAD: 0,
    };

    for (const route of allRoutes) {
      routesByMethod[route.method] = (routesByMethod[route.method] ?? 0) + 1;
    }

    return {
      totalRoutes: allRoutes.length,
      routesByMethod,
    };
  }
}
