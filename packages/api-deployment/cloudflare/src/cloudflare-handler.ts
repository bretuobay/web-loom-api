/**
 * Cloudflare Workers deployment handler for Web Loom API Framework
 */
import type {
  WebLoomApp,
  CloudflareHandlerOptions,
  CloudflareEnv,
  ExecutionContext,
  CloudflareFetchHandler,
  KVNamespace,
  D1Database,
} from './types';

/**
 * Create a Cloudflare Workers-compatible fetch handler from a Web Loom app.
 *
 * Returns a function matching the Workers fetch handler signature:
 * `(request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>`
 *
 * @param app - Web Loom application instance
 * @param options - Cloudflare-specific handler options
 * @returns Workers-compatible fetch handler
 *
 * @example
 * ```ts
 * import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
 * import { app } from './app';
 *
 * export default {
 *   fetch: createCloudflareHandler(app, {
 *     kvNamespace: 'CACHE',
 *     d1Binding: 'DB',
 *   }),
 * };
 * ```
 */
export function createCloudflareHandler(
  app: WebLoomApp,
  options: CloudflareHandlerOptions = {},
): CloudflareFetchHandler {
  const { kvNamespace, d1Binding, durableObjectNamespace, aiBinding } = options;

  return async (
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<Response> => {
    try {
      // Enrich request headers with Cloudflare context
      const enrichedHeaders = new Headers(request.headers);
      enrichedHeaders.set('x-cf-worker', 'true');


      // Map KV namespace binding if configured
      if (kvNamespace && env[kvNamespace]) {
        enrichedHeaders.set('x-cf-kv-namespace', kvNamespace);
      }

      // Map D1 binding if configured
      if (d1Binding && env[d1Binding]) {
        enrichedHeaders.set('x-cf-d1-binding', d1Binding);
      }

      // Map Durable Object namespace if configured
      if (durableObjectNamespace && env[durableObjectNamespace]) {
        enrichedHeaders.set('x-cf-durable-object', durableObjectNamespace);
      }

      // Map AI binding if configured
      if (aiBinding && env[aiBinding]) {
        enrichedHeaders.set('x-cf-ai-binding', aiBinding);
      }

      const enrichedRequest = new Request(request.url, {
        method: request.method,
        headers: enrichedHeaders,
        body: request.body,
      });

      const response = await app.handleRequest(enrichedRequest);

      // Use waitUntil for any deferred work (logging, analytics, etc.)
      ctx.waitUntil(Promise.resolve());

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message,
            timestamp: new Date().toISOString(),
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };
}

/**
 * Resolve a KV namespace binding from the Cloudflare environment.
 */
export function resolveKVBinding(env: CloudflareEnv, bindingName: string): KVNamespace | null {
  const binding = env[bindingName];
  if (binding && typeof binding === 'object' && 'get' in binding && 'put' in binding) {
    return binding as unknown as KVNamespace;
  }
  return null;
}

/**
 * Resolve a D1 database binding from the Cloudflare environment.
 */
export function resolveD1Binding(env: CloudflareEnv, bindingName: string): D1Database | null {
  const binding = env[bindingName];
  if (binding && typeof binding === 'object' && 'prepare' in binding) {
    return binding as unknown as D1Database;
  }
  return null;
}
