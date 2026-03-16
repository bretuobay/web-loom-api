/**
 * @web-loom/api-middleware-auth
 *
 * Authentication and authorization middleware for Web Loom API Framework.
 * Provides session auth, API key auth, RBAC, and field-level permissions.
 */

// Authentication middleware
export { sessionAuth } from './session-auth';
export { apiKeyAuth } from './api-key-auth';

// Authorization middleware
export { requireRoles, requirePermissions, resolveRoles } from './rbac';
export { fieldPermissions } from './field-permissions';

// Types
export type {
  SessionAuthOptions,
  ApiKeyAuthOptions,
  RoleHierarchy,
  RbacOptions,
  FieldPermissionRule,
  FieldPermissionConfig,
  AuthenticatedUser,
} from './types';
