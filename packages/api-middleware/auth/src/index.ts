/**
 * @web-loom/api-middleware-auth
 *
 * Authentication and authorization middleware for Web Loom API Framework.
 * Provides session auth, API key auth, RBAC, field-level permissions,
 * security headers, and audit logging.
 */

// Authentication middleware
export { sessionAuth } from './session-auth';
export { apiKeyAuth } from './api-key-auth';

// Authorization middleware
export { requireRoles, requirePermissions, resolveRoles } from './rbac';
export { fieldPermissions } from './field-permissions';

// Security headers middleware
export { securityHeaders } from './security-headers';
export type { SecurityHeadersOptions } from './security-headers';

// Audit logging
export { createAuditLogger, AuditLogger } from './audit-logger';
export type {
  AuditEventType,
  AuditLogEntry,
  AuditOutputHandler,
  AuditLoggerOptions,
  AuthAttemptParams,
  AuthFailureParams,
  AccessDeniedParams,
  DataModificationParams,
  ApiKeyOperationParams,
} from './audit-logger';

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
