import type { MiddlewareHandler } from 'hono';
import type { AuthUser } from './types';

export interface ApiKeyAuthOptions {
  /**
   * Validate the key and return an `AuthUser` on success, or `null` on failure.
   * May be async.
   */
  validate: (key: string) => AuthUser | null | Promise<AuthUser | null>;
  /**
   * Header to read the key from (default: 'X-API-Key').
   * When using the default, `Authorization: Bearer <key>` is also accepted as a fallback.
   */
  header?: string;
}

/**
 * API-key authentication middleware.
 *
 * Reads the key from `X-API-Key` (default) or a custom header, calls
 * `options.validate()`, and sets `c.var.user` on success.
 */
export function apiKeyAuth(options: ApiKeyAuthOptions): MiddlewareHandler {
  const headerName = options.header ?? 'X-API-Key';

  return async (c, next) => {
    let key = c.req.header(headerName);

    // Accept `Authorization: Bearer <key>` as fallback when using the default header
    if (!key && headerName === 'X-API-Key') {
      const auth = c.req.header('Authorization');
      if (auth?.startsWith('Bearer ')) key = auth.slice(7).trim();
    }

    if (!key) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'API key required' } }, 401);
    }

    const user = await options.validate(key);

    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
    }

    c.set('user', user);
    await next();
  };
}
