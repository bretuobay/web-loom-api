/**
 * Full-Stack Example — Auth Routes
 *
 * Dedicated auth namespace mounted at `/api/auth`.
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { usersTable } from '../models/user';
import { authenticate } from '../middleware/auth';

const routes = defineRoutes();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

routes.post('/login', validate('json', loginSchema), async (c) => {
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

routes.post('/logout', authenticate, async (c) => {
  return c.json({ success: true });
});

export default routes;
