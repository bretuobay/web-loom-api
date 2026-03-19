import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import type { AuthUser } from './types';

/** Minimal Lucia interface — use the real `Lucia` type when lucia is installed. */
export interface LuciaLike {
  validateSession(
    sessionId: string
  ): Promise<{ session: { id: string } | null; user: Record<string, unknown> | null }>;
  createSessionCookie(sessionId: string): {
    name: string;
    value: string;
    attributes: Record<string, unknown>;
  };
  createBlankSessionCookie(): { name: string; value: string; attributes: Record<string, unknown> };
}

export interface SessionAuthOptions {
  lucia: LuciaLike;
  /** Cookie name (default: 'session') */
  cookieName?: string;
  /** Map a Lucia user object to `AuthUser` */
  getUser?: (luciaUser: Record<string, unknown>) => AuthUser;
}

const defaultGetUser = (u: Record<string, unknown>): AuthUser => ({
  id: String(u['id'] ?? ''),
  ...(u['email'] !== undefined && { email: u['email'] as string }),
  ...(u['role'] !== undefined && { role: u['role'] as string }),
});

/**
 * Lucia session cookie authentication middleware.
 *
 * Reads the session cookie, validates it with Lucia, refreshes it, and
 * sets `c.var.user` on success.
 */
export function sessionAuth(options: SessionAuthOptions): MiddlewareHandler {
  const cookieName = options.cookieName ?? 'session';
  const getUser = options.getUser ?? defaultGetUser;

  return async (c, next) => {
    const sessionId = getCookie(c, cookieName);

    if (!sessionId) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, 401);
    }

    const { session, user } = await options.lucia.validateSession(sessionId);

    if (!session || !user) {
      // Invalidate stale cookie
      const blank = options.lucia.createBlankSessionCookie();
      deleteCookie(c, blank.name);
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } },
        401
      );
    }

    // Refresh session cookie
    const sessionCookie = options.lucia.createSessionCookie(session.id);
    setCookie(
      c,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes as Parameters<typeof setCookie>[3]
    );

    c.set('user', getUser(user));
    await next();
    return;
  };
}
