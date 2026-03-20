/**
 * createApp — Web Loom API application factory
 *
 * Creates a fully configured Hono application and wraps it in the
 * `Application` interface. Call this once at startup:
 *
 * @example
 * ```typescript
 * import { createApp } from '@web-loom/api-core';
 * import config from './webloom.config';
 *
 * const app = await createApp(config);
 * await app.start(3000);
 * ```
 */

import { Hono } from 'hono';
import type { Env } from 'hono';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import { resolve } from 'node:path';
import type { WebLoomConfig } from '../config/types';
import type { Application, WebLoomVariables } from '../types';
import { ConfigurationError } from '../errors/configuration-error';
import { modelRegistry } from '../models/registry';
import type { AnyModel } from '../models/types';
import { RouteRegistry } from '../registry/route-registry';
import { createDrizzleDb } from '../db/create-drizzle-db';
import { globalErrorHandler } from '../routing/error-handler';
import { discoverAndMountRoutes } from '../routing/route-discovery';
import type { HTTPMethod } from '@web-loom/api-shared';
import type { RouteMetaEntry } from '../routing/open-api-meta';

const DEFAULT_API_BASE_PATH = '/api';

function joinPaths(...parts: string[]): string {
  const segments = parts.flatMap((part) => part.split('/').filter(Boolean));
  return segments.length ? `/${segments.join('/')}` : '/';
}

function registerMountedRouterRoutes<TRouterEnv extends Env>(
  routeRegistry: RouteRegistry,
  router: Hono<TRouterEnv>,
  mountPath: string
): void {
  const seen = new Set<string>();

  for (const route of router.routes) {
    const fullPath = joinPaths(mountPath, route.path);
    const key = `${route.method.toUpperCase()} ${fullPath}`;

    if (seen.has(key)) continue;
    seen.add(key);

    routeRegistry.register({
      path: fullPath,
      method: route.method.toUpperCase() as HTTPMethod,
      handler: route.handler as () => Promise<Response>,
    });
  }
}

export interface CreateAppOptions {
  /**
   * Optional CRUD router generator. When provided, the app will call this
   * function for every model with `crud` enabled and mount the returned
   * Hono router before file-based routes.
   *
   * Pass `generateCrudRouter` from `@web-loom/api-generator-crud`:
   * ```ts
   * import { generateCrudRouter } from '@web-loom/api-generator-crud';
   * const app = await createApp(config, { crudGenerator: generateCrudRouter });
   * ```
   */
  crudGenerator?: (model: AnyModel) => Hono<{ Variables: WebLoomVariables }>;

  /**
   * Optional OpenAPI route setup callback. When provided, registers
   * /openapi.json, /openapi.yaml, and /docs after all other routes.
   *
   * Pass setupOpenApiRoutes from @web-loom/api-generator-openapi.
   */
  openapiSetup?: (
    hono: Hono<{ Variables: WebLoomVariables }>,
    models: AnyModel[],
    routeMetas: RouteMetaEntry[],
    config: import('../config/types').OpenApiConfig
  ) => Promise<void>;
}

/**
 * Create and return a running Web Loom application.
 *
 * Initialises the Drizzle database connection for the configured driver,
 * registers global middleware (db injector, logger, compress), mounts
 * the `/health` and `/ready` routes, runs file-based route discovery, and
 * wires the global error handler.
 *
 * @throws {ConfigurationError} if `database.url` or `database.driver` is missing
 */
export async function createApp(
  config: WebLoomConfig,
  options?: CreateAppOptions
): Promise<Application> {
  // ── Database ─────────────────────────────────────────────────────────────
  const db = await createDrizzleDb(config.database);

  // ── Registries ───────────────────────────────────────────────────────────
  const routeRegistry = new RouteRegistry();
  const routeMetas: RouteMetaEntry[] = [];

  // ── Hono instance ────────────────────────────────────────────────────────
  const hono = new Hono<{ Variables: WebLoomVariables }>();

  // ── Global middleware ────────────────────────────────────────────────────

  // 1. DB injector (must be first so all route handlers have access)
  hono.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });

  // 2. Email injector (only when configured)
  if (config.email) {
    const emailAdapter = config.email;
    hono.use('*', async (c, next) => {
      c.set('email', emailAdapter);
      await next();
    });
  } else {
    // Proxy access to throw a helpful ConfigurationError at call-time
    hono.use('*', async (c, next) => {
      Object.defineProperty(c.var, 'email', {
        get() {
          throw new ConfigurationError(
            'c.var.email was accessed but no email adapter is configured. ' +
              'Add an `email` adapter to your webloom.config.ts.'
          );
        },
        configurable: true,
      });
      await next();
    });
  }

  // 3. Request logging (enabled by default; disable via observability.logging: undefined)
  if (config.observability?.logging !== undefined) {
    hono.use('*', logger());
  } else {
    hono.use('*', logger());
  }

  // 4. Response compression (gzip / deflate)
  hono.use('*', compress());

  // ── Built-in routes ──────────────────────────────────────────────────────

  hono.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
  routeRegistry.register({
    path: '/health',
    method: 'GET',
    handler: async () => new Response(),
  });

  // /ready: perform a lightweight DB health check
  hono.get('/ready', async (c) => {
    try {
      // Attempt a trivial query to verify the DB connection is alive.
      // AnyDrizzleDB has no common query API so we fall back to the raw client.
      const client = db?.$client;
      if (client) {
        if (typeof client.execute === 'function') {
          await client.execute('SELECT 1');
        } else if (typeof client.query === 'function') {
          await client.query('SELECT 1');
        }
      }
      return c.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch {
      return c.json({ status: 'unavailable', timestamp: new Date().toISOString() }, 503);
    }
  });
  routeRegistry.register({
    path: '/ready',
    method: 'GET',
    handler: async () => new Response(),
  });

  // ── CRUD routes (before file-based routes) ─────────────────────────────────
  let crudGenerator = options?.crudGenerator;
  if (!crudGenerator && config.features?.crud !== false) {
    try {
      ({ generateCrudRouter: crudGenerator } = await import('@web-loom/api-generator-crud'));
    } catch {
      console.warn(
        '[web-loom] CRUD is enabled but @web-loom/api-generator-crud is not installed; skipping generated CRUD routes.'
      );
    }
  }

  if (crudGenerator && config.features?.crud !== false) {
    for (const model of modelRegistry.getAll()) {
      if (!model.meta.crud) continue;
      const router = crudGenerator(model);
      const mountPath = joinPaths(DEFAULT_API_BASE_PATH, model.meta.basePath);
      registerMountedRouterRoutes(routeRegistry, router, mountPath);
      hono.route(mountPath, router);
    }
  }

  // ── File-based route discovery ────────────────────────────────────────────

  if (config.routes?.dir) {
    const routesDir = resolve(process.cwd(), config.routes.dir);
    await discoverAndMountRoutes(hono, routesDir, {
      basePath: DEFAULT_API_BASE_PATH,
      routeRegistry,
      routeMetaEntries: routeMetas,
    });
  }

  // ── OpenAPI routes (after all app routes) ────────────────────────────────
  let openapiSetup = options?.openapiSetup;
  if (!openapiSetup && config.openapi?.enabled !== false) {
    try {
      ({ setupOpenApiRoutes: openapiSetup } = await import('@web-loom/api-generator-openapi'));
    } catch {
      console.warn(
        '[web-loom] OpenAPI is enabled but @web-loom/api-generator-openapi is not installed; skipping /openapi.json and /docs routes.'
      );
    }
  }

  if (openapiSetup && config.openapi?.enabled !== false) {
    await openapiSetup(hono, modelRegistry.getAll(), routeMetas, {
      routeBasePath: DEFAULT_API_BASE_PATH,
      ...(config.openapi ?? {}),
    });

    routeRegistry.register({
      path: '/openapi.json',
      method: 'GET',
      handler: async () => new Response(),
    });
    routeRegistry.register({
      path: '/openapi.yaml',
      method: 'GET',
      handler: async () => new Response(),
    });
  }

  // ── Global error handler ──────────────────────────────────────────────────

  hono.onError(globalErrorHandler);

  // ── Server management ─────────────────────────────────────────────────────

  let serverClose: (() => Promise<void>) | null = null;

  // ── Application object ────────────────────────────────────────────────────

  const app: Application = {
    hono,
    db,

    async start(port = 3000): Promise<void> {
      // Dynamically import to avoid bundling in edge environments
      const { serve } = await import('@hono/node-server');
      const server = serve({ fetch: hono.fetch, port });

      serverClose = () =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        });

      console.log(`[web-loom] server listening on port ${port}`);
    },

    async handleRequest(request: Request): Promise<Response> {
      return hono.fetch(request);
    },

    async shutdown(timeout = 10_000): Promise<void> {
      const teardown = async () => {
        if (serverClose) await serverClose();
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Shutdown timeout exceeded')), timeout)
      );

      await Promise.race([teardown(), timeoutPromise]);
    },

    getModelRegistry() {
      return modelRegistry;
    },

    getRouteRegistry() {
      return routeRegistry;
    },
  };

  return app;
}
