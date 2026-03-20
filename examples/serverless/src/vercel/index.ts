/**
 * Serverless Example — Vercel Edge Handler
 *
 * createVercelHandler() accepts an Application instance directly (not a
 * factory function). We lazily initialize the app and call handleRequest
 * manually so the handler can be exported as a standard edge function.
 *
 * Deploy with:
 *   vercel deploy
 */
import { createVercelHandler } from '@web-loom/api-deployment-vercel';
import { getApp } from '../shared/app';

// Vercel edge config — runs close to users with sub-ms cold starts
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'cdg1'],
};

// Pre-warm: start app init before the first request arrives
const appPromise = getApp();

/**
 * Vercel edge handler.
 * createVercelHandler(app) returns (req: Request) => Promise<Response>.
 * We wrap it in an async function so we can await app init lazily.
 */
export default async function handler(request: Request): Promise<Response> {
  const app = await appPromise;
  return createVercelHandler(app)(request);
}
