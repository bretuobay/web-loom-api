/**
 * Serverless Example — Shared App Definition
 *
 * Defines the core application once, then wraps it with platform-specific
 * handlers (Vercel, Cloudflare, AWS Lambda). This keeps business logic
 * in one place while supporting multiple deployment targets.
 *
 * Cold start optimization tips used here:
 * - Minimal adapter set (no email, no auth for this demo)
 * - Lazy imports where possible
 * - Small model surface area
 */
import { createApp, defineConfig, defineRoutes } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";
import { Item } from "./models/item";

// Shared configuration — platform-specific overrides are applied by each handler
const config = defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
  },

  database: {
    url: process.env.DATABASE_URL!,
    // Lower pool size for serverless — each invocation gets one connection
    poolSize: 1,
    connectionTimeout: 5_000,
  },

  security: {
    cors: {
      origin: ["*"],
      credentials: false,
    },
  },

  features: {
    crud: true,
  },

  observability: {
    logging: { level: "warn", format: "json" },
  },
});

// Custom routes alongside auto-generated CRUD
const routes = defineRoutes((router) => {
  // GET /api/health — Lightweight health check (no DB hit)
  router.get("/api/health", {
    handler: async (ctx) => {
      return ctx.json({ status: "ok", timestamp: Date.now() });
    },
  });

  // GET /api/items/search — Search items by name
  router.get("/api/items/search", {
    validation: {
      query: { q: { type: "string", required: true, minLength: 1 } },
    },
    handler: async (ctx) => {
      const items = await ctx.db
        .select(Item)
        .where("name", "ilike", `%${ctx.query.q}%`)
        .limit(10);

      return ctx.json({ items });
    },
  });
});

/**
 * Create and cache the app instance. In serverless environments, the module
 * scope persists across warm invocations, so the app is only initialized once.
 */
let appPromise: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!appPromise) {
    appPromise = createApp(config, { routes });
  }
  return appPromise;
}
