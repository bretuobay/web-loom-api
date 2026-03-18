/**
 * @deprecated Use `requireRole` / `requirePermission` from `./require-role` instead.
 *
 * This module is retained only to preserve `resolveRoles`, which is a pure utility
 * with no framework dependencies. The `requireRoles` / `requirePermissions` functions
 * that depended on the old `RequestContext` adapter API have been removed.
 */

export type RoleHierarchy = Record<string, string[]>;

/**
 * Resolve all effective roles for a given role using the hierarchy.
 *
 * Pure utility — no framework dependency. Still exported for consumers that
 * build custom guards on top of `requireRole`.
 *
 * @example
 * const hierarchy = { admin: ['moderator', 'user'], moderator: ['user'] };
 * resolveRoles('admin', hierarchy); // Set { 'admin', 'moderator', 'user' }
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
