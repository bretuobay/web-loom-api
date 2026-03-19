/**
 * Full-Stack Example — User Routes
 *
 * Demonstrates authenticated routes, role-based access, and custom handlers
 * that extend the auto-generated CRUD.
 */
import { defineRoutes } from '@web-loom/api-core';
import { User } from '../models/user';
import { authenticate, adminOnly } from '../middleware/auth';

export default defineRoutes((router) => {
  // POST /api/users — Sign up (public)
  router.post('/api/users', {
    validation: {
      body: User.schema.pick('name', 'email', 'password'),
    },
    handler: async (ctx) => {
      const { name, email, password } = ctx.body;
      const hashedPassword = await ctx.auth.hashPassword(password);

      const user = await ctx.db.insert(User, {
        name,
        email,
        password: hashedPassword,
      });

      const session = await ctx.auth.createSession(user.id);
      ctx.setCookie('session', session.id, { httpOnly: true, secure: true });

      return ctx.json(
        { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
        201
      );
    },
  });

  // POST /api/auth/login — Log in
  router.post('/api/auth/login', {
    validation: {
      body: User.schema.pick('email', 'password'),
    },
    handler: async (ctx) => {
      const { email, password } = ctx.body;
      const user = await ctx.db.select(User).where('email', '=', email).first();

      if (!user || !(await ctx.auth.verifyPassword(user.password, password))) {
        return ctx.json({ error: 'Invalid credentials' }, 401);
      }

      const session = await ctx.auth.createSession(user.id);
      ctx.setCookie('session', session.id, { httpOnly: true, secure: true });

      return ctx.json({ user: { id: user.id, name: user.name, role: user.role } });
    },
  });

  // POST /api/auth/logout — Log out
  router.post('/api/auth/logout', {
    middleware: [authenticate],
    handler: async (ctx) => {
      await ctx.auth.invalidateSession(ctx.session.id);
      ctx.deleteCookie('session');
      return ctx.json({ success: true });
    },
  });

  // GET /api/users — Admin-only user list
  router.get('/api/users', {
    middleware: [authenticate, adminOnly],
    handler: async (ctx) => {
      const users = await ctx.db.select(User).orderBy('createdAt', 'desc').limit(50);

      return ctx.json({ users });
    },
  });

  // POST /api/users/:id/api-key — Generate an API key for the user
  router.post('/api/users/:id/api-key', {
    middleware: [authenticate],
    handler: async (ctx) => {
      if (ctx.user.id !== ctx.params.id) {
        return ctx.json({ error: 'Forbidden' }, 403);
      }

      const apiKey = await ctx.auth.createApiKey(ctx.user.id, ['read', 'write']);
      return ctx.json({ apiKey: apiKey.key });
    },
  });
});
