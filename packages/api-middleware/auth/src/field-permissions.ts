/**
 * Field-Level Permission Middleware
 *
 * Filters response fields based on the authenticated user's role.
 * Supports role hierarchy for inherited permissions.
 *
 * @example
 * ```typescript
 * import { fieldPermissions } from '@web-loom/api-middleware-auth';
 *
 * app.use(fieldPermissions({
 *   fields: {
 *     email: { readable: ['admin', 'self'], writable: ['admin'] },
 *     ssn: { readable: ['admin'], writable: ['admin'] },
 *   },
 *   hierarchy: { admin: ['moderator', 'user'] },
 * }));
 * ```
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type { AuthenticatedUser, FieldPermissionConfig } from './types';
import { resolveRoles } from './rbac';

/**
 * Create middleware that filters response body fields based on the
 * authenticated user's role and the field permission configuration.
 *
 * The middleware wraps the downstream response: if the response body is JSON,
 * it strips fields the user's role is not allowed to read.
 *
 * @param config - Field permission configuration
 * @returns Middleware function
 */
export function fieldPermissions(
  config: FieldPermissionConfig,
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const hierarchy = config.hierarchy ?? {};

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const response = await next();

    const user = ctx.user as AuthenticatedUser | undefined;
    const userRole = user?.role;

    // Resolve effective roles
    const effectiveRoles = userRole ? resolveRoles(userRole, hierarchy) : new Set<string>();

    // Only filter JSON responses
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return response;
    }

    const filtered = filterFields(body, config.fields, effectiveRoles);

    return new Response(JSON.stringify(filtered), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * Recursively filter fields from a value based on permission rules.
 */
function filterFields(
  data: unknown,
  fields: FieldPermissionConfig['fields'],
  effectiveRoles: Set<string>,
): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => filterFields(item, fields, effectiveRoles));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const rule = fields[key];
      if (!rule || !rule.readable) {
        // No restriction on this field
        result[key] = value;
        continue;
      }

      // Check if user has any of the readable roles
      const canRead = rule.readable.some((r) => effectiveRoles.has(r));
      if (canRead) {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}
