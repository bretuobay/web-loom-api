/**
 * Validation Middleware — DEPRECATED
 *
 * This adapter-based validation middleware has been superseded by the
 * `validate()` helper from `@web-loom/api-core` which wraps
 * `@hono/zod-validator` directly with Zod schemas.
 *
 * This stub exists only to prevent import errors in dependents until
 * they are migrated to the new routing-system API (Phase 2B).
 *
 * @see .kiro/specs/routing-system/
 */

import type { ZodTypeAny } from 'zod';
import type { Context, Next } from 'hono';

/**
 * @deprecated Use the `validate()` helper from `@web-loom/api-core` instead.
 */
export function createBodyValidation<T extends ZodTypeAny>(
  schema: T
): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next): Promise<void> => {
    const body = await c.req.json().catch(() => ({}));
    const result = schema.safeParse(body);

    if (!result.success) {
      c.res = c.json(
        {
          error: 'Validation Error',
          message: 'Request body validation failed',
          code: 'VALIDATION_ERROR',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400
      );
      return;
    }

    await next();
  };
}

/**
 * @deprecated Use the `validate()` helper from `@web-loom/api-core` instead.
 */
export function createQueryValidation<T extends ZodTypeAny>(
  schema: T
): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next): Promise<void> => {
    const query = c.req.queries();
    const result = schema.safeParse(query);

    if (!result.success) {
      c.res = c.json(
        {
          error: 'Validation Error',
          message: 'Query parameter validation failed',
          code: 'VALIDATION_ERROR',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400
      );
      return;
    }

    await next();
  };
}

/**
 * @deprecated Use the `validate()` helper from `@web-loom/api-core` instead.
 */
export function createParamsValidation<T extends ZodTypeAny>(
  schema: T
): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next): Promise<void> => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      c.res = c.json(
        {
          error: 'Validation Error',
          message: 'Path parameter validation failed',
          code: 'VALIDATION_ERROR',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400
      );
      return;
    }

    await next();
  };
}

/**
 * @deprecated Use the `validate()` helper from `@web-loom/api-core` instead.
 */
export function createValidation<
  TBody extends ZodTypeAny,
  TQuery extends ZodTypeAny,
  TParams extends ZodTypeAny,
>(schemas: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next): Promise<void> => {
    const errors: Array<{ field: string; message: string; code: string }> = [];

    if (schemas.body) {
      const body = await c.req.json().catch(() => ({}));
      const result = schemas.body.safeParse(body);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `body.${issue.path.join('.')}`,
            message: issue.message,
            code: issue.code,
          }))
        );
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(c.req.queries());
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `query.${issue.path.join('.')}`,
            message: issue.message,
            code: issue.code,
          }))
        );
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(c.req.param());
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `params.${issue.path.join('.')}`,
            message: issue.message,
            code: issue.code,
          }))
        );
      }
    }

    if (errors.length > 0) {
      c.res = c.json(
        {
          error: 'Validation Error',
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        },
        400
      );
      return;
    }

    await next();
  };
}
