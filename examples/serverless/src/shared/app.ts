/**
 * Serverless Example — Shared App Definition
 *
 * Defines the core application once. Platform-specific entry points
 * (Vercel, Cloudflare, Lambda) call getApp() and call handleRequest().
 *
 * Cold start tips:
 *  - Minimal config: no email, no auth, no webhooks
 *  - poolSize: 1 — one connection per serverless invocation
 *  - Module-scope promise: app is initialized at most once per container
 */
import { createApp, defineConfig, defineRoutes } from '@web-loom/api-core';
import { ilike } from 'drizzle-orm';
import { itemsTable } from './models/item';

const config = defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless', // edge-friendly HTTP driver
    poolSize: 1,
    connectionTimeout: 5_000,
  },

  routes: { dir: './src/shared/routes' },

  security: {
    cors: {
      origins: ['*'],
      credentials: false,
    },
  },

  features: { crud: true },

  observability: {
    logging: { level: 'warn', format: 'json' },
  },
});

// Inline routes registered alongside the auto-discovered CRUD
const extraRoutes = defineRoutes();

// GET /health — Lightweight liveness check (no DB hit)
extraRoutes.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// GET /items/search?q=... — Full-text search
extraRoutes.get('/items/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'q is required' }, 400);

  const items = await c.var.db
    .select()
    .from(itemsTable)
    .where(ilike(itemsTable.name, `%${q}%`))
    .limit(10);

  return c.json({ items });
});

// Module-level promise — reused across warm invocations
let _appPromise: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!_appPromise) {
    _appPromise = createApp(config).then((app) => {
      // Mount extra inline routes under /api
      app.hono.route('/api', extraRoutes);
      return app;
    });
  }
  return _appPromise;
}
