/**
 * Session Authentication Middleware
 *
 * Validates session tokens from the Authorization header using the AuthAdapter.
 * Attaches authenticated user and session to the RequestContext.
 *
 * @example
 * ```typescript
 * import { sessionAuth } from '@web-loom/api-middleware-auth';
 *
 * // Required authentication
 * app.use(sessionAuth(authAdapter));
 *
 * // Optional authentication
 * app.use(sessionAuth(authAdapter, { optional: true }));
 * ```
 */

import type { AuthAdapter, RequestContext, NextFunction } from '@web-loom/api-core';
import type { SessionAuthOptions, AuthenticatedUser } from './types';

/**
 * Extract a token from the Authorization header.
 *
 * @param request - The incoming request
 * @param headerName - Header to read (default 'Authorization')
 * @param prefix - Expected prefix (default 'Bearer')
 * @returns The raw token string, or null if not present / malformed
 */
function extractToken(
  request: Request,
  headerName: string,
  prefix: string,
): string | null {
  const header = request.headers.get(headerName);
  if (!header) return null;

  if (!header.startsWith(`${prefix} `)) return null;

  const token = header.slice(prefix.length + 1).trim();
  return token.length > 0 ? token : null;
}

/**
 * Create session authentication middleware.
 *
 * Extracts a Bearer token from the Authorization header, validates it via
 * the AuthAdapter, and attaches the user + session to the request context.
 *
 * @param adapter - AuthAdapter instance for session validation
 * @param options - Optional configuration
 * @returns Middleware function
 */
export function sessionAuth(
  adapter: AuthAdapter,
  options: SessionAuthOptions = {},
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const {
    optional = false,
    headerName = 'Authorization',
    tokenPrefix = 'Bearer',
  } = options;

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const token = extractToken(ctx.request, headerName, tokenPrefix);

    if (!token) {
      if (optional) return next();

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Missing authentication token',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await adapter.validateSession(token);

    if (!result.valid || !result.user) {
      if (optional) return next();

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'INVALID_TOKEN',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Attach user and session to context
    const authedUser: AuthenticatedUser = {
      ...result.user,
      authMethod: 'session',
    };
    ctx.user = authedUser;
    ctx.session = result.session;

    return next();
  };
}
