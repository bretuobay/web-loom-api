/**
 * Validation Middleware
 * 
 * Provides middleware for validating request body, query parameters, and path parameters
 * using a ValidationAdapter (e.g., Zod).
 * 
 * @example
 * ```typescript
 * import { createBodyValidation } from '@web-loom/api-middleware-validation';
 * import { ZodAdapter } from '@web-loom/api-adapter-zod';
 * 
 * const adapter = new ZodAdapter();
 * const userSchema = adapter.defineSchema({
 *   name: { type: 'string', required: true },
 *   email: { type: 'string', required: true, format: 'email' }
 * });
 * 
 * const validateBody = createBodyValidation(adapter, userSchema);
 * ```
 */

import type {
  RequestContext,
  NextFunction,
  ValidationAdapter,
  Schema,
} from '@web-loom/api-core';

/**
 * Create middleware for validating request body
 * 
 * Validates the request body against a schema and returns 400 with detailed
 * errors if validation fails.
 * 
 * @param adapter - Validation adapter instance
 * @param schema - Schema to validate against
 * @returns Middleware function
 */
export function createBodyValidation<T>(
  adapter: ValidationAdapter,
  schema: Schema<T>
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const result = adapter.validate(schema, ctx.body);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          message: 'Request body validation failed',
          code: 'VALIDATION_ERROR',
          details: result.errors?.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Replace body with validated data
    ctx.body = result.data;

    return next();
  };
}

/**
 * Create middleware for validating query parameters
 * 
 * Validates URL query parameters against a schema and returns 400 with
 * detailed errors if validation fails.
 * 
 * @param adapter - Validation adapter instance
 * @param schema - Schema to validate against
 * @returns Middleware function
 */
export function createQueryValidation<T>(
  adapter: ValidationAdapter,
  schema: Schema<T>
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const result = adapter.validate(schema, ctx.query);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          message: 'Query parameter validation failed',
          code: 'VALIDATION_ERROR',
          details: result.errors?.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Replace query with validated data
    ctx.query = result.data as Record<string, string>;

    return next();
  };
}

/**
 * Create middleware for validating path parameters
 * 
 * Validates URL path parameters (e.g., :id) against a schema and returns 400
 * with detailed errors if validation fails.
 * 
 * @param adapter - Validation adapter instance
 * @param schema - Schema to validate against
 * @returns Middleware function
 */
export function createParamsValidation<T>(
  adapter: ValidationAdapter,
  schema: Schema<T>
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const result = adapter.validate(schema, ctx.params);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          message: 'Path parameter validation failed',
          code: 'VALIDATION_ERROR',
          details: result.errors?.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Replace params with validated data
    ctx.params = result.data as Record<string, string>;

    return next();
  };
}

/**
 * Create combined validation middleware
 * 
 * Validates body, query, and params in a single middleware. Useful when
 * multiple parts of the request need validation.
 * 
 * @param adapter - Validation adapter instance
 * @param schemas - Schemas for body, query, and params
 * @returns Middleware function
 */
export function createValidation<TBody = unknown, TQuery = unknown, TParams = unknown>(
  adapter: ValidationAdapter,
  schemas: {
    body?: Schema<TBody>;
    query?: Schema<TQuery>;
    params?: Schema<TParams>;
  }
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const errors: Array<{ field: string; message: string; code: string }> = [];

    // Validate body
    if (schemas.body) {
      const result = adapter.validate(schemas.body, ctx.body);
      if (!result.success) {
        errors.push(
          ...(result.errors?.map((err) => ({
            field: `body.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          })) || [])
        );
      } else {
        ctx.body = result.data;
      }
    }

    // Validate query
    if (schemas.query) {
      const result = adapter.validate(schemas.query, ctx.query);
      if (!result.success) {
        errors.push(
          ...(result.errors?.map((err) => ({
            field: `query.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          })) || [])
        );
      } else {
        ctx.query = result.data as Record<string, string>;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = adapter.validate(schemas.params, ctx.params);
      if (!result.success) {
        errors.push(
          ...(result.errors?.map((err) => ({
            field: `params.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          })) || [])
        );
      } else {
        ctx.params = result.data as Record<string, string>;
      }
    }

    // Return error if any validation failed
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return next();
  };
}
