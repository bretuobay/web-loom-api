import { verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import type { AuthUser } from './types';

export interface JwtAuthOptions {
  /** Signing secret or CryptoKey */
  secret: string | CryptoKey;
  /** Algorithm (default: 'HS256') */
  algorithm?: string;
  /** Expected `iss` claim — rejected if present and mismatched */
  issuer?: string;
  /** Expected `aud` claim(s) */
  audience?: string | string[];
  /**
   * When `true`, a missing or invalid token sets `c.var.user = undefined`
   * and calls `next()` instead of returning 401.
   */
  optional?: boolean;
  /** Map the raw JWT payload to `AuthUser`. Defaults to reading sub/id/email/role/permissions. */
  getUser?: (payload: Record<string, unknown>) => AuthUser | Promise<AuthUser>;
}

const defaultGetUser = (payload: Record<string, unknown>): AuthUser => ({
  id: String(payload.sub ?? payload.id ?? ''),
  email: payload.email as string | undefined,
  role: payload.role as string | undefined,
  permissions: payload.permissions as string[] | undefined,
});

/**
 * JWT Bearer-token authentication middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT, and
 * sets `c.var.user` on success.
 */
export function jwtAuth(options: JwtAuthOptions): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      if (options.optional) {
        await next();
        return;
      }
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } },
        401,
      );
    }

    try {
      const payload = await verify(token, options.secret, options.algorithm ?? 'HS256');

      if (options.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid issuer');
      }

      if (options.audience) {
        const expected = Array.isArray(options.audience) ? options.audience : [options.audience];
        const actual = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!expected.some((a) => actual.includes(a))) {
          throw new Error('Invalid audience');
        }
      }

      const getUser = options.getUser ?? defaultGetUser;
      c.set('user', await getUser(payload as Record<string, unknown>));
      await next();
    } catch {
      if (options.optional) {
        c.set('user', undefined);
        await next();
        return;
      }
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        401,
      );
    }
  };
}
