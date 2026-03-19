/**
 * Serverless Example — Cloudflare Workers Handler
 *
 * Wraps the shared app for Cloudflare Workers. Uses KV for caching
 * and takes advantage of Cloudflare's global edge network.
 *
 * Deploy with:
 *   wrangler deploy
 *
 * wrangler.toml:
 *   name = "web-loom-api"
 *   main = "src/cloudflare/index.ts"
 *   compatibility_date = "2024-01-01"
 *   [vars]
 *   DATABASE_URL = "..."
 *   [[kv_namespaces]]
 *   binding = "CACHE"
 *   id = "your-kv-namespace-id"
 */
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { getApp } from '../shared/app';

interface Env {
  DATABASE_URL: string;
  CACHE: KVNamespace;
}

/**
 * Cloudflare Workers entry point. The handler:
 * 1. Initializes the app (cached across warm invocations)
 * 2. Injects Cloudflare-specific bindings (KV, env vars)
 * 3. Routes the request through the Web Loom middleware pipeline
 */
export default createCloudflareHandler<Env>(async (env) => {
  // Override database URL from Cloudflare env bindings
  process.env.DATABASE_URL = env.DATABASE_URL;

  const app = await getApp();

  // Use Cloudflare KV as the caching backend
  app.cache.setAdapter({
    async get(key: string) {
      const value = await env.CACHE.get(key);
      return value ? JSON.parse(value) : null;
    },
    async set(key: string, value: unknown, ttl?: number) {
      await env.CACHE.put(key, JSON.stringify(value), {
        expirationTtl: ttl,
      });
    },
    async delete(key: string) {
      await env.CACHE.delete(key);
    },
  });

  return app;
});
