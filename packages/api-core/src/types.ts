/**
 * Core types for Web Loom API Framework
 *
 * These types form the foundation of the framework's type system,
 * providing the Hono context variable map and the Application interface.
 */

import type { Hono } from 'hono';
import type { EmailAdapter } from './interfaces/email-adapter';
import type { ModelRegistry } from './models/registry';
import type { RouteRegistry } from './registry/route-registry';

// ============================================================================
// Database
// ============================================================================

/**
 * Represents any Drizzle ORM database instance.
 *
 * Compatible with neon-serverless, libsql, and node-postgres drivers.
 * In route handlers, narrow to your specific driver type for full type safety:
 *
 * @example
 * ```ts
 * import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
 * import * as schema from './schema';
 *
 * app.get('/users', (c) => {
 *   const db = c.var.db as NeonDatabase<typeof schema>;
 *   return db.select().from(schema.users);
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDrizzleDB = any;

// ============================================================================
// Hono context variables
// ============================================================================

/**
 * Variables injected into every Hono request context by the framework.
 *
 * Access in route handlers via `c.var.db`, `c.var.email`, `c.var.user`.
 *
 * The `user` property is added via module augmentation by the auth-middleware
 * package and is not present in the base interface.
 */
export interface WebLoomVariables {
  /** Drizzle ORM database instance (injected globally by createApp) */
  db: AnyDrizzleDB;
  /**
   * Email adapter (injected when `config.email` is provided).
   * Accessing this when no adapter is configured throws a ConfigurationError.
   */
  email?: EmailAdapter;
}

// ============================================================================
// Application
// ============================================================================

/**
 * The running Web Loom application.
 *
 * Returned by `createApp()`. Provides lifecycle methods and access to
 * the underlying Hono instance and registries.
 */
export interface Application {
  /** The underlying Hono router instance */
  hono: Hono<{ Variables: WebLoomVariables }>;

  /** The active Drizzle ORM database connection */
  db: AnyDrizzleDB;

  /**
   * Start an HTTP server on the given port (Node.js / Docker only).
   *
   * Uses `@hono/node-server` under the hood. For serverless/edge
   * deployments use `handleRequest()` directly instead.
   *
   * @param port - TCP port to bind (default: 3000)
   */
  start(port?: number): Promise<void>;

  /**
   * Handle a single incoming Request and return a Response.
   *
   * Delegates to `hono.fetch`. Use this in serverless / edge environments:
   *
   * @example
   * ```ts
   * export default { fetch: (req) => app.handleRequest(req) };
   * ```
   */
  handleRequest(request: Request): Promise<Response>;

  /**
   * Gracefully shut down the application.
   *
   * Closes the HTTP server, waits for in-flight requests, and tears down
   * the database connection.
   *
   * @param timeout - Maximum ms to wait before forceful shutdown (default: 10000)
   */
  shutdown(timeout?: number): Promise<void>;

  /** Access the model registry (populated by `defineModel()` calls) */
  getModelRegistry(): ModelRegistry;

  /** Access the route registry (populated during route file discovery) */
  getRouteRegistry(): RouteRegistry;
}
