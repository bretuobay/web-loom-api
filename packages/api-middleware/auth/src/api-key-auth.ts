/**
 * API Key Authentication Middleware
 *
 * Validates API keys from the Authorization header using the AuthAdapter.
 * Attaches authenticated user info and scopes to the RequestContext.
 *
 * @example
 * ```typescript
 * import { apiKeyAuth } from '@web-loom/api-middleware-auth';
 *
 * // Basic API key auth
 * app.use(apiKeyAuth(authAdapter));
 *
 * // With required scopes
 * app.use(apiKeyAuth(authAdapter, { requiredScopes: ['read:users'] }));
 * ```
 */

import type { AuthAdapter, RequestContext, NextFunction } from '@web-loom/api-core';
import type { ApiKeyAuthOptions, AuthenticatedUser } from './types';

/**
 * Extract an API key from the Authorization header.
 */
function extractApiKey(
  request: Request,
  headerName: string,
  prefix: string,
): string | null {
  const header = request.headers.get(headerName);
  if (!header) return null;

  if (!header.startsWith(`${prefix} `)) return null;

  const key = header.slice(prefix.length + 1).trim();
  return key.length > 0 ? key : null;
}

/**
 * Create API key authentication middleware.
 *
 * Extracts an API key from the Authorization header (prefix "ApiKey"),
 * validates it via the AuthAdapter, and attaches user info + scopes to context.
 *
 * @param adapter - AuthAdapter instance for API key validation
 * @param options - Optional configuration
 * @returns Middleware function
 */
export function apiKeyAuth(
  adapter: AuthAdapter,
  options: ApiKeyAuthOptions = {},
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const {
    optional = false,
    headerName = 'Authorization',
    tokenPrefix = 'ApiKey',
    requiredScopes = [],
  } = options;

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const key = extractApiKey(ctx.request, headerName, tokenPrefix);

    if (!key) {
      if (optional) return next();

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Missing API key',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await adapter.validateApiKey(key);

    if (!result.valid || !result.userId) {
      if (optional) return next();

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or revoked API key',
          code: 'INVALID_TOKEN',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check required scopes
    if (requiredScopes.length > 0) {
      const keyScopes = result.scopes ?? [];
      const missing = requiredScopes.filter((s) => !keyScopes.includes(s));

      if (missing.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: `Missing required scopes: ${missing.join(', ')}`,
            code: 'INSUFFICIENT_PERMISSIONS',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Fetch user info and attach to context
    const user = await adapter.getUser(result.userId);

    const authedUser: AuthenticatedUser = {
      id: result.userId,
      email: user?.email ?? '',
      ...(user ?? {}),
      scopes: result.scopes,
      authMethod: 'apikey',
    };
    ctx.user = authedUser;

    return next();
  };
}
