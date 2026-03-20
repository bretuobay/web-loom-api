/**
 * Serverless Example — Cloudflare Worker (raw handler)
 *
 * Exposes the full Worker API: HTTP fetch + scheduled cron trigger.
 * The cron handler accesses the db directly via app.db for maintenance tasks.
 *
 * Deploy with:
 *   wrangler deploy --config wrangler.worker.toml
 */
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { lt, sql } from 'drizzle-orm';
import { getApp } from '../shared/app';
import { itemsTable } from '../shared/models/item';

interface Env {
  DATABASE_URL: string;
}

let _handler: ReturnType<typeof createCloudflareHandler> | null = null;

async function getHandler(env: Env) {
  process.env.DATABASE_URL = env.DATABASE_URL;
  if (!_handler) {
    const app = await getApp();
    _handler = createCloudflareHandler(app);
  }
  return _handler;
}

export default {
  // Handle HTTP requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const handler = await getHandler(env);
    return handler(request, env, ctx);
  },

  // Handle cron triggers — e.g. "0 * * * *" (hourly cleanup)
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const app = await getApp();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await app.db.delete(itemsTable).where(lt(itemsTable.createdAt, thirtyDaysAgo));
  },
};
