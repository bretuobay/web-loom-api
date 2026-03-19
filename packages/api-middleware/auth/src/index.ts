/**
 * @web-loom/api-middleware-auth
 *
 * Authentication and authorization middleware for Web Loom API.
 * Built on Hono MiddlewareHandler — no adapter layer required.
 */

// Auth strategies
export { jwtAuth } from './jwt-auth';
export type { JwtAuthOptions } from './jwt-auth';

export { sessionAuth } from './session-auth';
export type { SessionAuthOptions, LuciaLike } from './session-auth';

export { apiKeyAuth } from './api-key-auth';
export type { ApiKeyAuthOptions } from './api-key-auth';

// Authorization guards
export { requireRole, requirePermission } from './require-role';

// Multi-strategy composition
export { composeAuth } from './compose-auth';

// CSRF protection
export { csrfProtection } from './csrf-protection';
export type { CsrfProtectionOptions } from './csrf-protection';

// Shared types
export type { AuthUser } from './types';
