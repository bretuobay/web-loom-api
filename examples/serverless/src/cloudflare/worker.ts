/**
 * Serverless Example — Cloudflare Worker Entry Point
 *
 * Alternative entry point that shows the raw Worker fetch handler pattern.
 * Use this when you need fine-grained control over the request lifecycle
 * or want to add Cloudflare-specific features like Durable Objects.
 */
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { getApp } from '../shared/app';

interface Env {
  DATABASE_URL: string;
  CACHE: KVNamespace;
}

const handler = createCloudflareHandler<Env>(async (env) => {
  process.env.DATABASE_URL = env.DATABASE_URL;
  return getApp();
});

/**
 * Raw Worker export — gives you access to the full Worker API including
 * scheduled events, queue consumers, and Durable Object bindings.
 */
export default {
  // Handle HTTP requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },

  // Handle cron triggers (e.g., cleanup stale data every hour)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const app = await getApp();

    // Run cleanup tasks
    await app.db.execute("DELETE FROM items WHERE created_at < NOW() - INTERVAL '30 days'");
  },
};
