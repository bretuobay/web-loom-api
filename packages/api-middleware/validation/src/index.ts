/**
 * @web-loom/api-middleware-validation
 *
 * Validation middleware for Web Loom API Framework
 * Provides middleware for validating request body, query parameters, and path parameters
 */

export {
  createBodyValidation,
  createQueryValidation,
  createParamsValidation,
  createValidation,
} from './validation-middleware';

// Input sanitization utilities
export {
  sanitize,
  sanitizeObject,
  isPathTraversal,
  requestSizeLimit,
} from './sanitization';

export type {
  RequestContext,
  NextFunction,
  ValidationAdapter,
  Schema,
} from '@web-loom/api-core';
