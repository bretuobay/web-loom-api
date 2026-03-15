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
import type { RequestContext, NextFunction } from '../interfaces';

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
 * Extract error context from request
 */
export function extractErrorContext(ctx: RequestContext): ErrorContext {
  const url = new URL(ctx.request.url);
  
  return {
    requestId: ctx.metadata.get('requestId') as string || generateRequestId(),
    path: url.pathname,
    method: ctx.request.method,
    userId: ctx.metadata.get('userId') as string,
    metadata: Object.fromEntries(ctx.metadata.entries()),
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
  const includeStackTrace = config.includeStackTrace ?? (environment === 'development');

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
      message: environment === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
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
 * Create error handler middleware
 * 
 * This middleware catches all errors thrown in route handlers and
 * formats them into consistent ErrorResponse objects.
 * 
 * @example
 * ```typescript
 * const errorHandler = createErrorHandler({
 *   environment: 'production',
 *   includeStackTrace: false,
 * });
 * 
 * apiFramework.registerMiddleware(errorHandler);
 * ```
 */
export function createErrorHandler(config: ErrorHandlerConfig = {}) {
  const logger = config.logger || defaultLogger;

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    try {
      // Ensure request ID exists
      if (!ctx.metadata.has('requestId')) {
        ctx.metadata.set('requestId', generateRequestId());
      }

      // Execute next middleware/handler
      return await next();
    } catch (error) {
      // Extract error context
      const context = extractErrorContext(ctx);

      // Log error
      if (error instanceof Error) {
        logger(error, context);
      }

      // Format error response
      const errorResponse = formatErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        context,
        config
      );

      // Get status code
      const statusCode = getStatusCode(
        error instanceof Error ? error : new Error(String(error))
      );

      // Return error response
      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
        },
      });
    }
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
