import { Hono } from 'hono';
import type { WebLoomVariables } from '../types';

/**
 * Returns a typed Hono router pre-bound to WebLoomVariables.
 *
 * Use this as the default export of every route file so the router has access
 * to `c.var.db` and `c.var.email` without manual type annotations.
 *
 * @example
 * ```ts
 * // src/routes/users.ts
 * import { defineRoutes } from '@web-loom/api-core';
 *
 * const app = defineRoutes();
 *
 * app.get('/', async (c) => {
 *   const users = await c.var.db.select().from(usersTable);
 *   return c.json({ users });
 * });
 *
 * export default app;
 * ```
 */
export function defineRoutes(): Hono<{ Variables: WebLoomVariables }> {
  return new Hono<{ Variables: WebLoomVariables }>();
}
