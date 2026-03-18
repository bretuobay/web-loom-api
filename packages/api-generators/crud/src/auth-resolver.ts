import type { MiddlewareHandler } from 'hono';
import { requireRole } from '@web-loom/api-middleware-auth';
import type { CrudOperationOptions } from '@web-loom/api-core';

/** Requires that upstream auth middleware has set c.var.user */
const authenticate: MiddlewareHandler = async (c, next) => {
  if (!c.var.user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }
  await next();
  return;
};

export function resolveAuthMiddleware(opts: CrudOperationOptions | undefined): MiddlewareHandler[] {
  if (!opts?.auth) return [];
  if (opts.auth === true) return [authenticate];
  return [authenticate, requireRole(opts.auth as string)];
}
