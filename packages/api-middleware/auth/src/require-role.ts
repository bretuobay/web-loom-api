import type { MiddlewareHandler } from 'hono';

/**
 * Guard middleware: requires `c.var.user` to be set with the specified role.
 *
 * - Returns 401 if no user is authenticated.
 * - Returns 403 if the user's role does not match.
 */
export function requireRole(role: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.var.user;
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    }
    if (user.role !== role) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: `Requires role: ${role}` } },
        403,
      );
    }
    await next();
    return;
  };
}

/**
 * Guard middleware: requires `c.var.user` to have the specified permission.
 *
 * - Returns 401 if no user is authenticated.
 * - Returns 403 if the user lacks the permission.
 */
export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.var.user;
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    }
    if (!user.permissions?.includes(permission)) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: `Requires permission: ${permission}` } },
        403,
      );
    }
    await next();
    return;
  };
}
