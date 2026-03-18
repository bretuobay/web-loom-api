/**
 * @deprecated Audit logging is not part of the current auth-middleware spec.
 *
 * This file is intentionally empty. Implement structured audit logging by attaching
 * a Hono `onError` handler and route-level middleware that writes to your preferred
 * sink (stdout, a database table, a queue, etc.) after calling `next()`.
 */

export {};
