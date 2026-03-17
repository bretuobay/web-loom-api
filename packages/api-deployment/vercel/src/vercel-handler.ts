/**
 * Vercel deployment handler for Web Loom API Framework
 */
import type { WebLoomApp, VercelHandlerOptions, VercelEnvConfig } from './types';

/**
 * Load Vercel environment variables into a structured config.
 * Reads VERCEL_* env vars and optionally loads custom-prefixed vars.
 */
export function loadVercelEnv(prefix?: string): VercelEnvConfig {
  const env = process.env;

  const custom: Record<string, string> = {};
  if (prefix) {
    const normalizedPrefix = prefix.endsWith('_') ? prefix : `${prefix}_`;
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith(normalizedPrefix) && value !== undefined) {
        const shortKey = key.slice(normalizedPrefix.length);
        custom[shortKey] = value;
      }
    }
  }

  return {
    env: env['VERCEL_ENV'] ?? 'development',
    url: env['VERCEL_URL'] ?? 'localhost:3000',
    region: env['VERCEL_REGION'] ?? 'dev1',
    gitCommitSha: env['VERCEL_GIT_COMMIT_SHA'] ?? '',
    gitCommitRef: env['VERCEL_GIT_COMMIT_REF'] ?? '',
    custom,
  };
}

/**
 * Create a Vercel-compatible request handler from a Web Loom app instance.
 *
 * @param app - Web Loom application instance
 * @param options - Vercel handler configuration options
 * @returns A function compatible with Vercel's serverless/edge handler signature
 */
export function createVercelHandler(
  app: WebLoomApp,
  options: VercelHandlerOptions = {}
): (req: Request) => Promise<Response> {
  const {
    streaming = false,
    envPrefix,
  } = options;

  // Pre-load environment config
  const vercelEnv = loadVercelEnv(envPrefix);

  return async (req: Request): Promise<Response> => {
    try {
      // Enrich request headers with Vercel context
      const enrichedHeaders = new Headers(req.headers);
      enrichedHeaders.set('x-vercel-env', vercelEnv.env);
      enrichedHeaders.set('x-vercel-region', vercelEnv.region);

      const enrichedRequest = new Request(req.url, {
        method: req.method,
        headers: enrichedHeaders,
        body: req.body,
      });

      const response = await app.handle(enrichedRequest);

      if (streaming && response.body) {
        return createStreamingResponse(response);
      }

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
        }
      );
    }
  };
}

/**
 * Wrap a response for streaming delivery using TransformStream.
 */
export function createStreamingResponse(response: Response): Response {
  if (!response.body) {
    return response;
  }

  const { readable, writable } = new TransformStream();

  // Pipe the original body through the transform stream
  void response.body.pipeTo(writable);

  const headers = new Headers(response.headers);
  headers.set('Transfer-Encoding', 'chunked');

  return new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
