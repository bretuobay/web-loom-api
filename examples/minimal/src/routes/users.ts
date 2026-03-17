/**
 * Minimal Example — User Routes
 *
 * Custom route definitions that extend or override the auto-generated CRUD.
 * Shows how to add authentication, custom handlers, and route-level config.
 */
import { defineRoutes } from "@web-loom/api-core";
import { sessionAuth } from "@web-loom/api-middleware-auth";
import { User } from "../models/user";

export default defineRoutes((router) => {
  // --- Public routes ---

  // POST /api/users — Create a new user (sign up)
  router.post("/api/users", {
    validation: {
      body: User.schema.pick("name", "email", "password"),
    },
    handler: async (ctx) => {
      const { name, email, password } = ctx.body;

      // Hash password before storing
      const hashedPassword = await ctx.auth.hashPassword(password);

      const user = await ctx.db.insert(User, {
        name,
        email,
        password: hashedPassword,
      });

      // Create a session for the new user
      const session = await ctx.auth.createSession(user.id);
      ctx.setCookie("session", session.id, { httpOnly: true, secure: true });

      return ctx.json({ user: { id: user.id, name: user.name, email: user.email } }, 201);
    },
  });

  // POST /api/auth/login — Log in with email and password
  router.post("/api/auth/login", {
    validation: {
      body: User.schema.pick("email", "password"),
    },
    handler: async (ctx) => {
      const { email, password } = ctx.body;

      const user = await ctx.db
        .select(User)
        .where("email", "=", email)
        .first();

      if (!user || !(await ctx.auth.verifyPassword(user.password, password))) {
        return ctx.json({ error: "Invalid credentials" }, 401);
      }

      const session = await ctx.auth.createSession(user.id);
      ctx.setCookie("session", session.id, { httpOnly: true, secure: true });

      return ctx.json({ user: { id: user.id, name: user.name, email: user.email } });
    },
  });

  // GET /api/users/:id — Public profile
  router.get("/api/users/:id", {
    handler: async (ctx) => {
      const user = await ctx.db
        .select(User)
        .where("id", "=", ctx.params.id)
        .first();

      if (!user) return ctx.json({ error: "User not found" }, 404);

      return ctx.json({ user: { id: user.id, name: user.name } });
    },
  });

  // --- Protected routes (require session auth) ---

  // GET /api/users — List all users (authenticated)
  router.get("/api/users", {
    middleware: [sessionAuth()],
    handler: async (ctx) => {
      const users = await ctx.db
        .select(User)
        .orderBy("createdAt", "desc")
        .limit(50);

      return ctx.json({ users });
    },
  });

  // PUT /api/users/:id — Update user (authenticated, own profile only)
  router.put("/api/users/:id", {
    middleware: [sessionAuth()],
    validation: {
      body: User.schema.pick("name", "email").partial(),
    },
    handler: async (ctx) => {
      if (ctx.user.id !== ctx.params.id) {
        return ctx.json({ error: "Forbidden" }, 403);
      }

      const updated = await ctx.db.update(User, ctx.params.id, ctx.body);
      return ctx.json({ user: updated });
    },
  });

  // DELETE /api/users/:id — Delete user (authenticated, own profile only)
  router.delete("/api/users/:id", {
    middleware: [sessionAuth()],
    handler: async (ctx) => {
      if (ctx.user.id !== ctx.params.id) {
        return ctx.json({ error: "Forbidden" }, 403);
      }

      await ctx.db.delete(User, ctx.params.id);
      return ctx.json({ success: true }, 204);
    },
  });
});
