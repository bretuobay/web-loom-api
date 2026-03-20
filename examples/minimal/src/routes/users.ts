/**
 * Minimal Example — User Routes
 *
 * Custom routes that extend the auto-generated CRUD.
 *
 * The generated CRUD endpoints live at `/api/users`. This file adds
 * bespoke user-specific routes under the same resource namespace without
 * conflicting with the generated collection/item handlers.
 *
 * Pattern:
 *  - defineRoutes() returns a typed Hono instance with c.var.db available.
 *  - validate('json', schema) validates the request body and types c.req.valid('json').
 *  - jwtAuth() middleware validates Bearer tokens; sets c.var.user on success.
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { usersTable } from '../models/user';

const routes = defineRoutes();

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// GET /api/users/me — Authenticated profile shortcut
routes.get('/me', jwtAuth({ secret: process.env.JWT_SECRET! }), async (c) => {
  const [user] = await c.var.db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, c.var.user!.id));

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

// PATCH /api/users/:id/profile — Update own profile with tighter rules than CRUD
routes.patch(
  '/:id/profile',
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  validate('json', updateUserSchema),
  async (c) => {
    const userId = c.req.param('id');
    if (c.var.user?.id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updates = c.req.valid('json');
    const [updated] = await c.var.db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

    return c.json({ user: updated });
  }
);

export default routes;
