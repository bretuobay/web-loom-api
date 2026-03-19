/**
 * Serverless Example — Vercel Edge Handler
 *
 * Wraps the shared app with Vercel's edge runtime. The edge runtime
 * provides sub-millisecond cold starts and runs close to users globally.
 *
 * Deploy with:
 *   vercel deploy
 *
 * Or add to vercel.json:
 *   { "functions": { "api/**": { "runtime": "edge" } } }
 */
import { createVercelHandler } from '@web-loom/api-deployment-vercel';
import { getApp } from '../shared/app';

// Export the edge config so Vercel uses the edge runtime
export const config = {
  runtime: 'edge',
  // Regions close to your database for lowest latency
  regions: ['iad1', 'sfo1', 'cdg1'],
};

/**
 * Vercel edge handler — converts the Web Loom app into a Vercel-compatible
 * edge function. The handler uses the Web Standards Request/Response API
 * natively, so there's zero overhead from format conversion.
 */
export default createVercelHandler(async () => {
  const app = await getApp();
  return app;
});
