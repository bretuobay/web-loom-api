/**
 * Full-Stack Example — User Routes
 *
 * Sign-up, login (JWT), logout, user list (admin), and API-key generation.
 * Passwords are hashed with bcryptjs; tokens are signed with jose.
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { requireRole } from '@web-loom/api-middleware-auth';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { usersTable } from '../models/user';
import { authenticate } from '../middleware/auth';

const routes = defineRoutes();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// POST /users — Sign up (public)
routes.post('/users', validate('json', signupSchema), async (c) => {
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

// POST /auth/login — Exchange credentials for JWT
routes.post('/auth/login', validate('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const [user] = await c.var.db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return c.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /auth/logout — Invalidate session (stateless JWT: client discards token)
routes.post('/auth/logout', authenticate, async (c) => {
  // With stateless JWTs, logout is client-side. For session revocation,
  // add a token blocklist or use short-lived tokens + refresh tokens.
  return c.json({ success: true });
});

// GET /users — Admin-only user list
routes.get('/users', authenticate, requireRole('admin'), async (c) => {
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

// POST /users/:id/api-key — Generate API key for the requesting user
routes.post('/users/:id/api-key', authenticate, async (c) => {
  const userId = c.req.param('id');
  if (c.var.user?.id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const apiKey = `ak_${crypto.randomUUID().replace(/-/g, '')}`;
  await c.var.db.update(usersTable).set({ apiKey }).where(eq(usersTable.id, userId));

  return c.json({ apiKey });
});

export default routes;
