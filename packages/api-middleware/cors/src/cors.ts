/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing for the Web Loom API Framework.
 * Processes preflight OPTIONS requests and adds CORS headers to responses.
 *
 * @example
 * ```typescript
 * import { cors } from '@web-loom/api-middleware-cors';
 *
 * // Permissive (development)
 * app.use(cors());
 *
 * // Restrictive (production)
 * app.use(cors({
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   credentials: true,
 *   maxAge: 86400,
 * }));
 * ```
 *
 * **Requirements:** 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type { CorsOptions, CorsOrigin, OriginFunction } from './types';

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * Resolve whether a given origin is allowed by the configured origin option.
 *
 * @returns The allowed origin string to reflect, or null if disallowed.
 */
async function resolveOrigin(
  requestOrigin: string | null,
  option: CorsOrigin
): Promise<string | null> {
  if (!requestOrigin) return null;

  if (option === '*') return '*';

  if (typeof option === 'string') {
    return option === requestOrigin ? requestOrigin : null;
  }

  if (option instanceof RegExp) {
    return option.test(requestOrigin) ? requestOrigin : null;
  }

  if (Array.isArray(option)) {
    for (const entry of option) {
      if (typeof entry === 'string' && entry === requestOrigin) return requestOrigin;
      if (entry instanceof RegExp && entry.test(requestOrigin)) return requestOrigin;
    }
    return null;
  }

  if (typeof option === 'function') {
    const allowed = await (option as OriginFunction)(requestOrigin);
    return allowed ? requestOrigin : null;
  }

  return null;
}

/**
 * Create CORS middleware.
 *
 * Returns a middleware function that handles preflight OPTIONS requests
 * and attaches CORS headers to all responses.
 *
 * @param options - Optional CORS configuration
 * @returns Middleware function
 */
export function cors(
  options: CorsOptions = {}
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const {
    origin: originOption = '*',
    methods = DEFAULT_METHODS,
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge,
    preflightContinue = false,
  } = options;

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const requestOrigin = ctx.request.headers.get('Origin');
    let resolvedOrigin = await resolveOrigin(requestOrigin, originOption);

    // When credentials are enabled, never send wildcard - reflect the actual origin
    if (credentials && resolvedOrigin === '*' && requestOrigin) {
      resolvedOrigin = requestOrigin;
    }

    // If origin is not allowed, skip CORS headers entirely (Req 11.4)
    if (requestOrigin && !resolvedOrigin) {
      return next();
    }

    const isPreflight =
      ctx.request.method === 'OPTIONS' && ctx.request.headers.has('Access-Control-Request-Method');

    if (isPreflight) {
      return handlePreflight(ctx, next, {
        resolvedOrigin,
        methods,
        allowedHeaders,
        credentials,
        maxAge,
        preflightContinue,
      });
    }

    // Actual request - run downstream, then append CORS headers
    const response = await next();
    return appendCorsHeaders(response, {
      resolvedOrigin,
      credentials,
      exposedHeaders,
    });
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PreflightParams {
  resolvedOrigin: string | null;
  methods: string[];
  allowedHeaders: string[] | undefined;
  credentials: boolean;
  maxAge: number | undefined;
  preflightContinue: boolean;
}

function handlePreflight(
  ctx: RequestContext,
  next: NextFunction,
  params: PreflightParams
): Promise<Response> | Response {
  const headers = new Headers();

  setOriginHeader(headers, params.resolvedOrigin, params.credentials);
  headers.set('Access-Control-Allow-Methods', params.methods.join(', '));

  // Reflect requested headers if none explicitly configured
  const reqHeaders = params.allowedHeaders
    ? params.allowedHeaders.join(', ')
    : (ctx.request.headers.get('Access-Control-Request-Headers') ?? '');
  if (reqHeaders) {
    headers.set('Access-Control-Allow-Headers', reqHeaders);
  }

  if (params.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (params.maxAge !== undefined) {
    headers.set('Access-Control-Max-Age', String(params.maxAge));
  }

  headers.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

  if (params.preflightContinue) {
    return next();
  }

  headers.set('Content-Length', '0');
  return new Response(null, { status: 204, headers });
}

interface ActualParams {
  resolvedOrigin: string | null;
  credentials: boolean;
  exposedHeaders: string[] | undefined;
}

function appendCorsHeaders(response: Response, params: ActualParams): Response {
  const headers = new Headers(response.headers);

  setOriginHeader(headers, params.resolvedOrigin, params.credentials);

  if (params.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (params.exposedHeaders?.length) {
    headers.set('Access-Control-Expose-Headers', params.exposedHeaders.join(', '));
  }

  const existingVary = headers.get('Vary');
  if (!existingVary?.includes('Origin')) {
    headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Set the Access-Control-Allow-Origin header.
 * When credentials are enabled, never send '*' - reflect the actual origin instead.
 */
function setOriginHeader(
  headers: Headers,
  resolvedOrigin: string | null,
  credentials: boolean
): void {
  if (!resolvedOrigin) return;

  if (credentials && resolvedOrigin === '*') {
    // Cannot use wildcard with credentials; this should not happen since
    // the middleware already reflects the request origin, but guard here.
    return;
  }

  headers.set('Access-Control-Allow-Origin', resolvedOrigin);
}
