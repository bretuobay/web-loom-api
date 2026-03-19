// Shared TypeScript types and interfaces

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Framework-agnostic request context passed through middleware.
 * Compatible with the Web Loom middleware pipeline.
 */
export interface RequestContext {
  /** The raw Web Fetch API Request */
  request: Request;
  /** Path parameters extracted from the URL pattern */
  params?: Record<string, string>;
  /** Parsed query string parameters */
  query?: Record<string, string>;
  /** Parsed request body */
  body?: unknown;
  /** Authenticated user, if available */
  user?: unknown;
  /** Per-request metadata store for middleware communication */
  metadata: Map<string, unknown>;
}

/**
 * Next function in the middleware chain.
 * Returns the downstream Response.
 */
export type NextFunction = () => Promise<Response>;

// ============================================================================
// HTTP Types
// ============================================================================

/**
 * HTTP methods supported by the framework
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Common HTTP status codes used in REST APIs
 */
export type HTTPStatusCode =
  // Success
  | 200 // OK
  | 201 // Created
  | 204 // No Content
  // Client Errors
  | 400 // Bad Request
  | 401 // Unauthorized
  | 403 // Forbidden
  | 404 // Not Found
  | 409 // Conflict
  | 422 // Unprocessable Entity
  | 429 // Too Many Requests
  // Server Errors
  | 500 // Internal Server Error
  | 503; // Service Unavailable

/**
 * HTTP status code constants for easier usage
 */
export const HTTPStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes all properties of an object type visible in IDE tooltips
 * Useful for flattening intersection types
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Makes all properties of an object type optional recursively
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Makes all properties of an object type readonly recursively
 */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [P in keyof T]: DeepReadonly<T[P]>;
    }
  : T;

/**
 * Requires at least one of the specified keys to be present
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Makes specified keys required
 */
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Makes specified keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extracts keys from T that have values assignable to U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Makes a type nullable
 */
export type Nullable<T> = T | null;

/**
 * Makes a type nullable or undefined
 */
export type Maybe<T> = T | null | undefined;

/**
 * Extracts the awaited type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Creates a union of all possible dot-notation paths in an object
 */
export type DotPath<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${Prefix}${K}` | DotPath<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Machine-readable error codes for consistent error handling
 */
export enum ErrorCode {
  // Validation Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization Errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Resource Errors (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Configuration Errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
}

/**
 * Validation error field details
 */
export interface ValidationErrorField {
  /** Field path (e.g., ["user", "email"]) */
  path: string[];
  /** Human-readable error message */
  message: string;
  /** Validation rule that failed */
  code: string;
  /** Invalid value (if safe to include) */
  value?: unknown;
}

/**
 * Validation error details structure
 */
export interface ValidationErrorDetails {
  /** Array of field-level validation errors */
  fields: ValidationErrorField[];
}

/**
 * Standard error response format
 * All errors follow this consistent JSON structure
 */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error context (e.g., validation details) */
    details?: unknown;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Correlation ID for tracing */
    requestId: string;
    /** Request path where error occurred */
    path?: string;
    /** Stack trace (only in development) */
    stack?: string;
  };
}

/**
 * Base error class for framework errors
 */
export class WebLoomError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: HTTPStatusCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WebLoomError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends WebLoomError {
  constructor(
    message: string,
    public readonly fields: ValidationErrorField[]
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, HTTPStatus.BAD_REQUEST, { fields });
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends WebLoomError {
  constructor(message: string, code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    super(message, code, HTTPStatus.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends WebLoomError {
  constructor(message: string, code: ErrorCode = ErrorCode.FORBIDDEN) {
    super(message, code, HTTPStatus.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends WebLoomError {
  constructor(
    message: string,
    public readonly resource?: string
  ) {
    super(message, ErrorCode.NOT_FOUND, HTTPStatus.NOT_FOUND, { resource });
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends WebLoomError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONFLICT) {
    super(message, code, HTTPStatus.CONFLICT);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends WebLoomError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, HTTPStatus.TOO_MANY_REQUESTS, { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error class
 */
export class InternalError extends WebLoomError {
  constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR) {
    super(message, code, HTTPStatus.INTERNAL_SERVER_ERROR);
    this.name = 'InternalError';
  }
}

/**
 * Database error class
 */
export class DatabaseError extends WebLoomError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, ErrorCode.DATABASE_ERROR, HTTPStatus.INTERNAL_SERVER_ERROR, {
      originalError: originalError?.message,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * Configuration error class
 */
export class ConfigurationError extends WebLoomError {
  constructor(message: string) {
    super(message, ErrorCode.CONFIGURATION_ERROR, HTTPStatus.INTERNAL_SERVER_ERROR);
    this.name = 'ConfigurationError';
  }
}
