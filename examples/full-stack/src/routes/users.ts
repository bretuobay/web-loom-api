/**
 * Full-Stack Example — User Routes
 *
 * User-management routes mounted at `/api/users`.
 *
 * CRUD for the base resource is generated automatically. This file adds
 * bespoke workflows that do not fit the generic CRUD handlers.
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { requireRole } from '@web-loom/api-middleware-auth';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { usersTable } from '../models/user';
import { authenticate } from '../middleware/auth';

const routes = defineRoutes();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /api/users/signup — Sign up (public)
routes.post('/signup', validate('json', signupSchema), async (c) => {
  const { name, email, password } = c.req.valid('json');
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await c.var.db.insert(usersTable).values({ name, email, passwordHash }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
  });

  return c.json({ user }, 201);
});

// GET /api/users/admin-list — Admin-only list with custom projection
routes.get('/admin-list', authenticate, requireRole('admin'), async (c) => {
  const users = await c.var.db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(isNull(usersTable.deletedAt))
    .orderBy(usersTable.createdAt)
    .limit(50);

  return c.json({ users });
});

// POST /api/users/:id/api-key — Generate API key for the requesting user
routes.post('/:id/api-key', authenticate, async (c) => {
  const userId = c.req.param('id');
  if (c.var.user?.id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const apiKey = `ak_${crypto.randomUUID().replace(/-/g, '')}`;
  await c.var.db.update(usersTable).set({ apiKey }).where(eq(usersTable.id, userId));

  return c.json({ apiKey });
});

export default routes;
