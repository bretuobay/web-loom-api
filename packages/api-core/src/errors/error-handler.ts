/**
 * Error Handler
 *
 * Provides centralized error handling with consistent error response formatting,
 * request ID generation, and environment-aware error details.
 */

import {
  WebLoomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  DatabaseError,
  ErrorCode,
  HTTPStatus,
  type ErrorResponse,
  type HTTPStatusCode,
} from '@web-loom/api-shared';
/**
 * Environment mode for error handling
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Environment mode (affects error detail visibility) */
  environment?: Environment;
  /** Whether to include stack traces in responses */
  includeStackTrace?: boolean;
  /** Custom error logger function */
  logger?: (error: Error, context: ErrorContext) => void;
}

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  /** Request ID for tracing */
  requestId: string;
  /** Request path */
  path: string;
  /** HTTP method */
  method: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Extract error context from a standard Web API Request object.
 */
export function extractErrorContext(request: Request, requestId?: string): ErrorContext {
  const url = new URL(request.url);

  return {
    requestId: requestId || generateRequestId(),
    path: url.pathname,
    method: request.method,
  };
}

/**
 * Format error as ErrorResponse
 */
export function formatErrorResponse(
  error: Error,
  context: ErrorContext,
  config: ErrorHandlerConfig = {}
): ErrorResponse {
  const environment = config.environment || 'production';
  const includeStackTrace = config.includeStackTrace ?? environment === 'development';

  // Handle WebLoomError instances
  if (error instanceof WebLoomError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        path: context.path,
        ...(includeStackTrace && { stack: error.stack }),
      },
    };
  }

  // Handle unknown errors
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: environment === 'production' ? 'An unexpected error occurred' : error.message,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      path: context.path,
      ...(includeStackTrace && { stack: error.stack }),
    },
  };
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: Error): HTTPStatusCode {
  if (error instanceof WebLoomError) {
    return error.statusCode;
  }
  return HTTPStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Default error logger
 */
function defaultLogger(error: Error, context: ErrorContext): void {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  };

  if (error instanceof WebLoomError && error.statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logData, null, 2));
  } else if (error instanceof WebLoomError && error.statusCode >= 400) {
    console.warn('[WARN]', JSON.stringify(logData, null, 2));
  } else {
    console.error('[ERROR]', JSON.stringify(logData, null, 2));
  }
}

/**
 * Create a standalone error handler function for use outside Hono.
 *
 * For the Hono `onError` hook, use `formatErrorResponse` and `getStatusCode`
 * directly in `createApp()`.
 */
export function createErrorHandler(config: ErrorHandlerConfig = {}) {
  const log = config.logger || defaultLogger;

  return async (error: unknown, request: Request): Promise<Response> => {
    const requestId = generateRequestId();
    const context = extractErrorContext(request, requestId);

    if (error instanceof Error) {
      log(error, context);
    }

    const err = error instanceof Error ? error : new Error(String(error));
    const body = formatErrorResponse(err, context, config);
    const statusCode = getStatusCode(err);

    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });
  };
}

/**
 * Export all error classes for convenience
 */
export {
  WebLoomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  DatabaseError,
  ErrorCode,
  HTTPStatus,
};

export type { ErrorResponse };
