import type { HTTPMethod } from '@web-loom/api-shared';

// Generic handler/middleware types used for route registry introspection.
// In the framework core these are opaque; the actual Hono handlers are
// registered directly on the Hono instance, not through the registry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (context: any) => Promise<Response> | Response;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Middleware = (context: any, next: () => Promise<void | Response>) => Promise<void | Response> | void;

/**
 * Route definition for the route registry
 */
export interface RouteDefinition {
  /** URL path pattern (e.g., /users/:id) */
  path: string;
  
  /** HTTP method */
  method: HTTPMethod;
  
  /** Route handler function */
  handler: RouteHandler;
  
  /** Optional validation schemas */
  validation?: RouteValidation;
  
  /** Route-specific middleware */
  middleware?: Middleware[];
  
  /** Authentication requirements */
  auth?: AuthRequirement;
  
  /** Rate limiting configuration */
  rateLimit?: RouteRateLimitConfig;
  
  /** Caching configuration */
  cache?: CacheConfig;
  
  /** Route metadata for documentation */
  metadata?: RouteMetadata;
}

/**
 * Validation schemas for different parts of the request
 */
export interface RouteValidation {
  /** Request body validation schema */
  body?: unknown;
  
  /** Query parameters validation schema */
  query?: unknown;
  
  /** Path parameters validation schema */
  params?: unknown;
  
  /** Request headers validation schema */
  headers?: unknown;
}

/**
 * Authentication requirements for a route
 */
export interface AuthRequirement {
  /** Whether authentication is required */
  required: boolean;
  
  /** Required roles/permissions */
  roles?: string[];
  
  /** Required scopes */
  scopes?: string[];
}

/**
 * Rate limiting configuration for a specific route
 */
export interface RouteRateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  
  /** Time window in milliseconds */
  window: number;
  
  /** Custom identifier function */
  keyGenerator?: (context: unknown) => string;
}

/**
 * Caching configuration
 */
export interface CacheConfig {
  /** Cache TTL in seconds */
  ttl: number;
  
  /** Cache key generator */
  keyGenerator?: (context: unknown) => string;
  
  /** Whether to cache per user */
  perUser?: boolean;
}

/**
 * Route metadata for documentation and introspection
 */
export interface RouteMetadata {
  /** Human-readable description */
  description?: string;
  
  /** Tags for grouping routes */
  tags?: string[];
  
  /** Whether route is deprecated */
  deprecated?: boolean;
  
  /** API version */
  version?: string;
  
  /** Response definitions */
  responses?: ResponseDefinition[];
}

/**
 * Response definition for documentation
 */
export interface ResponseDefinition {
  /** HTTP status code */
  status: number;
  
  /** Response description */
  description: string;
  
  /** Response schema */
  schema?: unknown;
}

/**
 * Result of matching a route
 */
export interface RouteMatch {
  /** Matched route definition */
  route: RouteDefinition;
  
  /** Extracted path parameters */
  params: Record<string, string>;
}
