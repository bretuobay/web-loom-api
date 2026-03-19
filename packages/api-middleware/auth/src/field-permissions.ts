/**
 * @deprecated Field-level permissions are not part of the current auth-middleware spec.
 *
 * This file is intentionally empty. The old adapter-based `fieldPermissions` middleware
 * has been removed. Implement field filtering as a post-processing step in your route
 * handlers using Zod `.pick()` / `.omit()` on the `selectSchema` from `defineModel()`.
 */

export {};
