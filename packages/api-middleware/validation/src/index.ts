/**
 * @web-loom/api-middleware-validation
 *
 * Validation middleware for Web Loom API Framework.
 *
 * @deprecated The adapter-based validators have been replaced with Zod-native
 * helpers. See the routing-system spec (.kiro/specs/routing-system/) for the
 * upcoming `validate()` helper.
 */

export {
  createBodyValidation,
  createQueryValidation,
  createParamsValidation,
  createValidation,
} from './validation-middleware';

// Input sanitization utilities (unchanged)
export { sanitize, sanitizeObject, isPathTraversal, requestSizeLimit } from './sanitization';
