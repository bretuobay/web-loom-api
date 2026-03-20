/**
 * Full-Stack Example — Auth Middleware
 *
 * Re-exports composed auth strategies for use in route files.
 * No `defineMiddleware` — just direct Hono-compatible middleware from
 * @web-loom/api-middleware-auth.
 *
 * Usage:
 *   routes.get('/admin', authenticate, adminOnly, handler)
 */
import { jwtAuth, apiKeyAuth, composeAuth, requireRole } from '@web-loom/api-middleware-auth';

/**
 * Accepts either a JWT Bearer token or an X-API-Key header.
 * Sets c.var.user on success.
 */
export const authenticate = composeAuth(
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  apiKeyAuth({ header: 'X-API-Key' })
);

/** Requires the "admin" role. Must be used after `authenticate`. */
export const adminOnly = requireRole('admin');

/** Requires "moderator" or "admin" role. */
export const moderatorOrAdmin = requireRole('moderator', 'admin');
