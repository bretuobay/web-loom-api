/**
 * Auth Middleware Types
 *
 * Type definitions for authentication and authorization middleware.
 */

import type { User } from '@web-loom/api-core';

// ---------------------------------------------------------------------------
// Authentication Types
// ---------------------------------------------------------------------------

/** Options for session authentication middleware */
export interface SessionAuthOptions {
  /** If true, unauthenticated requests pass through without error (default: false) */
  optional?: boolean | undefined;
  /** Custom header name for the session token (default: 'Authorization') */
  headerName?: string | undefined;
  /** Custom token prefix (default: 'Bearer') */
  tokenPrefix?: string | undefined;
}

/** Options for API key authentication middleware */
export interface ApiKeyAuthOptions {
  /** If true, unauthenticated requests pass through without error (default: false) */
  optional?: boolean | undefined;
  /** Custom header name (default: 'Authorization') */
  headerName?: string | undefined;
  /** Custom token prefix (default: 'ApiKey') */
  tokenPrefix?: string | undefined;
  /** Required scopes for the API key */
  requiredScopes?: string[] | undefined;
}

// ---------------------------------------------------------------------------
// Authorization Types
// ---------------------------------------------------------------------------

/** Configuration for role hierarchy */
export interface RoleHierarchy {
  [role: string]: string[];
}

/** Options for role-based access control */
export interface RbacOptions {
  /** Role hierarchy mapping (role -> inherited roles) */
  hierarchy?: RoleHierarchy | undefined;
}

/** Field permission rule */
export interface FieldPermissionRule {
  /** Roles that can read this field */
  readable?: string[] | undefined;
  /** Roles that can write this field */
  writable?: string[] | undefined;
}

/** Configuration for field-level permissions */
export interface FieldPermissionConfig {
  /** Map of field name to permission rules */
  fields: Record<string, FieldPermissionRule>;
  /** Role hierarchy for resolving inherited permissions */
  hierarchy?: RoleHierarchy | undefined;
}

// ---------------------------------------------------------------------------
// Authenticated User Context
// ---------------------------------------------------------------------------

/** Extended user context attached to RequestContext by auth middleware */
export interface AuthenticatedUser extends User {
  /** API key scopes (only set for API key auth) */
  scopes?: string[] | undefined;
  /** Authentication method used */
  authMethod?: 'session' | 'apikey' | undefined;
}
