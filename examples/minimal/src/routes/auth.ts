/**
 * Minimal Example — Auth Routes
 *
 * Dedicated auth routes mounted at `/api/auth`.
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { usersTable } from '../models/user';

const routes = defineRoutes();

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

routes.post('/register', validate('json', registerSchema), async (c) => {
  const { name, email, password } = c.req.valid('json');

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await c.var.db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  return c.json({ user }, 201);
});

routes.post('/login', validate('json', loginSchema), async (c) => {
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

export default routes;
