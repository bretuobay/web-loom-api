import type { MiddlewareHandler } from 'hono';

const STATE_MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfProtectionOptions {
  /**
   * Function that returns the expected CSRF token for the current request.
   * Typically reads it from the session.
   */
  getToken: (c: Parameters<MiddlewareHandler>[0]) => string | undefined | Promise<string | undefined>;
  /** Header to read the submitted token from (default: 'X-CSRF-Token') */
  headerName?: string;
}

/**
 * CSRF protection middleware.
 *
 * Passes GET/HEAD/OPTIONS through without checks. For state-mutating methods
 * (POST, PUT, PATCH, DELETE), reads the CSRF token from the request header
 * and compares it against the expected token from the session. Returns 403
 * if the token is missing or mismatched.
 */
export function csrfProtection(options: CsrfProtectionOptions): MiddlewareHandler {
  const headerName = options.headerName ?? 'X-CSRF-Token';

  return async (c, next) => {
    if (!STATE_MUTATING.has(c.req.method)) {
      await next();
      return;
    }

    const submitted = c.req.header(headerName);
    if (!submitted) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'CSRF token missing' } },
        403,
      );
    }

    const expected = await options.getToken(c);
    if (!expected || submitted !== expected) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'CSRF token invalid' } },
        403,
      );
    }

    await next();
  };
}
