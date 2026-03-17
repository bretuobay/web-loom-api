/**
 * Full-Stack Example — Auth Middleware
 *
 * Sets up authentication strategies: session-based auth for browsers
 * and API key auth for programmatic access. Also demonstrates role-based
 * access control (RBAC).
 */
import { defineMiddleware } from "@web-loom/api-core";
import {
  sessionAuth,
  apiKeyAuth,
  requireRole,
} from "@web-loom/api-middleware-auth";

/**
 * Combined auth middleware — accepts either a session cookie or an API key.
 * Attaches the authenticated user to `ctx.user`.
 */
export const authenticate = defineMiddleware(
  sessionAuth({ cookieName: "session" }),
  apiKeyAuth({ header: "X-API-Key" }),
);

/**
 * Require the "admin" role. Must be used after `authenticate`.
 *
 * Usage:
 *   middleware: [authenticate, adminOnly]
 */
export const adminOnly = requireRole("admin");

/**
 * Require the "moderator" or "admin" role.
 */
export const moderatorOrAdmin = requireRole("moderator", "admin");

/**
 * Owner-only middleware — ensures the authenticated user owns the resource.
 * Compares `ctx.user.id` against the resource's `userId` field.
 *
 * Usage:
 *   middleware: [authenticate, ownerOnly("userId")]
 */
export const ownerOnly = (field: string = "userId") =>
  defineMiddleware(async (ctx, next) => {
    const resource = ctx.resource;
    if (!resource || resource[field] !== ctx.user?.id) {
      return ctx.json({ error: "Forbidden" }, 403);
    }
    return next();
  });
