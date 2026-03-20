/**
 * Serverless Example — Cloudflare Workers Handler
 *
 * createCloudflareHandler() accepts an Application instance directly.
 * DATABASE_URL is injected from the Worker env before app initialization.
 *
 * wrangler.toml:
 *   name = "web-loom-api"
 *   main = "src/cloudflare/index.ts"
 *   compatibility_date = "2024-01-01"
 *   [vars]
 *   DATABASE_URL = "..."
 */
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { getApp } from '../shared/app';

interface Env {
  DATABASE_URL: string;
}

// Cache the initialized handler across warm invocations
let _handler: ReturnType<typeof createCloudflareHandler> | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Inject Cloudflare env vars before app initialization
    process.env.DATABASE_URL = env.DATABASE_URL;

    if (!_handler) {
      const app = await getApp();
      _handler = createCloudflareHandler(app);
    }

    return _handler(request, env, ctx);
  },
};
