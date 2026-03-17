/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Provides middleware for enforcing role and permission requirements
 * on routes, with support for hierarchical roles.
 *
 * @example
 * ```typescript
 * import { requireRoles, requirePermissions } from '@web-loom/api-middleware-auth';
 *
 * // Require admin role
 * app.use(requireRoles('admin'));
 *
 * // Require any of the listed roles
 * app.use(requireRoles('admin', 'moderator'));
 *
 * // With role hierarchy
 * app.use(requireRoles('moderator', { hierarchy: { admin: ['moderator', 'user'] } }));
 * ```
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type { AuthenticatedUser, RoleHierarchy, RbacOptions } from './types';

/**
 * Resolve all effective roles for a given role using the hierarchy.
 *
 * For example, if hierarchy is { admin: ['moderator'], moderator: ['user'] },
 * then resolveRoles('admin', hierarchy) returns ['admin', 'moderator', 'user'].
 */
export function resolveRoles(role: string, hierarchy: RoleHierarchy): Set<string> {
  const resolved = new Set<string>();
  const queue = [role];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (resolved.has(current)) continue;
    resolved.add(current);

    const inherited = hierarchy[current];
    if (inherited) {
      for (const r of inherited) {
        if (!resolved.has(r)) queue.push(r);
      }
    }
  }

  return resolved;
}

/**
 * Create middleware that requires the authenticated user to have at least
 * one of the specified roles.
 *
 * @param roles - One or more required roles (user needs at least one)
 * @param options - Optional RBAC configuration (e.g. role hierarchy)
 * @returns Middleware function
 */
export function requireRoles(
  ...args: [...string[], RbacOptions] | string[]
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  let roles: string[];
  let options: RbacOptions = {};

  // Last argument may be an options object
  const last = args[args.length - 1];
  if (last && typeof last === 'object' && !Array.isArray(last)) {
    options = last as RbacOptions;
    roles = args.slice(0, -1) as string[];
  } else {
    roles = args as string[];
  }

  const hierarchy = options.hierarchy ?? {};

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const user = ctx.user as AuthenticatedUser | undefined;

    if (!user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const userRole = user.role;
    if (!userRole) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'User has no assigned role',
          code: 'INSUFFICIENT_PERMISSIONS',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Resolve effective roles via hierarchy
    const effectiveRoles = resolveRoles(userRole, hierarchy);
    const hasRole = roles.some((r) => effectiveRoles.has(r));

    if (!hasRole) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `Required role: ${roles.join(' or ')}`,
          code: 'INSUFFICIENT_PERMISSIONS',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return next();
  };
}

/**
 * Create middleware that requires the authenticated user (via API key) to
 * have all of the specified permission scopes.
 *
 * @param permissions - Required permission scopes (all must be present)
 * @returns Middleware function
 */
export function requirePermissions(
  ...permissions: string[]
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const user = ctx.user as AuthenticatedUser | undefined;

    if (!user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const userScopes = user.scopes ?? [];
    const missing = permissions.filter((p) => !userScopes.includes(p));

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `Missing permissions: ${missing.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return next();
  };
}
