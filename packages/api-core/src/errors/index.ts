/**
 * Error Handling Module
 * 
 * Provides centralized error handling, error classification, and database error mapping.
 */

export {
  createErrorHandler,
  formatErrorResponse,
  generateRequestId,
  extractErrorContext,
  getStatusCode,
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
} from './error-handler';

export type {
  Environment,
  ErrorHandlerConfig,
  ErrorContext,
  ErrorResponse,
} from './error-handler';

export { ConfigurationError } from './configuration-error';
export { DuplicateModelError } from './duplicate-model-error';

export {
  mapDatabaseError,
  isDatabaseError,
} from './database-error-mapper';
