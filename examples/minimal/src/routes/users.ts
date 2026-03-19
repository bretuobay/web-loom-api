/**
 * Minimal Example — User Routes
 *
 * Custom routes that extend the auto-generated CRUD. Shows sign-up, login
 * with JWT, and protected endpoints using jwtAuth middleware.
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
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { usersTable } from '../models/user';

const routes = defineRoutes();

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// POST /users — Sign up (public)
routes.post('/users', validate('json', createUserSchema), async (c) => {
  const { name, email, password } = c.req.valid('json');

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await c.var.db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  return c.json({ user }, 201);
});

// POST /auth/login — Exchange credentials for a JWT
routes.post('/auth/login', validate('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const [user] = await c.var.db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return c.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// GET /users/:id — Public profile
routes.get('/users/:id', async (c) => {
  const [user] = await c.var.db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, c.req.param('id')));

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

// GET /users — List all users (JWT required)
routes.get('/users', jwtAuth({ secret: process.env.JWT_SECRET! }), async (c) => {
  const users = await c.var.db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt)
    .limit(50);

  return c.json({ users });
});

// PUT /users/:id — Update own profile (JWT required)
routes.put(
  '/users/:id',
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

// DELETE /users/:id — Delete own account (JWT required)
routes.delete('/users/:id', jwtAuth({ secret: process.env.JWT_SECRET! }), async (c) => {
  const userId = c.req.param('id');
  if (c.var.user?.id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await c.var.db.delete(usersTable).where(eq(usersTable.id, userId));
  return c.json({ success: true });
});

export default routes;
