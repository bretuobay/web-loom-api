import type { RequestContext, NextFunction } from '@web-loom/api-core';

/**
 * GET /health
 * Health check endpoint
 */
export async function GET(ctx: RequestContext, next: NextFunction): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
